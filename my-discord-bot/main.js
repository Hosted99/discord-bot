const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const cron = require("node-cron");
const { pool, initDB } = require("./utilities/db");
const heroesData = require("./data/heroes.json");
const staticReminders = require("./data/staticReminders"); // Внасяме статичните тук

const TOKEN = process.env.DISCORD_TOKEN;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers 
  ]
});

// --- ПОМОЩНИ ФУНКЦИИ ---
function isValidCron(cronExpr) {
  return typeof cronExpr === "string" && cron.validate(cronExpr);
}

async function getMention(guild, target) {
  if (target === "@everyone" || target === "@here") return target;
  const role = guild.roles.cache.find(r => r.name.toLowerCase() === target.toLowerCase());
  if (role) return `<@&${role.id}>`;
  const member = guild.members.cache.find(m => 
    m.user.username.toLowerCase() === target.toLowerCase() || 
    m.displayName.toLowerCase() === target.toLowerCase()
  );
  return member ? `<@${member.id}>` : target;
}

// --- СТАТИЧНИ РЕМАЙНДЪРИ (Мулти-сървърни) ---
function startStaticReminders() {
  staticReminders.forEach(reminder => {
    if (!isValidCron(reminder.cron)) return;

    cron.schedule(reminder.cron, async () => {
      client.guilds.cache.forEach(async (guild) => {
        // Търсим канал само с име "reminders"
        const channel = guild.channels.cache.find(ch => ch.name === "reminders");
        if (channel) {
          const mention = await getMention(guild, reminder.target);
          await channel.send(`${mention} ${reminder.message}`);
        }
      });
    }, { timezone: "Europe/London" });
  });
}

// --- ДИНАМИЧНИ РЕМАЙНДЪРИ ---
async function scheduleDynamicReminder(reminder) {
  if (!isValidCron(reminder.cron)) return;
  cron.schedule(reminder.cron, async () => {
    const channel = client.channels.cache.get(reminder.channel_id);
    if (channel) await channel.send(`${reminder.message}`);
  }, { timezone: "Europe/London" });
}

async function startDynamicReminders() {
  try {
    const res = await pool.query("SELECT * FROM reminders");
    res.rows.forEach(rem => scheduleDynamicReminder(rem));
  } catch (err) { console.error(err.message); }
}

// --- СЪБИТИЯ И КОМАНДИ ---
client.on("messageCreate", async message => {
  if (message.author.bot || !message.guild) return;

  const content = message.content.trim();
  const args = content.split(/\s+/);
  const command = args.shift().toLowerCase();

  // ********************************************************
  // ЗАЩИТА: Ботът реагира САМО в тези две стаи
  // ********************************************************
  const allowedChannels = ["reminders", "unit-build"];
  if (!allowedChannels.includes(message.channel.name)) {
      // Ако каналът е "photos-only", трием съобщението без да отговаряме
      if (message.channel.topic?.includes("photos") && message.attachments.size === 0) {
          await message.delete().catch(() => {});
      }
      return; // Спираме дотук - ботът няма да изпълни нито една команда
  }

  // --- КОМАНДА: !hero (САМО в #unit-build) ---
  if (command === "!hero") {
    if (message.channel.name !== "unit-build") return;
    
    const heroName = args[0]?.toLowerCase();
    const hero = heroesData[heroName];
    if (!hero) return message.reply("❌ Hero not found!");

    const embed = new EmbedBuilder()
      .setTitle(hero.title)
      .setColor(hero.color || "#2b2d31")
      .addFields(
        { name: "⚔️ Role", value: hero.role, inline: true },
        { name: "🛡️ Seals", value: hero.seals, inline: false },
        { name: "📜 Haki Rec", value: hero.haki, inline: true }
      )
      .setImage(hero.image);

    return message.channel.send({ embeds: [embed] });
  }

  // --- КОМАНДА: !remind (САМО в #reminders) ---
  if (command === "!remind") {
    if (message.channel.name !== "reminders") return;

    if (args.length < 6) return message.reply("❌ Usage: `!remind 0 12 * * * Lunch!`");
    
    const cronTime = args.slice(0, 5).join(" ");
    const text = args.slice(5).join(" ");

    if (!isValidCron(cronTime)) return message.reply("❌ Invalid Cron!");

    try {
      const id = Date.now();
      await pool.query(
        "INSERT INTO reminders (id, cron, message, channel_id, owner_id) VALUES ($1, $2, $3, $4, $5)",
        [id, cronTime, text, message.channel.id, message.author.id]
      );
      scheduleDynamicReminder({ id, cron: cronTime, message: text, channel_id: message.channel.id, owner_id: message.author.id });
      return message.reply(`✅ Reminder set in <#${message.channel.id}>`);
    } catch (err) { return message.reply("❌ DB Error."); }
  }

  // --- КОМАНДА: !clear ---
  if (command === "!clear") {
    if (!message.member.permissions.has("ManageMessages")) return;
    const amount = parseInt(args[0]);
    if (amount > 0 && amount <= 100) await message.channel.bulkDelete(amount, true);
  }
});

client.once("ready", async () => {
  console.log(`🤖 Bot is online!`);
  await initDB();
  startStaticReminders();
  startDynamicReminders();
});

client.login(TOKEN);
