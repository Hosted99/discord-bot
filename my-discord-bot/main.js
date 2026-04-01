const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const cron = require("node-cron");
const { pool, initDB } = require("./utilities/db");
const heroesData = require("./data/heroes.json");
const staticReminders = require("./data/staticReminders"); // Внасяме статичния списък

const TOKEN = process.env.DISCORD_TOKEN;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers 
  ]
});

// ================= HELPERS =================
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

// ================= SCHEDULERS =================

// Статични напомняния (Mania, Shandora и т.н.)
function startStaticReminders() {
  staticReminders.forEach(reminder => {
    if (!isValidCron(reminder.cron)) return;
    cron.schedule(reminder.cron, async () => {
      client.guilds.cache.forEach(async (guild) => {
        const channel = guild.channels.cache.find(ch => ch.name === "reminders");
        if (channel) {
          const mention = await getMention(guild, reminder.target);
          await channel.send(`${mention} ${reminder.message}`);
        }
      });
    }, { timezone: "Europe/London" });
  });
}

// Динамични напомняния (тези от !remind)
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
  } catch (err) { console.error("Error loading dynamic reminders:", err.message); }
}

// ================= COMMANDS =================

client.on("messageCreate", async message => {
  if (message.author.bot || !message.guild) return;

  const content = message.content.trim();
  const args = content.split(/\s+/);
  const command = args.shift().toLowerCase();

  // --- 1. !hero <name> (САМО в #unit-build) ---
  if (command === "!hero") {
    if (message.channel.name !== "unit-build") {
        const err = await message.reply("❌ This command only works in #unit-build!");
        return setTimeout(() => { err.delete().catch(()=>{}); message.delete().catch(()=>{}); }, 5000);
    }
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

  // --- 2. !remind <cron> <message> (Може отвсякъде, праща в #reminders) ---
  if (command === "!remind") {
    const targetChannel = message.guild.channels.cache.find(ch => ch.name === "reminders");
    if (!targetChannel) return message.reply("❌ Error: No channel named `reminders` found!");

    if (args.length < 6) return message.reply("❌ Usage: `!remind 0 12 * * * Message` ");
    const cronTime = args.slice(0, 5).join(" ");
    const text = args.slice(5).join(" ");

    if (!isValidCron(cronTime)) return message.reply("❌ Invalid Cron format!");

    try {
      const id = Date.now();
      await pool.query(
        "INSERT INTO reminders (id, cron, message, channel_id, owner_id) VALUES ($1, $2, $3, $4, $5)",
        [id, cronTime, text, targetChannel.id, message.author.id]
      );
      scheduleDynamicReminder({ id, cron: cronTime, message: text, channel_id: targetChannel.id, owner_id: message.author.id });
      return message.reply(`✅ Reminder set! It will be sent in <#${targetChannel.id}>`);
    } catch (err) { return message.reply("❌ DB Error."); }
  }

  // --- 3. !reminders (Списък с динамични) ---
  if (command === "!reminders") {
    try {
      const res = await pool.query("SELECT * FROM reminders ORDER BY id ASC");
      if (res.rows.length === 0) return message.reply("📭 No dynamic reminders yet.");
      const list = res.rows.map(r => `ID: \`${r.id}\` | \`${r.cron}\` | ${r.message}`).join("\n");
      return message.reply("📋 **Dynamic Reminders:**\n" + list);
    } catch (err) { return message.reply("❌ Error reading from DB."); }
  }

  // --- 4. !allreminders (Статични + Динамични) ---
  if (command === "!allreminders") {
    try {
      const res = await pool.query("SELECT * FROM reminders ORDER BY id ASC");
      const dynamicList = res.rows.map(r => `ID: \`${r.id}\` | \`${r.cron}\` | ${r.message}`).join("\n") || "None";
      const staticList = staticReminders.map((r, i) => `Static ${i + 1} | \`${r.cron}\` | ${r.message}`).join("\n");
      
      const embed = new EmbedBuilder()
        .setTitle("📋 All Bot Reminders")
        .addFields(
            { name: "📌 Static (Fixed Events)", value: staticList },
            { name: "⏰ Dynamic (User Created)", value: dynamicList }
        )
        .setColor("#5865F2");

      return message.reply({ embeds: [embed] });
    } catch (err) { return message.reply("❌ Error fetching all reminders."); }
  }

  // --- 5. !delete <id> ---
  if (command === "!delete") {
    const id = args[0];
    if (!id) return message.reply("❌ Usage: `!delete <id>`");
    const res = await pool.query("DELETE FROM reminders WHERE id = $1", [id]);
    return message.reply(res.rowCount === 0 ? "❌ ID not found." : "🗑️ Deleted!");
  }

  // --- 6. !clear <1-100> ---
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
