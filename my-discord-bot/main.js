const Groq = require("groq-sdk");
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js"); //  EmbedBuilder тук
const { pool, initDB } = require("./utilities/db");
const { initSchedulers, captureStrategy } = require("./utilities/scheduler");
const { handleCommands } = require("./utilities/commandHandler");
const { handleSpecialChannels } = require("./utilities/specialChannels");
const { handleNewMember, handleRoleCommands } = require("./utilities/roleHandler");
const { logDeletedMessage } = require("./utilities/logger");

// 1. Конфигурация на Groq AI (взема ключа от Environment Variables)
const Groq = require("groq-sdk");
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const translationCooldown = new Set(); // Система за изчакване (5 секунди)


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

           // --- ЛОГИКА ЗА ПРЕВОД (САМО В КАНАЛ "ai-translator") ---
    if (msg.channel.name === 'ai-translator') {
        if (translationCooldown.has(msg.author.id)) return; // Проверка за спам

        try {
            // Проверка в базата за запомнен език от последните 5 часа
            const res = await pool.query(
                "SELECT last_lang FROM translation_cache WHERE user_id = $1 AND expires_at > NOW()",
                [msg.author.id]
            );

            // Първа заявка към Groq: Анализ и превод към английски
            const chatCompletion = await groq.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: "You are a translator. Analyze the text. If NOT English, translate to English. Return ONLY JSON: {\"isEnglish\": boolean, \"detectedLang\": \"name\", \"translatedText\": \"text\"}"
                    },
                    { role: "user", content: msg.content }
                ],
                model: "llama-3.3-70b-versatile",
                response_format: { type: "json_object" } // Директен JSON формат от AI-то
            });

            const data = JSON.parse(chatCompletion.choices[0].message.content);

            // АКО СЪОБЩЕНИЕТО НЕ Е НА АНГЛИЙСКИ
            if (!data.isEnglish) {
                const expireTime = new Date();
                expireTime.setHours(expireTime.getHours() + 5);

                // Записваме езика в базата данни
                await pool.query(
                    "INSERT INTO translation_cache (user_id, last_lang, expires_at) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO UPDATE SET last_lang = $2, expires_at = $3",
                    [msg.author.id, data.detectedLang, expireTime]
                );
                await msg.reply(`🇺🇸 **English:** ${data.translatedText}`);

            } 
            // АКО Е НА АНГЛИЙСКИ, НО ИМАМЕ ЗАПОМНЕН ДРУГ ЕЗИК (Превод обратно)
            else if (res.rows.length > 0) {
                const targetLang = res.rows[0].last_lang;
                const backResult = await groq.chat.completions.create({
                    messages: [
                        { role: "system", content: `Translate this text to ${targetLang}. Return ONLY the translated text without extra talk.` },
                        { role: "user", content: msg.content }
                    ],
                    model: "llama-3.3-70b-versatile"
                });
                await msg.reply(`🌍 **To ${targetLang}:** ${backResult.choices[0].message.content}`);
            }

            // Активиране на 5 секунди изчакване за потребителя
            translationCooldown.add(msg.author.id);
            setTimeout(() => translationCooldown.delete(msg.author.id), 5000);

        } catch (err) {
            console.error("Грешка при Groq превод:", err.message);
        }
        return; // Спираме тук за този канал
    }

     // --- ДРУГИ ФУНКЦИИ И КОМАНДИ ---
    
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
