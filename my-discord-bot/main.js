const Groq = require("groq-sdk");
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const { pool, initDB } = require("./utilities/db");
const { initSchedulers, captureStrategy } = require("./utilities/scheduler");
const { handleCommands } = require("./utilities/commandHandler");
const { handleSpecialChannels } = require("./utilities/specialChannels");
const { handleNewMember, handleRoleCommands } = require("./utilities/roleHandler");
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
        const botChannel = guild.channels.cache.find(ch => ch.name === "bot-only");
        if (botChannel) {
            const aliveEmbed = new EmbedBuilder()
                .setTitle("📡 System Status: Online")
                .setDescription("🏴‍☠️ **The Captain is back on the deck!**\nAll systems are operational.")
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
    const nightWords = ["good night", "nighty night", "gn"];
    // Проверяваме дали съобщението съдържа някоя от фразите (без значение малки/големи букви)
    if (nightWords.some(word => msg.content.toLowerCase().includes(word))) {
        const nightEmbed = new EmbedBuilder()
            .setTitle(`🌙 Good night, ${msg.author.username}!`)
            .setDescription("Rest well, pirate! The seas will be waiting for you tomorrow. 🏴‍☠️")
            .setColor("#2c3e50")
            // Ето един хубав One Piece GIF за лека нощ (Chopper или Luffy)
            .setImage("https://tenor.com/bg/gif-maker?caption_item_id=15413086096180864098&utm_source=gif-caption&utm_medium=internal&utm_campaign=gif-maker-entrypoints.gif");

        return msg.reply({ embeds: [nightEmbed] });
    }

    // --- ДРУГИ ФУНКЦИИ И КОМАНДИ ---
    if (captureStrategy(msg.content)) return msg.react("📥");
    if (await handleSpecialChannels(msg)) return;

    const content = msg.content.trim();
    const args = content.split(/\s+/);
    const cmd = args.shift().toLowerCase();

    if (cmd === "!addrole" || cmd === "!removerole") {
        return await handleRoleCommands(msg, cmd, args);
    }

    await handleCommands(msg, pool);
});

// 8. Логване на бота
client.login(process.env.DISCORD_TOKEN);
