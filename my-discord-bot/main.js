const { Client, GatewayIntentBits } = require("discord.js");
const { pool, initDB } = require("./utilities/db");
const { initSchedulers } = require("./utilities/scheduler");
const { handleCommands } = require("./utilities/commandHandler");
const { handleSpecialChannels } = require("./utilities/specialChannels");

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers]
});

client.once("ready", async () => {
    await initDB();
    initSchedulers(client, pool); // Списъците вече се зареждат вътре в шедулъра
    console.log(`🤖 Online as ${client.user.tag}`);
});

client.on("messageCreate", async (msg) => {
    if (msg.author.bot || !msg.guild) return;

    // 1. Проверка за специални канали (repair и т.н.)
    if (await handleSpecialChannels(msg)) return;

    // 2. Обработка на команди (!hero, !remind и т.н.)
    await handleCommands(msg, pool);
});

client.login(process.env.DISCORD_TOKEN);
