const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const cron = require("node-cron");
const { pool, initDB } = require("./utilities/db"); // Връзка с базата данни
const heroesData = require("./data/heroes.json");   // Данни за героите

// ================= CONFIG =================
const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

// ================= STATIC REMINDERS =================
// Списък с фиксирани напомняния. В "target" може да е име на роля или @everyone
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
    GatewayIntentBits.GuildMembers // Позволява на бота да търси хора по име
  ]
});

// ================= HELPERS =================
// Проверка дали Cron форматът е валиден
function isValidCron(cronExpr) {
  return typeof cronExpr === "string" && cron.validate(cronExpr);
}

// Превръща име на роля или потребител в реален таг (ping)
async function getMention(guild, target) {
  if (target === "@everyone" || target === "@here") return target;
  
  const role = guild.roles.cache.find(r => r.name.toLowerCase() === target.toLowerCase());
  if (role) return `<@&${role.id}>`;

  const member = guild.members.cache.find(m => 
    m.user.username.toLowerCase() === target.toLowerCase() || 
    m.displayName.toLowerCase() === target.toLowerCase()
  );
  if (member) return `<@${member.id}>`;

  return target;
}

// Стартира фиксираните напомняния от списъка по-горе
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

// Планира динамично напомняне от базата данни
async function scheduleDynamicReminder(reminder) {
  if (!isValidCron(reminder.cron)) return;

  cron.schedule(reminder.cron, async () => {
    const channel = client.channels.cache.get(reminder.channel_id);
    if (channel) {
      await channel.send(`${reminder.message}`);
    }
  }, { timezone: "Europe/London" });
}

// Зарежда всички записани напомняния от базата данни при старт
async function startDynamicReminders() {
  try {
    const res = await pool.query("SELECT * FROM reminders");
    res.rows.forEach(rem => scheduleDynamicReminder(rem));
  } catch (err) {
    console.error("Error loading dynamic reminders:", err.message);
  }
}

// ================= COMMANDS & MODERATION =================
client.on("messageCreate", async message => {
  if (message.author.bot) return;

  // Логика за канали, в които са позволени само снимки
  if (message.channel.topic && message.channel.topic.includes("photos")) {
    if (message.attachments.size === 0) {
      try {
        await message.delete();
        const warning = await message.channel.send(`${message.author}, only photos allowed here! 📸`);
        return setTimeout(() => warning.delete().catch(() => {}), 5000);
      } catch (err) { console.error("Delete error:", err.message); }
    }
  }

  const content = message.content.trim();
  const args = content.split(/\s+/);
  const command = args[0].toLowerCase();

  // Команда за гайдове на герои: !hero <име>
  if (command === "!hero") {
    const heroName = args[1]?.toLowerCase();
    const hero = heroesData[heroName];

    if (!hero) return message.reply("❌ Hero not found! Check the spelling.");

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

  // Команда за добавяне на напомняне: !remind <cron> <съобщение>
  if (command === "!remind") {
    if (args.length < 7) {
      return message.reply("❌ Usage: `!remind <min> <hour> <day> <month> <weekday> <message + @tags>`");
    }
    const cronTime = args.slice(1, 6).join(" ");
    const text = args.slice(6).join(" ");

    if (!isValidCron(cronTime)) return message.reply("❌ Invalid Cron format!");
    const id = Date.now();

    try {
      await pool.query(
        "INSERT INTO reminders (id, cron, message, channel_id, owner_id) VALUES ($1, $2, $3, $4, $5)",
        [id, cronTime, text, message.channel.id, message.author.id]
      );
      scheduleDynamicReminder({ id, cron: cronTime, message: text, channel_id: message.channel.id, owner_id: message.author.id });
      return message.reply(`✅ Reminder set! ID: \`${id}\``);
    } catch (err) {
      console.error("DB error:", err.message);
      return message.reply("❌ Database error.");
    }
  }

  // Команда за изтриване на напомняне: !delete <id>
  if (command === "!delete") {
    const id = args[1];
    if (!id) return message.reply("❌ Usage: `!delete <id>`");
    try {
      const res = await pool.query("DELETE FROM reminders WHERE id = $1", [id]);
      return message.reply(res.rowCount === 0 ? "❌ ID not found." : "🗑️ Reminder deleted.");
    } catch (err) { return message.reply("❌ Error deleting from DB."); }
  }

  // Команда за масово изтриване на съобщения: !clear <брой>
  if (command === "!clear") {
    if (!message.member.permissions.has("ManageMessages")) return;
    const amount = parseInt(args[1]);
    if (isNaN(amount) || amount < 1 || amount > 100) return message.reply("Enter a number between 1 and 100.");
    await message.channel.bulkDelete(amount, true).catch(err => console.error(err));
  }
});

// ================= READY =================
client.once("ready", async () => {
  console.log(`🤖 Bot is online as ${client.user.tag}`);
  await initDB();
  startStaticReminders();
  startDynamicReminders();
});

client.login(TOKEN);
