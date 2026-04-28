const { Pool } = require("pg");

// 1. Конфигурация на връзката
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDB() {
  try {
    await pool.query("SELECT 1");
    console.log("✅ Connected to Neon/Postgres!");

    // Таблица за напомняния
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reminders (
        id BIGINT PRIMARY KEY,
        cron VARCHAR(100),
        message TEXT,
        channel_id VARCHAR(50),
        owner_id VARCHAR(50)
      );
    `);

    // Таблица за потребители и Bounty
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id VARCHAR(50) PRIMARY KEY,
        bounty BIGINT DEFAULT 0,
        username TEXT
      );
    `);

    // Таблица за преводача
    await pool.query(`
      CREATE TABLE IF NOT EXISTS translation_cache (
        user_id VARCHAR(50) PRIMARY KEY,
        last_lang TEXT,
        expires_at TIMESTAMP
      );
    `);

    // ТАБЛИЦА ЗА ПЛАНОВЕТЕ И ПРОМЕНЛИВИ (Много важна!)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS global_vars (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);
    console.log("✅ Table global_vars is ready.");

    // Нова таблица специално за нивата и XP
await pool.query(`
  CREATE TABLE IF NOT EXISTS levels (
    user_id VARCHAR(50) PRIMARY KEY,
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    username TEXT
  );
`);
console.log("✅ Table levels is ready.");

    // Таблица за постоянния екипаж (Belly Rush)
await pool.query(`
  CREATE TABLE IF NOT EXISTS permanent_crew (
    user_id VARCHAR(50) PRIMARY KEY
  );
`);
console.log("✅ Table permanent_crew is ready.");

    // Автоматично почистване на преводача при старт
    const deleteResult = await pool.query("DELETE FROM translation_cache WHERE expires_at < NOW()");
    if (deleteResult.rowCount > 0) {
        console.log(`🧹 Cleaned ${deleteResult.rowCount} old translation records.`);
    }
    
  } catch (err) {
    console.error("❌ Database initialization error:", err.message);
  }
}

// Експортираме pool, за да го ползваме в scheduler.js
module.exports = { pool, initDB };
