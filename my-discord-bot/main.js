const { Client, GatewayIntentBits } = require("discord.js");
const { pool, initDB } = require("./utilities/db");
const { initSchedulers } = require("./utilities/scheduler");
const { handleCommands } = require("./utilities/commandHandler");
const { handleSpecialChannels } = require("./utilities/specialChannels");
const { handleNewMember, handleRoleCommands } = require("./utilities/roleHandler"); // Нов модул за роли

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers // ЗАДЪЛЖИТЕЛНО за автоматичните роли и welcome съобщенията
    ]
});

// --- СЪБИТИЕ: ПРИ ГОТОВНОСТ ---
client.once("ready", async () => {
    await initDB();
    initSchedulers(client, pool);
    console.log(`🤖 Online as ${client.user.tag}`);
});

// --- СЪБИТИЕ: НОВ ЧЛЕН (WELCOME & ROOKIES ROLE) ---
client.on("guildMemberAdd", async (member) => {
    await handleNewMember(member);
});

// --- СЪБИТИЯ: СЪОБЩЕНИЯ И КОМАНДИ ---
client.on("messageCreate", async (msg) => {
    if (msg.author.bot || !msg.guild) return;

    // 1. Проверка за специални канали (repair-ship, photos-only)
    if (await handleSpecialChannels(msg)) return;

    const content = msg.content.trim();
    const args = content.split(/\s+/);
    const cmd = args.shift().toLowerCase();

    // 2. Команди за РОЛИ (!addrole, !removerole)
    if (cmd === "!addrole" || cmd === "!removerole") {
        return await handleRoleCommands(msg, cmd, args);
    }

    // 3. Стандартни команди (!hero, !remind, !clear)
    await handleCommands(msg, pool);
});

client.login(process.env.DISCORD_TOKEN);
