require('dotenv').config();

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW() AS current_time');

    console.log('=================================');
    console.log('✅ NEON POSTGRESQL CONNECTION OK');
    console.log('Database time:', result.rows[0].current_time);
    console.log('=================================');
  } catch (error) {
    console.error('=================================');
    console.error('❌ NEON POSTGRESQL CONNECTION FAILED');
    console.error(error.message);
    console.error('=================================');
  } finally {
    await pool.end();
  }
}

testConnection();