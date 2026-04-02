const { Client, GatewayIntentBits } = require("discord.js");
const { pool, initDB } = require("./utilities/db");
const { initSchedulers } = require("./utilities/scheduler");
const { handleCommands } = require("./utilities/commandHandler");
const { handleSpecialChannels } = require("./utilities/specialChannels");
const express = require("express");

// ─────────────────────────────────────────────────────────────────────────────
// 🌐 KEEP-ALIVE HTTP СЪРВЪР (За да не заспива в Render/Railway)
// ─────────────────────────────────────────────────────────────────────────────
const app = express();
// Хостингът автоматично подава PORT, ако не - ползваме 10000 по подразбиране
const PORT = process.env.PORT || 10000;

app.get("/", (req, res) => {
  res.send("🤖 Bot is running ✅ - Keep-alive active!");
});

// Слушаме на 0.0.0.0, за да може външният свят (и Render) да вижда сървъра
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Keep-alive server running on port ${PORT}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// 🤖 DISCORD BOT CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers
    ]
});

client.once("ready", async () => {
    try {
        await initDB();
        initSchedulers(client, pool);
        console.log(`🚀 Online as ${client.user.tag}`);
    } catch (err) {
        console.error("❌ Error during startup:", err);
    }
});

client.on("messageCreate", async (msg) => {
    // Игнорираме съобщения от ботове или директни съобщения (DMs)
    if (msg.author.bot || !msg.guild) return;

    try {
        // 1. Проверка за специални канали (repair и т.н.)
        if (await handleSpecialChannels(msg)) return;

        // 2. Обработка на команди (!hero, !remind и т.н.)
        await handleCommands(msg, pool);
    } catch (err) {
        console.error("⚠️ Error handling message:", err);
    }
});

// Стартиране на бота с токена от Environment Variables
client.login(process.env.DISCORD_TOKEN);
