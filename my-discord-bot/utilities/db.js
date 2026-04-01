const { Pool } = require("pg");

// Конфигурация на връзката (взима данните от Environment Variables)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Задължително за Neon
});

// Функция за създаване на таблицата, ако не съществува
async function initDB() {
  try {
    await pool.query("SELECT 1"); // Проверка на връзката
    console.log("✅ Connected to Neon/Postgres!");

    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS reminders (
        id BIGINT PRIMARY KEY,
        cron VARCHAR(100),
        message TEXT,
        channel_id VARCHAR(50),
        owner_id VARCHAR(50)
      );
    `;
    await pool.query(createTableQuery);
  } catch (err) {
    console.error("❌ Database connection error:", err.message);
    process.exit(1); // Спира бота, ако няма връзка с базата
  }
}

module.exports = { pool, initDB };
