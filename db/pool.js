const { Pool } = require('pg');

const connStr = process.env.DATABASE_URL || '';

// Normalize postgres:// to postgresql:// for pg driver compatibility
const normalizedUrl = connStr.replace(/^postgres:\/\//, 'postgresql://');

const pool = new Pool({
  connectionString: normalizedUrl,
  ssl: { rejectUnauthorized: false }
});
module.exports = pool;
