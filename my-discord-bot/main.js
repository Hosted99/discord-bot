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

// 2. Инициализация на клиента
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers
    ]
});

// 3. Сървър за поддръжка на хостинга
const http = require('http');
const port = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Bot is running!');
}).listen(port);

console.log(`Monitoring server started on port ${port}`);

// 4. Събитие: Ready
client.once("ready", async () => {
    await initDB();
    initSchedulers(client, pool);
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

// 5. Логване на изтрити съобщения
client.on("messageDelete", async (message) => {
    await logDeletedMessage(message);
});

// 6. Посрещане на нови членове
client.on("guildMemberAdd", async (member) => {
    await handleNewMember(member);
});

// 7. ОСНОВЕН СЛУШАТЕЛ
client.on("messageCreate", async (msg) => {
    if (msg.author.bot || !msg.guild) return;

        // --- ЛОГИКА ЗА ПРЕВОД (КАНАЛ "ai-translator") ---
    if (msg.channel.name === 'ai-translator') {
        if (translationCooldown.has(msg.author.id)) return;

        try {
            // 1. Проверка в базата за предишен език
            const res = await pool.query(
                "SELECT last_lang FROM translation_cache WHERE user_id = $1 AND expires_at > NOW()",
                [msg.author.id]
            );

            // 2. АНАЛИЗ И ПРЕВОД КЪМ АНГЛИЙСКИ
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
                // Ако е френски/български и т.н. -> Записваме го
                const expireTime = new Date();
                expireTime.setHours(expireTime.getHours() + 5);

                await pool.query(
                    "INSERT INTO translation_cache (user_id, last_lang, expires_at) " +
                    "VALUES ($1, $2, $3) ON CONFLICT (user_id) " +
                    "DO UPDATE SET last_lang = $2, expires_at = $3",
                    [msg.author.id, data.detectedLang, expireTime]
                );
                await msg.reply(`🇺🇸 **English:** ${data.translatedText}`);
            } 
            else if (res.rows.length > 0) {
                // ТУК БЕШЕ ГРЕШКАТА: Трябва да вземем първия ред от масива
                const targetLang = res.rows[0].last_lang;
                
               const backResult = await groq.chat.completions.create({
                messages: [
                { 
                    role: "system", 
                    content: `You are a translator. Translate the user's message to ${targetLang}. Provide ONLY the translation.` 
                },
                { role: "user", content: msg.content }
            ],
        model: "llama-3.3-70b-versatile"
});

// Тук също трябва индекс [0], за да вземеш текста
          await msg.reply(`🌍 **To ${targetLang}:** ${backResult.choices[0].message.content}`);
    

            translationCooldown.add(msg.author.id);
            setTimeout(() => translationCooldown.delete(msg.author.id), 5000);

        } catch (err) {
            console.error("Грешка при превод:", err);
        }
        return;
    }


    // --- ДРУГИ ФУНКЦИИ ---
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

// 8. Login
client.login(process.env.DISCORD_TOKEN);
