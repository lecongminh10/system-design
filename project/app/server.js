const express = require('express');
const { executeWrite, executeRead, getDbStatus } = require('./db');
const { getOrSetCache, invalidateCache, getCacheStatus } = require('./cache');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const INSTANCE_NAME = process.env.INSTANCE_NAME || 'app-unknown';

// Log incoming request info
app.use((req, res, next) => {
  console.log(`[${INSTANCE_NAME}] ${req.method} ${req.url}`);
  res.setHeader('X-Served-By', INSTANCE_NAME);
  next();
});

// 1. Root Endpoint (Demonstrates Load Balancer Round Robin & Backend Identity)
app.get('/', async (req, res) => {
  res.json({
    status: 'success',
    message: 'Welcome to System Design Integrated Project (Lessons 01 - 05)',
    instance: INSTANCE_NAME,
    timestamp: new Date().toISOString(),
    clientIp: req.headers['x-forwarded-for'] || req.socket.remoteAddress
  });
});

// 2. Health Check Endpoint (Demonstrates Load Balancer Passive/Active Health Checks)
app.get('/health', async (req, res) => {
  const dbStatus = await getDbStatus();
  const cacheStatus = await getCacheStatus();

  res.json({
    instance: INSTANCE_NAME,
    status: 'UP',
    components: {
      database: dbStatus,
      cache: cacheStatus
    }
  });
});

// 3. READ Endpoint with Cache-Aside (Lesson 3: Caching Redis + Lesson 4 & 5: Read Replica)
// Flow: Redis Cache -> MySQL Replica
app.get('/api/products/:id', async (req, res) => {
  const productId = req.params.id;
  const cacheKey = `product:${productId}`;
  const DEFAULT_TTL = 30; // 30 seconds TTL

  try {
    const result = await getOrSetCache(cacheKey, DEFAULT_TTL, async () => {
      console.log(`[DB Query] Cache Miss for Product ID ${productId}. Querying MySQL Replica...`);
      const { rows, source } = await executeRead(
        'SELECT id, name, price, stock, updated_at FROM products WHERE id = ?',
        [productId]
      );

      if (rows.length === 0) return null;
      return { ...rows[0], dbSource: source };
    });

    if (!result.data) {
      return res.status(404).json({
        instance: INSTANCE_NAME,
        error: 'Product not found'
      });
    }

    res.json({
      instance: INSTANCE_NAME,
      cacheHit: result.cacheHit,
      cacheKey: cacheKey,
      data: result.data
    });
  } catch (err) {
    console.error('[Get Product Error]', err);
    res.status(500).json({ instance: INSTANCE_NAME, error: err.message });
  }
});

// 4. READ All Products (Direct MySQL Replica Read - Lesson 4 & 5: Read/Write Splitting)
app.get('/api/products', async (req, res) => {
  try {
    const { rows, source } = await executeRead('SELECT id, name, price, stock, updated_at FROM products ORDER BY id DESC LIMIT 20');
    res.json({
      instance: INSTANCE_NAME,
      querySource: source, // Indicates if read from 'replica' or 'master-fallback'
      total: rows.length,
      data: rows
    });
  } catch (err) {
    console.error('[List Products Error]', err);
    res.status(500).json({ instance: INSTANCE_NAME, error: err.message });
  }
});

// 5. WRITE Endpoint (Lesson 4 & 5: Master DB Write + Cache Invalidation)
// Flow: Write to MySQL Master -> Invalidate Redis Cache -> Return Response
app.post('/api/products', async (req, res) => {
  const { name, price, stock } = req.body;

  if (!name || price === undefined) {
    return res.status(400).json({ error: 'Name and price are required' });
  }

  try {
    console.log(`[DB Write] Inserting product "${name}" into MySQL Master DB...`);
    const result = await executeWrite(
      'INSERT INTO products (name, price, stock) VALUES (?, ?, ?)',
      [name, parseFloat(price), parseInt(stock || '10')]
    );

    const insertedId = result.insertId;

    // Cache Invalidation
    await invalidateCache(`product:${insertedId}`);

    res.status(201).json({
      instance: INSTANCE_NAME,
      message: 'Product created successfully on MySQL Master DB',
      productId: insertedId,
      dbTarget: 'master'
    });
  } catch (err) {
    console.error('[Create Product Error]', err);
    res.status(500).json({ instance: INSTANCE_NAME, error: err.message });
  }
});

// 6. DB Replication & Cluster Status
app.get('/api/cluster-status', async (req, res) => {
  const db = await getDbStatus();
  const cache = await getCacheStatus();

  res.json({
    handledByInstance: INSTANCE_NAME,
    timestamp: new Date().toISOString(),
    nodes: {
      loadBalancer: 'Nginx (Port 8080)',
      backendInstance: INSTANCE_NAME,
      cacheLayer: cache,
      databaseLayer: db
    }
  });
});

app.listen(PORT, () => {
  console.log(`[Server] App instance "${INSTANCE_NAME}" running on port ${PORT}`);
});
