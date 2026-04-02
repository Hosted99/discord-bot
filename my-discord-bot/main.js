const { Client, GatewayIntentBits } = require("discord.js");
const { pool, initDB } = require("./utilities/db");
const { initSchedulers } = require("./utilities/scheduler");
const { handleCommands } = require("./utilities/commandHandler");
const { handleSpecialChannels } = require("./utilities/specialChannels");

const heroesData = require("./data/heroes.json");
const staticReminders = require("./data/staticReminders");
const repairMessages = require("./data/repairMessages");

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers]
});

// Настройки за ремонт (изнесени от главния цикъл)
const allowedShips = ["@mugi-ship", "@goat-ship", "@ati-ship"];
const noShipMessages = [
    "🚫 Hmm, **{user}**? This ship is not in our registry.",
    "🔍 We searched everywhere, but couldn't find **{user}**.",
    "⚓ Sorry, our dock doesn't support models like **{user}**."
];

client.once("ready", async () => {
    await initDB();
    initSchedulers(client, staticReminders, pool);
    console.log(`🤖 Online as ${client.user.tag}`);
});

client.on("messageCreate", async (msg) => {
    if (msg.author.bot || !msg.guild) return;

    // 1. Проверка за специални канали (repair-ship и т.н.)
    const isSpecial = await handleSpecialChannels(msg, repairMessages, allowedShips, noShipMessages);
    if (isSpecial) return;

    // 2. Обработка на команди
    const args = msg.content.trim().split(/\s+/);
    const cmd = args[0]?.toLowerCase();
    
    await handleCommands(msg, cmd, args, heroesData, pool);
});

client.login(process.env.DISCORD_TOKEN);
