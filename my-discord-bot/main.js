const { Client, GatewayIntentBits } = require("discord.js");
const { pool, initDB } = require("./utilities/db");
const { initSchedulers, captureStrategy } = require("./utilities/scheduler");
const { handleCommands } = require("./utilities/commandHandler");
const { handleSpecialChannels } = require("./utilities/specialChannels");
const { handleNewMember, handleRoleCommands } = require("./utilities/roleHandler");
const { logDeletedMessage } = require("./utilities/logger");

});

// Инициализация на клиента с нужните интенти
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers // Нужен за автоматичните роли и списъка с хора
    ]
});

// Събитие: Когато ботът е готов и онлайн
client.once("clientReady", async () => {
    await initDB(); // Свързване с Postgres
    initSchedulers(client, pool); // Стартиране на всички таймери
    console.log(`🤖 Ботът е онлайн като ${client.user.tag}`);
});

// Събитие: Когато нов член влезе в сървъра
client.on("guildMemberAdd", async (member) => {
    await handleNewMember(member); // Дава роля Rookies и праща welcome съобщение
});

// Събитие: При всяко ново съобщение в сървъра
client.on("messageCreate", async (msg) => {
    if (msg.author.bot || !msg.guild) return; // Игнорира ботове и лични съобщения

    // 1. Проверка за ключова дума mania-strategy (за автоматичния ремайндър в 19:25)
    if (captureStrategy(msg.content)) {
        return msg.react("📥"); // Потвърждава, че е записал стратегията
    }

    // 2. Логика за специални канали (repair-ship, photos-only и триене на спам)
    if (await handleSpecialChannels(msg)) return;

    const content = msg.content.trim();
    const args = content.split(/\s+/);
    const cmd = args.shift().toLowerCase();

    // 3. Команди за роли (!addrole, !removerole)
    if (cmd === "!addrole" || cmd === "!removerole") {
        return await handleRoleCommands(msg, cmd, args);
    }

    // 4.Следене за изтрити съобщения
client.on("messageDelete", async (message) => {
    await logDeletedMessage(message);
    
    // 5. Всички стандартни команди (!hero, !remind, !help, !reminders, !allreminders, !clear, !delete)
    await handleCommands(msg, pool);
});

client.login(process.env.DISCORD_TOKEN);
