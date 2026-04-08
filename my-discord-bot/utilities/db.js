const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDB() {
  try {
    await pool.query("SELECT 1");
    console.log("✅ Connected to Neon/Postgres!");

    // Таблица за напомняния (динамични)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reminders (
        id BIGINT PRIMARY KEY,
        cron VARCHAR(100),
        message TEXT,
        channel_id VARCHAR(50),
        owner_id VARCHAR(50)
      );
    `);

    // Таблица за потребители и техните Bounty награди
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id VARCHAR(50) PRIMARY KEY,
        bounty BIGINT DEFAULT 0,
        username TEXT
      );
    `);

    // --- НОВА ТАБЛИЦА ЗА ПРЕВОДАЧА (AI) ---
    await pool.query(`
      CREATE TABLE IF NOT EXISTS translation_cache (
        user_id VARCHAR(50) PRIMARY KEY,
        last_lang TEXT,
        expires_at TIMESTAMP
      );
    `);

   /*  --- ТАБЛИЦА ЗА ГЛОБАЛНИ ПРОМЕНЛИВИ (Стратегии и др.) ---
  await pool.query(`
    CREATE TABLE IF NOT EXISTS global_vars (
    key TEXT PRIMARY KEY,
    value TEXT
    );
  `);
   console.log("✅ Таблицата global_vars е готова.");
*/

  const { Pool } = require('pg');

// Конфигурация на връзката с PostgreSQL
const pool = new Pool({
    connectionString: "YOUR_DATABASE_URL_HERE"
});

// Функция за инициализиране на таблиците
async function initDB() {
    try {
        // Създаваме таблицата, ако не съществува. 'key' е уникален, за да презаписваме лесно.
        await pool.query(`
            CREATE TABLE IF NOT EXISTS global_vars (
                key TEXT PRIMARY KEY,
                value TEXT
            );
        `);
        console.log("✅ Database tables are ready.");
    } catch (err) {
        console.error("❌ Database initialization error:", err);
    }
}

module.exports = { pool, initDB };


    // --- НОВО: АВТОМАТИЧНО ПОЧИСТВАНЕ ПРИ СТАРТ ---
    const deleteResult = await pool.query("DELETE FROM translation_cache WHERE expires_at < NOW()");
    console.log(`🧹 Почистени са ${deleteResult.rowCount} стари записа от преводача.`);
    
    
  } catch (err) {
    console.error("❌ Database initialization error:", err.message);
  }
}

module.exports = { pool, initDB };
