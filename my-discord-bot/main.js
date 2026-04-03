const { Client, GatewayIntentBits } = require("discord.js");
const { pool, initDB } = require("./utilities/db");
const { initSchedulers, captureStrategy } = require("./utilities/scheduler");
const { handleCommands } = require("./utilities/commandHandler");
const { handleSpecialChannels } = require("./utilities/specialChannels");
const { handleNewMember, handleRoleCommands } = require("./utilities/roleHandler");
const { logDeletedMessage } = require("./utilities/logger");

// Инициализация на клиента с всички нужни права
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers
    ]
});


//  проблема с Render, без да пречи на Railway
const http = require('http');
const port = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Bot is running!');
}).listen(port);

console.log(`Monitoring server started on port ${port}`);


// Събитие: Ботът е зареден и онлайн
client.once("clientReady", async () => {
    await initDB(); // Свързване с Neon Postgres
    initSchedulers(client, pool); // Стартиране на таймерите (Mania, Strategy и т.н.)
    console.log(`🤖 Online as ${client.user.tag}`);
});

// Събитие: Логване на изтрити съобщения в #admin-logs
client.on("messageDelete", async (message) => {
    await logDeletedMessage(message);
});

// Събитие: Посрещане на нови членове (Welcome + Rookies role)
client.on("guildMemberAdd", async (member) => {
    await handleNewMember(member);
});

// Основен слушател за всички съобщения
client.on("messageCreate", async (msg) => {
    if (msg.author.bot || !msg.guild) return;

    // 1. Улавяне на стратегията (mania-strategy)
    if (captureStrategy(msg.content)) {
        return msg.react("📥"); // Потвърждение, че стратегията е записана
    }

    // 2. Проверка за специални канали (repair-ship, photos-only)
    if (await handleSpecialChannels(msg)) return;

    const content = msg.content.trim();
    const args = content.split(/\s+/);
    const cmd = args.shift().toLowerCase();

    // 3. Команди за РОЛИ (!addrole, !removerole)
    if (cmd === "!addrole" || cmd === "!removerole") {
        return await handleRoleCommands(msg, cmd, args);
    }

    // 4. Всички останали команди (Help, Hero, Reminders, Bounty)
    await handleCommands(msg, pool);
});

client.login(process.env.DISCORD_TOKEN);
