const Groq = require("groq-sdk");
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const { pool, initDB } = require("./utilities/db");
const { initSchedulers, captureStrategy } = require("./utilities/scheduler");
const { handleCommands } = require("./utilities/commandHandler");
const { handleSpecialChannels } = require("./utilities/specialChannels");
const { handleNewMember, handleRoleCommands } = require("./utilities/roleHandler");
const { sendBotManual } = require("./utilities/infoHandler");
const { logDeletedMessage } = require("./utilities/logger");

// 1. Конфигурация на Groq AI и Cooldown система
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const translationCooldown = new Set();

// 2. Инициализация на клиента с всички нужни права (Intents)a
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers
    ]
});

// 3. Сървър за поддръжка на хостинга (Render/Railway Keep-alive)
const http = require('http');
const port = process.env.PORT || 10000;
http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Bot is running!');
}).listen(port);

console.log(`Monitoring server started on port ${port}`);

// 4. Събитие: Ботът е зареден и онлайн
client.once("ready", async () => {
    await initDB(); // Свързване с базата данни
    initSchedulers(client, pool); // Стартиране на таймерите
    console.log(`🤖 Онлайн като: ${client.user.tag}`);

    client.guilds.cache.forEach(async (guild) => {
        // --- 1. ПЪЛНО РЪКОВОДСТВО (В #bot-info) ---
        await sendBotManual(guild).catch(err => console.log("Грешка при Manual msg:", err.message));

        // --- 2. SYSTEM STATUS (В #bot-only) ---
        const botChannel = guild.channels.cache.find(ch => ch.name === "bot-only");
        if (botChannel) {
            const aliveEmbed = new EmbedBuilder()
                .setTitle("📡 System Status: Online")
                .setDescription("🏴‍☠️ **The Captain is back on the deck!**\nAll systems are operational and the seas are under watch..")
                .setColor("#00ff00")
                .setTimestamp();

            await botChannel.send({ embeds: [aliveEmbed] }).catch(err => console.log("Грешка при Alive msg:", err.message));
        }
    });
});

// 5. Събитие: Логване на изтрити съобщения
client.on("messageDelete", async (message) => {
    await logDeletedMessage(message);
});

// 6. Събитие: Посрещане на нови членове
client.on("guildMemberAdd", async (member) => {
    await handleNewMember(member);
});

// 7. ОСНОВЕН СЛУШАТЕЛ
client.on("messageCreate", async (msg) => {
    console.log(`[DEBUG] Message in #${msg.channel.name}: "${msg.content}"`);
    if (msg.author.bot || !msg.guild) return;

if (msg.author.bot || !msg.guild) return;

    // --- 1. ПРОВЕРКА ЗА КОМАНДИ (СЛАГАМЕ Я НАЙ-ОТГОРЕ) ---
    // Ако съобщението започва с "!", ботът веднага отива към командите и ПРЕСКАЧА преводача
    if (msg.content.startsWith("!")) {
        const content = msg.content.trim();
        const args = content.split(/\s+/);
        const cmd = args.shift().toLowerCase();

        if (cmd === "!addrole" || cmd === "!removerole") {
            return await handleRoleCommands(msg, cmd, args);
        }

        return await handleCommands(msg, pool); // Тук се изпълнява !clear
    }
    
        // --- ЛОГИКА ЗА ПРЕВОД ---
    if (msg.channel.name === 'ai-translator') {
        if (translationCooldown.has(msg.author.id)) return;

        try {
            const analysis = await groq.chat.completions.create({
                messages: [
                    { 
                        role: "system", 
                        content: "Analyze language. If NOT English, translate to English. Respond ONLY JSON: {\"isEnglish\": boolean, \"detectedLang\": \"Language Name\", \"translatedText\": \"...\"}" 
                    },
                    { role: "user", content: msg.content }
                ],
                model: "llama-3.3-70b-versatile",
                response_format: { type: "json_object" }
            });

            const data = JSON.parse(analysis.choices[0].message.content);

            if (!data.isEnglish) {
                const expireTime = new Date();
                expireTime.setHours(expireTime.getHours() + 5);

                await pool.query(
                    "INSERT INTO translation_cache (user_id, last_lang, expires_at) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO UPDATE SET last_lang = $2, expires_at = $3",
                    [msg.author.id, data.detectedLang, expireTime]
                );

                await msg.reply(`🇺🇸 **English:** ${data.translatedText}`);
            } 
            else if (msg.reference) {
                try {
                    const repliedMessage = await msg.channel.messages.fetch(msg.reference.messageId);

                    const res = await pool.query(
                        "SELECT last_lang FROM translation_cache WHERE user_id = $1 AND expires_at > NOW()",
                        [repliedMessage.author.id]
                    );

                    // ВАЖНО: res.rows[0], защото е масив
                    if (res.rows.length > 0) {
                        const targetLang = res.rows[0].last_lang;

                        const backResult = await groq.chat.completions.create({
                            messages: [
                                { role: "system", content: `Translate to ${targetLang}. Only translation.` },
                                { role: "user", content: msg.content }
                            ],
                            model: "llama-3.3-70b-versatile"
                        });

                        await msg.reply(`🌍 **To ${targetLang}:** ${backResult.choices[0].message.content}`);
                    }
                } catch (err) {
                    console.error("Reply translation error:", err.message);
                }
            }

            translationCooldown.add(msg.author.id);
            setTimeout(() => translationCooldown.delete(msg.author.id), 5000);

        } catch (err) {
            console.error("Groq error:", err.message);
        }
        return;
    }

        // --- ЛОГИКА ЗА ЛЕКА НОЩ ---
    const nightRegex = /\b(good night|nighty night|gn)\b/i;
    // Проверяваме дали съобщението съдържа някоя от фразите (без значение малки/големи букви)
    if (nightRegex.test(msg.content.toLowerCase())) {
        const nightEmbed = new EmbedBuilder()
            .setTitle(`🌙 Good night, ${msg.author.username}!`)
            .setDescription("Rest well, pirate! The seas will be waiting for you tomorrow. 🏴‍☠️")
            .setColor("#2c3e50")
            // Ето един хубав One Piece GIF за лека нощ (Chopper или Luffy)
            .setImage("https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExMXl2amYzcXZxcml3Nm04dWJtN25qaGY2bWU0dmN3NmthcmdrOXZtMCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/F6bEXu79gwCENplJcB/giphy.gif");

        return msg.reply({ embeds: [nightEmbed] });
    }

    // --- ДРУГИ ФУНКЦИИ И КОМАНДИ ---
    const strategyEmbed = await captureStrategy(msg, pool);
    if (strategyEmbed) {
    await msg.react("📥");
    return msg.channel.send({ embeds: [strategyEmbed] }); // Това праща картинката и босовете веднага
}


    const content = msg.content.trim();
    const args = content.split(/\s+/);
    const cmd = args.shift().toLowerCase();

    if (cmd === "!addrole" || cmd === "!removerole") {
        return await handleRoleCommands(msg, cmd, args);
    }

    await handleCommands(msg, pool);
});

// 6. SHUTDOWN ЛОГИКА (ОПТИМИЗИРАНА)
async function sendFarewell(client) {
    const promises = [];
    console.log("🔍 Searching for bot-only channels...");

    for (const guild of client.guilds.cache.values()) {
        const logChannel = guild.channels.cache.find(ch => ch.name === "bot-only");
        if (logChannel) {
            // Събираме всички съобщения за пращане в масив
            promises.push(
                logChannel.send("⚓ **Captain's leaving the deck...** The ship is anchored. Offline.")
                .catch(err => console.error(`❌ Failed to send to ${guild.name}:`, err.message))
            );
        }
    }
    // Изчакваме всички съобщения да бъдат изпратени едновременно
    return Promise.all(promises);
}

async function gracefulShutdown() {
    console.log("🛑 Stopping bot sequence started...");
    
    try {
        // Изчакваме изпращането на съобщенията
        await sendFarewell(client);
        console.log("✅ Farewell messages sent successfully.");
    } catch (err) {
        console.error("⚠️ Error during farewell:", err.message);
    }
    
    // Малко изчакване за сигурност и изключване
    setTimeout(() => {
        console.log("🔌 Connection destroyed. Process exiting.");
        client.destroy();
        process.exit(0);
    }, 2000);
}

// Слушатели за спиране
// Това е сигналът, който Railway праща при рестарт или спиране
process.on('SIGTERM', async () => {
    console.log("Railway is stopping the bot... Starting graceful shutdown.");
    await gracefulShutdown();
});
process.on('SIGINT', gracefulShutdown);  // За ръчно спиране с Ctrl+C

// 8. Логване на бота
client.login(process.env.DISCORD_TOKEN);
