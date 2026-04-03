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
        GatewayIntentBits.GuildMembers
    ]
});

// Използваме clientReady за избягване на предупреждения в v14+
client.once("clientReady", async () => {
    await initDB();
    initSchedulers(client, pool);
    console.log(`🤖 Online and Ready as ${client.user.tag}`);
});

// Автоматична роля Rookies при влизане
client.on("guildMemberAdd", async (member) => {
    await handleNewMember(member);
});

client.on("messageCreate", async (msg) => {
    if (msg.author.bot || !msg.guild) return;

    // 1. Улавяне на стратегията (mania-strategy)
    if (captureStrategy(msg.content)) {
        return msg.react("📥"); 
    }

    // 2. Специални канали (repair-ship, photos-only)
    if (await handleSpecialChannels(msg)) return;

    const content = msg.content.trim();
    const args = content.split(/\s+/);
    const cmd = args.shift().toLowerCase();

    // 3. Команди за РОЛИ (!addrole, !removerole)
    if (cmd === "!addrole" || cmd === "!removerole") {
        return await handleRoleCommands(msg, cmd, args);
    }

    // 4. Всички останали команди (!hero, !remind, !reminders, !allreminders, !clear)
    await handleCommands(msg, pool);
});

client.login(process.env.DISCORD_TOKEN);
