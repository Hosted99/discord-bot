const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const cron = require("node-cron");
const { pool, initDB } = require("./utilities/db"); // Път към помощния файл за БД
const heroesData = require("./data/heroes.json");   // Твоят склад за 100+ герои

// ================= CONFIG =================
const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

// ================= STATIC REMINDERS =================
// Тук в "target" пишеш име на роля, потребител или @everyone
const staticReminders = [
  { cron: "0 14 * * 2,4", message: "Shandora is open!", target: "Marika" },
  { cron: "0 12 * * 2,5", message: "Belly Rush today!", target: "Mugi" },
  { cron: "0 12 * * 3,5,0", message: "Mania today!", target: "@everyone" },
  { cron: "45 21 * * 3,5,0", message: "15 min until Mania starts!", target: "@everyone" },
  { cron: "0 22 * * 3,5,0", message: "Mania is open!", target: "@everyone" }
];

// ================= BOT SETUP =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers // ВАЖНО: Трябва да е включено в Discord Developer Portal!
  ]
});

// ================= HELPERS =================
function isValidCron(cronExpr) {
  return typeof cronExpr === "string" && cron.validate(cronExpr);
}

// Функция за превръщане на име в таг (Mention)
async function getMention(guild, target) {
  if (target === "@everyone" || target === "@here") return target;
  
  // 1. Търси роля по име
  const role = guild.roles.cache.find(r => r.name.toLowerCase() === target.toLowerCase());
  if (role) return `<@&${role.id}>`;

  // 2. Търси потребител по име/никнейм
  const member = guild.members.cache.find(m => 
    m.user.username.toLowerCase() === target.toLowerCase() || 
    m.displayName.toLowerCase() === target.toLowerCase()
  );
  if (member) return `<@${member.id}>`;

  return target; // Връща само текст, ако нищо не намери
}

// Стартиране на фиксираните ремайндъри
function startStaticReminders() {
  staticReminders.forEach(reminder => {
    if (!isValidCron(reminder.cron)) return;

    cron.schedule(reminder.cron, async () => {
      const channel = client.channels.cache.get(CHANNEL_ID);
      if (!channel) return;

      const mention = await getMention(channel.guild, reminder.target);
      await channel.send(`${mention} ${reminder.message}`);
    }, { timezone: "Europe/London" });
  });
}

// Стартиране на ремайндър от базата данни
async function scheduleDynamicReminder(reminder) {
  if (!isValidCron(reminder.cron)) return;

  cron.schedule(reminder.cron, async () => {
    const channel = client.channels.cache.get(reminder.channel_id);
    if (channel) {
      // Изпраща директно съобщението (така работят таговете вътре в него)
      await channel.send(`${reminder.message}`);
    }
  }, { timezone: "Europe/London" });
}

async function startDynamicReminders() {
  try {
    const res = await pool.query("SELECT * FROM reminders");
    res.rows.forEach(rem => scheduleDynamicReminder(rem));
  } catch (err) {
    console.error("Грешка при зареждане на динамични ремайндъри:", err.message);
  }
}

// ================= COMMANDS & MODERATION =================
client.on("messageCreate", async message => {
  if (message.author.bot) return;

  // --- PHOTOS ONLY LOGIC ---
  if (message.channel.topic && message.channel.topic.includes("photos")) {
    if (message.attachments.size === 0) {
      try {
        await message.delete();
        const warning = await message.channel.send(`${message.author}, тук само снимки! 📸`);
        return setTimeout(() => warning.delete().catch(() => {}), 5000);
      } catch (err) { console.error("Delete error:", err.message); }
    }
  }

  const content = message.content.trim();
  const args = content.split(/\s+/);
  const command = args[0].toLowerCase();

  // --- !hero <name> ---
  if (command === "!hero") {
    const heroName = args[1]?.toLowerCase();
    const hero = heroesData[heroName];

    if (!hero) return message.reply("❌ Героят не е намерен! Провери името.");

    const embed = new EmbedBuilder()
      .setTitle(hero.title)
      .setColor(hero.color || "#2b2d31")
      .addFields(
        { name: "⚔️ Role", value: hero.role, inline: true },
        { name: "🛡️ Seals", value: hero.seals, inline: false },
        { name: "📜 Haki Rec", value: hero.haki, inline: true }
      )
      .setImage(hero.image)
      .setFooter({ text: "Sailing Kingdom Guide" });

    return message.channel.send({ embeds: [embed] });
  }

  // --- !remind <cron> <message with mentions> ---
  if (command === "!remind") {
    if (args.length < 7) {
      return message.reply("❌ Формат: `!remind <min> <hour> <day> <month> <weekday> <съобщение + @тагове>`");
    }
    const cronTime = args.slice(1, 6).join(" ");
    const text = args.slice(6).join(" ");

    if (!isValidCron(cronTime)) return message.reply("❌ Невалиден Cron формат!");
    const id = Date.now();

    try {
      await pool.query(
        "INSERT INTO reminders (id, cron, message, channel_id, owner_id) VALUES ($1, $2, $3, $4, $5)",
        [id, cronTime, text, message.channel.id, message.author.id]
      );
      scheduleDynamicReminder({ id, cron: cronTime, message: text, channel_id: message.channel.id, owner_id: message.author.id });
      return message.reply(`✅ Добавен ремайндър! ID: \`${id}\``);
    } catch (err) {
      console.error("DB error:", err.message);
      return message.reply("❌ Грешка при запис в базата.");
    }
  }

  // --- !delete <id> ---
  if (command === "!delete") {
    const id = args[1];
    if (!id) return message.reply("❌ Usage: `!delete <id>`");
    try {
      const res = await pool.query("DELETE FROM reminders WHERE id = $1", [id]);
      return message.reply(res.rowCount === 0 ? "❌ ID не е намерен." : "🗑️ Ремайндърът е изтрит.");
    } catch (err) { return message.reply("❌ Грешка при изтриване."); }
  }

  // --- !clear <1-100> ---
  if (command === "!clear") {
    if (!message.member.permissions.has("ManageMessages")) return;
    const amount = parseInt(args[1]);
    if (isNaN(amount) || amount < 1 || amount > 100) return message.reply("Въведи число 1-100.");
    await message.channel.bulkDelete(amount, true).catch(err => console.error(err));
  }
});

// ================= READY =================
client.once("ready", async () => {
  console.log(`🤖 Ботът е онлайн: ${client.user.tag}`);
  await initDB();
  startStaticReminders();
  startDynamicReminders();
});

client.login(TOKEN);
