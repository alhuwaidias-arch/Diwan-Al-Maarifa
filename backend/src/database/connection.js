// Database Connection Module with Lazy Initialization
const { Pool } = require('pg');

let pool = null;

// Initialize pool only when needed
function getPool() {
  if (pool) {
    return pool;
  }

  console.log('🔄 Initializing database connection pool...');
  
  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set!');
    console.error('Available env vars:', Object.keys(process.env).filter(k => k.includes('DB') || k.includes('DATA')));
    throw new Error('DATABASE_URL is required');
  }

  // Log connection info (masked for security)
  const dbUrl = process.env.DATABASE_URL;
  const maskedUrl = dbUrl.replace(/:([^:@]+)@/, ':****@');
  console.log('📡 Connecting to database:', maskedUrl);

  // Create connection pool
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? {
      rejectUnauthorized: false
    } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });

  // Handle pool errors
  pool.on('error', (err) => {
    console.error('❌ Unexpected database pool error:', err);
  });

  console.log('✅ Database pool initialized');
  return pool;
}

// Test connection
async function connectDatabase() {
  try {
    const poolInstance = getPool();
    const client = await poolInstance.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    console.log('✅ Database connected at:', result.rows[0].now);
    return true;
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    console.error('Full error:', error);
    throw error;
  }
}

// Query function
async function query(text, params) {
  const start = Date.now();
  try {
    const poolInstance = getPool();
    const result = await poolInstance.query(text, params);
    const duration = Date.now() - start;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Query executed:', { text: text.substring(0, 100), duration, rows: result.rowCount });
    }
    
    return result;
  } catch (error) {
    console.error('❌ Query error:', error.message);
    throw error;
  }
}

// Get a client from the pool (for transactions)
async function getClient() {
  const poolInstance = getPool();
  return await poolInstance.connect();
}

// Graceful shutdown
async function closePool() {
  if (pool) {
    await pool.end();
    console.log('Database pool closed');
    pool = null;
  }
}

module.exports = {
  connectDatabase,
  query,
  getClient,
  closePool,
  get pool() {
    return getPool();
  }
};
