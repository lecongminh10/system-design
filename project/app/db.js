const mysql = require('mysql2/promise');

// Configuration for Master DB (Write)
const masterConfig = {
  host: process.env.DB_MASTER_HOST || 'mysql-master',
  port: parseInt(process.env.DB_MASTER_PORT || '3306'),
  user: process.env.DB_USER || 'app_user',
  password: process.env.DB_PASSWORD || 'app_password',
  database: process.env.DB_NAME || 'shop_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Configuration for Replica DB (Read)
const replicaConfig = {
  host: process.env.DB_REPLICA_HOST || 'mysql-replica',
  port: parseInt(process.env.DB_REPLICA_PORT || '3306'),
  user: process.env.DB_USER || 'app_user',
  password: process.env.DB_PASSWORD || 'app_password',
  database: process.env.DB_NAME || 'shop_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const masterPool = mysql.createPool(masterConfig);
const replicaPool = mysql.createPool(replicaConfig);

/**
 * Execute Write Query (INSERT, UPDATE, DELETE) -> Always goes to Primary/Master DB
 */
async function executeWrite(sql, params = []) {
  const [result] = await masterPool.execute(sql, params);
  return result;
}

/**
 * Execute Read Query (SELECT) -> Goes to Secondary/Replica DB (Fallback to Master if Replica fails)
 */
async function executeRead(sql, params = []) {
  try {
    const [rows] = await replicaPool.execute(sql, params);
    return { rows, source: 'replica' };
  } catch (err) {
    console.warn('[Read-Write Splitting] Replica read failed, falling back to Master:', err.message);
    const [rows] = await masterPool.execute(sql, params);
    return { rows, source: 'master-fallback' };
  }
}

/**
 * Get DB status for debugging Master vs Replica connections
 */
async function getDbStatus() {
  let masterStatus = 'DOWN';
  let replicaStatus = 'DOWN';
  let replicationLagSeconds = null;

  try {
    const [masterRows] = await masterPool.query('SELECT @@server_id AS server_id, NOW() AS now');
    masterStatus = `UP (Server ID: ${masterRows[0].server_id})`;
  } catch (e) {
    masterStatus = `ERROR: ${e.message}`;
  }

  try {
    const [replicaRows] = await replicaPool.query('SELECT @@server_id AS server_id, @@read_only AS read_only, NOW() AS now');
    replicaStatus = `UP (Server ID: ${replicaRows[0].server_id}, Read Only: ${replicaRows[0].read_only})`;
  } catch (e) {
    replicaStatus = `ERROR: ${e.message}`;
  }

  return {
    master: masterStatus,
    replica: replicaStatus
  };
}

module.exports = {
  masterPool,
  replicaPool,
  executeWrite,
  executeRead,
  getDbStatus
};
