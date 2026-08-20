# 08 — Spring Boot & Redis: Tích Hợp Chi Tiết Từ A-Z

## 1. Khai Báo Dependency Maven (`pom.xml`)

Để tích hợp Spring Boot với Redis, ta sử dụng 2 starter chính:

```xml
<dependencies>
    <!-- Spring Boot Starter Cache -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-cache</artifactId>
    </dependency>

    <!-- Spring Boot Starter Data Redis (Sử dụng Lettuce Driver mặc định) -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-data-redis</artifactId>
    </dependency>

    <!-- Apache Commons Pool2 cho Connection Pooling của Lettuce -->
    <dependency>
        <groupId>org.apache.commons</groupId>
        <artifactId>commons-pool2</artifactId>
    </dependency>
</dependencies>
```

---

## 2. Cấu Hình App `application.yml`

```yaml
spring:
  data:
    redis:
      host: localhost
      port: 6379
      password: ""
      timeout: 2000ms
      lettuce:
        pool:
          max-active: 16
          max-idle: 8
          min-idle: 2
          max-wait: 1000ms

  cache:
    type: redis
    redis:
      time-to-live: 600000ms # 10 phút mặc định
      cache-null-values: true # Chống Cache Penetration bằng cách lưu NULL
```

---

## 3. Class Cấu Hình Redis Cache Manager (`RedisConfig.java`)

Đảm bảo dữ liệu Java Object được Serialize sang chuẩn **JSON (Jackson)** thay vì JDK Binary Serializer mặc định (để đọc dễ dàng trên Redis Commander/CLI).

```java
package com.example.config;

import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import java.time.Duration;

@Configuration
@EnableCaching
public class RedisConfig {

    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory connectionFactory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(connectionFactory);
        
        // Key serialize dạng String
        template.setKeySerializer(new StringRedisSerializer());
        template.setHashKeySerializer(new StringRedisSerializer());
        
        // Value serialize dạng JSON
        template.setValueSerializer(new GenericJackson2JsonRedisSerializer());
        template.setHashValueSerializer(new GenericJackson2JsonRedisSerializer());
        
        template.afterPropertiesSet();
        return template;
    }

    @Bean
    public RedisCacheManager cacheManager(RedisConnectionFactory connectionFactory) {
        RedisCacheConfiguration config = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofMinutes(10)) // TTL 10 phút
                .disableCachingNullValues()
                .serializeKeysWith(RedisSerializationContext.SerializationPair.fromSerializer(new StringRedisSerializer()))
                .serializeValuesWith(RedisSerializationContext.SerializationPair.fromSerializer(new GenericJackson2JsonRedisSerializer()));

        return RedisCacheManager.builder(connectionFactory)
                .cacheDefaults(config)
                .build();
    }
}
```

---

## 4. Sử Dụng Các Annotation Caching Trong Spring Service

```java
package com.example.service;

import com.example.dto.ProductDTO;
import com.example.repository.ProductRepository;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.CachePut;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

@Service
public class ProductService {

    private final ProductRepository productRepository;

    public ProductService(ProductRepository productRepository) {
        this.productRepository = productRepository;
    }

    /**
     * @Cacheable: Kiểm tra Cache "products::#id" trước.
     * Hit -> Trả về kết quả luôn, không chạy method body.
     * Miss -> Chạy method body đọc DB, nạp vào Cache rồi trả về.
     */
    @Cacheable(value = "products", key = "#id", unless = "#result == null")
    public ProductDTO getProductById(Long id) {
        System.out.println("--> Đang truy vấn Database cho Product ID: " + id);
        return productRepository.findById(id)
                .map(ProductDTO::fromEntity)
                .orElse(null);
    }

    /**
     * @CachePut: Luôn chạy method body để ghi DB, sau đó CẬP NHẬT giá trị mới vào Cache.
     */
    @CachePut(value = "products", key = "#productDTO.id")
    public ProductDTO updateProduct(ProductDTO productDTO) {
        System.out.println("--> Đang Cập nhật Database & Refresh Cache cho Product ID: " + productDTO.getId());
        productRepository.save(productDTO.toEntity());
        return productDTO;
    }

    /**
     * @CacheEvict: Thực hiện XOÁ Key khỏi Cache khi sản phẩm bị xoá ở DB.
     */
    @CacheEvict(value = "products", key = "#id")
    public void deleteProduct(Long id) {
        System.out.println("--> Xoá Product ở DB và Invalidate Cache ID: " + id);
        productRepository.deleteById(id);
    }

    /**
     * Clear sạch toàn bộ cache trong namespace 'products'
     */
    @CacheEvict(value = "products", allEntries = true)
    public void clearAllProductCache() {
        System.out.println("--> Flush toàn bộ Product Cache");
    }
}
```

---

## 5. Graceful Degradation (Xử Lý Sự Cố Khi Redis Sập)

Mặc định, nếu Redis Server bị sập, ứng dụng Spring Boot sẽ ném ngoại lệ `RedisConnectionFailureException` và khiến mọi API bị sập theo.

Để đảm bảo ứng dụng **tự động Fallback về Database** khi mất kết nối Redis, ta cài đặt custom `CacheErrorHandler`:

```java
package com.example.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.Cache;
import org.springframework.cache.annotation.CachingConfigurerSupport;
import org.springframework.cache.interceptor.CacheErrorHandler;
import org.springframework.context.annotation.Configuration;

@Configuration
public class CustomCacheErrorHandlerConfig extends CachingConfigurerSupport {

    private static final Logger log = LoggerFactory.getLogger(CustomCacheErrorHandlerConfig.class);

    @Override
    public CacheErrorHandler errorHandler() {
        return new CacheErrorHandler() {
            @Override
            public void handleCacheGetError(RuntimeException exception, Cache cache, Object key) {
                log.error("Redis GET lỗi cho key: {}. Fallback đọc thẳng DB!", key, exception);
            }

            @Override
            public void handleCachePutError(RuntimeException exception, Cache cache, Object key, Object value) {
                log.error("Redis PUT lỗi cho key: {}", key, exception);
            }

            @Override
            public void handleCacheEvictError(RuntimeException exception, Cache cache, Object key) {
                log.error("Redis EVICT lỗi cho key: {}", key, exception);
            }

            @Override
            public void handleCacheClearError(RuntimeException exception, Cache cache) {
                log.error("Redis CLEAR lỗi!", exception);
            }
        };
    }
}
```

---

## 6. Kết luận bài học

- Luôn chuyển cấu hình Serializer sang **JSON (Jackson)**.
- Sử dụng đúng Annotation: `@Cacheable` để Read, `@CacheEvict` khi Update/Delete.
- Cấu hình `CustomCacheErrorHandler` để đảm bảo **Resilience**: Redis sập thì App vẫn sống nhờ đọc DB!
