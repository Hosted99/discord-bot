const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js"); //  EmbedBuilder тук
const { pool, initDB } = require("./utilities/db");
const { initSchedulers, captureStrategy } = require("./utilities/scheduler");
const { handleCommands } = require("./utilities/commandHandler");
const { handleSpecialChannels } = require("./utilities/specialChannels");
const { handleNewMember, handleRoleCommands } = require("./utilities/roleHandler");
const { logDeletedMessage } = require("./utilities/logger");

// Инициализация на Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
const translationCooldown = new Set(); // ВАЖНО!!!!!!!!

// Инициализация на клиента с всички нужни права
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers
    ]
});

// Проблема с Render, без да пречи на Railway
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

    // --- СЪОБЩЕНИЕ "I AM ALIVE" ПРИ СТАРТИРАНЕ ---
    client.guilds.cache.forEach(async (guild) => {
        const botChannel = guild.channels.cache.find(ch => ch.name === "bot-only");
        if (botChannel) {
            const aliveEmbed = new EmbedBuilder()
                .setTitle("📡 System Status: Online")
                .setDescription("🏴‍☠️ **The Captain is back on the deck!**\nAll systems are operational and the seas are under watch.")
                .setColor("#00ff00")
                .setTimestamp();

            await botChannel.send({ embeds: [aliveEmbed] }).catch(err => console.log("Error sending alive msg:", err.message));
        }
    });
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

           // --- ЛОГИКА ЗА ПРЕВОД (GEMINI) ---
    if (msg.channel.name === 'ai-translator') {
        if (translationCooldown.has(msg.author.id)) return;

        try {
            const res = await pool.query(
                "SELECT last_lang FROM translation_cache WHERE user_id = $1 AND expires_at > NOW()",
                [msg.author.id]
            );

            const prompt = `Analyze: "${msg.content}" 1. Identify language. 2. If NOT English, translate to English. Return ONLY JSON: {"isEnglish": boolean, "detectedLang": "name", "translatedText": "text"}`;
            const result = await model.generateContent(prompt);
            let responseText = result.response.text();

            // Изчистване на евентуални markdown символи от Gemini
            const cleanJson = responseText.replace(/```json|```/g, "").trim();

            let data;
            try {
                data = JSON.parse(cleanJson);
            } catch (e) {
                console.error("Грешка при четене на JSON от Gemini:", cleanJson);
                return; // Спираме, ако Gemini не върне валиден формат
            }

            if (!data.isEnglish) {
                const expireTime = new Date();
                expireTime.setHours(expireTime.getHours() + 5);

                await pool.query(
                    "INSERT INTO translation_cache (user_id, last_lang, expires_at) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO UPDATE SET last_lang = $2, expires_at = $3",
                    [msg.author.id, data.detectedLang, expireTime]
                );
                await msg.reply(`🇺🇸 **English:** ${data.translatedText}`);

            } else if (res.rows.length > 0) {
                const targetLang = res.rows[0].last_lang; // ВАЖНО: Добавено [0] тук!
                const backResult = await model.generateContent(`Translate this to ${targetLang}: "${msg.content}". Return only the text.`);
                await msg.reply(`🌍 **To ${targetLang}:** ${backResult.response.text()}`);
            }

            translationCooldown.add(msg.author.id);
            setTimeout(() => translationCooldown.delete(msg.author.id), 5000);

        } catch (err) {
            console.error("Gemini Error:", err.message);
        }
        return; 
    }


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
