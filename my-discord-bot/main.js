const { Client, GatewayIntentBits } = require("discord.js");
const { pool, initDB } = require("./utilities/db");
const { initSchedulers, captureStrategy } = require("./utilities/scheduler");
const { handleCommands } = require("./utilities/commandHandler");
const { handleSpecialChannels } = require("./utilities/specialChannels");
const { handleNewMember, handleRoleCommands } = require("./utilities/roleHandler");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers // ТРЯБВА ДА Е ВКЛЮЧЕНО В ПОРТАЛА
    ]
});

client.once("ready", async () => {
    await initDB();
    initSchedulers(client, pool);
    console.log(`🤖 Online as ${client.user.tag}`);
});

client.on("guildMemberAdd", async (member) => {
    await handleNewMember(member);
});

client.on("messageCreate", async (msg) => {
    if (msg.author.bot || !msg.guild) return;

    // 1. Проверяваме за ключовата дума "mania-strategy"
    if (captureStrategy(msg.content)) {
        return msg.react("📥"); // Ботът реагира с входяща кутия, за да потвърди, че е запазил стратегията
    }

    // 2. Специални канали (repair-ship, photos-only)
    if (await handleSpecialChannels(msg)) return;

    const content = msg.content.trim();
    const args = content.split(/\s+/);
    const cmd = args.shift().toLowerCase();

    // 3. Команди за РОЛИ
    if (cmd === "!addrole" || cmd === "!removerole") {
        return await handleRoleCommands(msg, cmd, args);
    }

    // 4. Стандартни команди (!hero, !remind, !clear)
    await handleCommands(msg, pool);
});

client.login(process.env.DISCORD_TOKEN);
