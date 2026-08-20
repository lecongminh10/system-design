import time
import json
import redis
import mysql.connector

# Configuration
MASTER_CONFIG = {
    'host': 'localhost',
    'port': 3306,
    'user': 'appuser',
    'password': 'apppassword',
    'database': 'scaling_db'
}

REPLICA_CONFIG = {
    'host': 'localhost',
    'port': 3307,
    'user': 'appuser',
    'password': 'apppassword',
    'database': 'scaling_db'
}

# Connect Redis
r = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)

def write_user(name, email):
    """WRITE Operation -> Hướng tới MASTER DB"""
    start_time = time.time()
    conn = mysql.connector.connect(**MASTER_CONFIG)
    cursor = conn.cursor()
    
    query = "INSERT INTO users (name, email) VALUES (%s, %s)"
    cursor.execute(query, (name, email))
    conn.commit()
    user_id = cursor.lastrowid
    
    cursor.close()
    conn.close()
    elapsed = (time.time() - start_time) * 1000
    print(f"✅ [WRITE - MASTER DB] Created User ID={user_id} ({elapsed:.2f} ms)")
    return user_id

def read_user(user_id):
    """READ Operation -> Cache-Aside with REDIS & REPLICA DB"""
    cache_key = f"user:{user_id}"
    
    # 1. Check Redis Cache
    start_time = time.time()
    cached_data = r.get(cache_key)
    if cached_data:
        elapsed = (time.time() - start_time) * 1000
        print(f"⚡ [READ - REDIS CACHE HIT] User ID={user_id}: {cached_data} ({elapsed:.2f} ms)")
        return json.loads(cached_data)

    # 2. Cache Miss -> Read from READ REPLICA
    start_time = time.time()
    conn = mysql.connector.connect(**REPLICA_CONFIG)
    cursor = conn.cursor(dictionary=True)
    
    query = "SELECT id, name, email, created_at FROM users WHERE id = %s"
    cursor.execute(query, (user_id,))
    user = cursor.fetchone()
    
    cursor.close()
    conn.close()
    db_elapsed = (time.time() - start_time) * 1000
    
    if user:
        # Convert timestamp to string for JSON serialization
        user['created_at'] = str(user['created_at'])
        # Save to Redis Cache (TTL = 60s)
        r.setex(cache_key, 60, json.dumps(user))
        print(f"🐢 [READ - DB REPLICA MISS] User ID={user_id}: {user} ({db_elapsed:.2f} ms)")
        return user
    else:
        print(f"❌ User ID={user_id} Not Found!")
        return None

if __name__ == '__main__':
    print("🚀 === STARTING DATABASE SCALING DEMO ===")
    
    # Test 1: Write User to Master DB
    new_id = write_user("Dev Master", f"dev_{int(time.time())}@example.com")
    
    # Cho Replication sync trong 0.5s
    time.sleep(0.5)
    
    # Test 2: First Read (Cache Miss -> Fetch from DB Replica)
    read_user(new_id)
    
    # Test 3: Second Read (Cache Hit -> Fetch from Redis Cache)
    read_user(new_id)
    
    # Test 4: Third Read (Cache Hit -> Fetch from Redis Cache)
    read_user(new_id)
    
    print("🎉 === DEMO COMPLETED SUCCESSFULLY ===")
