const { EmbedBuilder } = require("discord.js");
const heroesData = require("../data/heroes.json");
const staticReminders = require("../data/staticReminders");
const { isValidCron } = require("./scheduler");

async function handleCommands(msg, pool) {
    const content = msg.content.trim();
    const args = content.split(/\s+/);
    const cmd = args.shift().toLowerCase();

    // --- 1. КОМАНДА: !help (ПЪЛНОТО МЕНЮ С ВСИЧКИ ФУНКЦИИ) ---
    if (cmd === "!help") {
        const helpEmbed = new EmbedBuilder()
            .setTitle("🏴‍☠️ Sailing Kingdom - Full Help Menu")
            .setDescription("List of all available pirate commands and their usage:")
            .setColor("#00AE86")
            .addFields(
                { 
                    name: "💰 Bounty System", 
                    value: "`!wanted [@user]` - Show wanted poster.\n`!setbounty @user <amt>` - Set reward (Admin).\n`!resetbounty @user` - Reset reward (Admin)." 
                },
                { 
                    name: "⚔️ Heroes & Guides", 
                    value: "`!hero <name>` - Get guide (Only in #unit-build)." 
                },
                { 
                    name: "⏰ Reminders", 
                    value: "`!remind <cron> <msg>` - Set custom reminder.\n`!reminders` - List your reminders.\n`!allreminders` - View all schedules.\n`!delete <id>` - Remove reminder (Admin)." 
                },
                { 
                    name: "🎖️ Role Management (Admin)", 
                    value: "`!addrole @user <Role>` - Assign crew role.\n`!removerole @user <Role>` - Remove crew role." 
                },
                { 
                    name: "🧹 Moderation", 
                    value: "`!clear <1-100>` - Bulk delete messages." 
                }
            )
            .setFooter({ text: "Sailing Kingdom | London Time" })
            .setTimestamp();
        return msg.reply({ embeds: [helpEmbed] });
    }

    // --- 2. КОМАНДА: !hero (Гайдове за герои) ---
    if (cmd === "!hero") {
        if (msg.channel.name !== "unit-build") {
            const err = await msg.reply("❌ This command only works in #unit-build!");
            return setTimeout(() => { err.delete().catch(()=>{}); msg.delete().catch(()=>{}); }, 5000);
        }
        const heroName = args[0]?.toLowerCase(); // Взимаме името на героя
        const hero = heroesData[heroName];
        if (!hero) return msg.reply("❌ Hero not found in database!");

        const embed = new EmbedBuilder()
            .setTitle(hero.title)
            .setImage(hero.image)
            .setColor(hero.color || "#2b2d31")
            .addFields(
                { name: "Role", value: hero.role, inline: true },
                { name: "Seals", value: hero.seals, inline: false },
                { name: "Haki Rec", value: hero.haki || "N/A", inline: true }
            );
        return msg.channel.send({ embeds: [embed] });
    }

    // --- 3. КОМАНДА: !remind (Нов ремайндър) ---
    if (cmd === "!remind") {
        const targetCh = msg.guild.channels.cache.find(ch => ch.name === "reminders");
        if (!targetCh) return msg.reply("❌ No #reminders channel found!");
        if (args.length < 5) return msg.reply("❌ Usage: `!remind 0 12 * * * Message` ");

        const cronExpr = args.slice(0, 5).join(" ");
        const text = args.slice(5).join(" ");
        if (!isValidCron(cronExpr)) return msg.reply("❌ Invalid Cron format! Use spaces between stars.");

        try {
            const id = Date.now();
            await pool.query(
                "INSERT INTO reminders (id, cron, message, channel_id, owner_id) VALUES ($1, $2, $3, $4, $5)", 
                [id, cronExpr, text, targetCh.id, msg.author.id]
            );
            msg.reply(`✅ Reminder set for <#${targetCh.id}>. ID: \`${id}\``);
        } catch (err) { msg.reply("❌ Database error saving reminder."); }
    }

    // --- 4. КОМАНДА: !reminders (Динамични) ---
    if (cmd === "!reminders") {
        const res = await pool.query("SELECT * FROM reminders ORDER BY id ASC");
        const list = res.rows.map(r => `ID: \`${r.id}\` | \`${r.cron}\` | ${r.message}`).join("\n") || "No dynamic reminders.";
        return msg.reply("📋 **Dynamic Reminders:**\n" + list);
    }

    // --- 5. КОМАНДА: !allreminders (Всичко) ---
    if (cmd === "!allreminders") {
        const res = await pool.query("SELECT * FROM reminders ORDER BY id ASC");
        const dynamicList = res.rows.map(r => `ID: \`${r.id}\` | \`${r.cron}\` | ${r.message}`).join("\n") || "None";
        const staticList = staticReminders.map((r, i) => `Static ${i + 1} | \`${r.cron}\` | ${r.message}`).join("\n");
        const embed = new EmbedBuilder()
            .setTitle("📋 All Scheduled Events").setColor("#5865F2")
            .addFields({ name: "📌 Static Events", value: staticList }, { name: "⏰ Dynamic Reminders", value: dynamicList });
        return msg.reply({ embeds: [embed] });
    }

    // --- 6. КОМАНДА: !delete (САМО АДМИН) ---
    if (cmd === "!delete") {
        if (!msg.member.permissions.has("Administrator")) {
            return msg.reply("❌ Only Admirals can delete reminders!").then(m => setTimeout(() => m.delete().catch(()=>{}), 5000));
        }
        const id = args[0];
        if (!id) return msg.reply("❌ Usage: `!delete <id>`");
        try {
            const res = await pool.query("DELETE FROM reminders WHERE id = $1", [id]);
            if (res.rowCount === 0) return msg.reply("❌ ID not found.");
            return msg.reply(`🗑️ Reminder \`${id}\` has been deleted.`);
        } catch (err) { return msg.reply("❌ DB Error during deletion."); }
    }

    // --- 7. КОМАНДА: !wanted (Плакат) ---
    if (cmd === "!wanted") {
        const target = msg.mentions.users.first() || msg.author;
        try {
            const res = await pool.query("SELECT bounty FROM users WHERE user_id = $1", [target.id]);
            const bounty = res.rows.length > 0 ? res.rows[0].bounty : 0;
            const embed = new EmbedBuilder()
                .setTitle("🏴‍☠️ WANTED").setDescription(`**${target.username.toUpperCase()}**`)
                .addFields({ name: "REWARD", value: `฿ ${parseInt(bounty).toLocaleString()}` })
                .setColor("#E67E22").setThumbnail(target.displayAvatarURL({ dynamic: true }))
                .setFooter({ text: "DEAD OR ALIVE" });
            return msg.channel.send({ embeds: [embed] });
        } catch (err) { return msg.reply("❌ Error fetching bounty data."); }
    }

    // --- 8. КОМАНДА: !setbounty (АДМИН) ---
    if (cmd === "!setbounty") {
        if (!msg.member.permissions.has("Administrator")) return;
        const target = msg.mentions.users.first();
        const amount = parseInt(args[1]);
        if (!target || isNaN(amount)) return msg.reply("❌ Usage: `!setbounty @user 50000` ");
        try {
            await pool.query(
                "INSERT INTO users (user_id, bounty, username) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO UPDATE SET bounty = $2, username = $3", 
                [target.id, amount, target.username]
            );
            return msg.channel.send(`💰 **${target.username}**'s bounty is now **฿ ${amount.toLocaleString()}**!`);
        } catch (err) { return msg.reply("❌ DB Error setting bounty."); }
    }

    // --- 9. КОМАНДА: !resetbounty (АДМИН) ---
    if (cmd === "!resetbounty") {
        if (!msg.member.permissions.has("Administrator")) return;
        const target = msg.mentions.users.first();
        if (!target) return msg.reply("❌ Usage: `!resetbounty @user` ");
        try {
            await pool.query("DELETE FROM users WHERE user_id = $1", [target.id]);
            return msg.channel.send(`🗑️ **${target.username}**'s bounty has been reset to 0.`);
        } catch (err) { return msg.reply("❌ DB Error resetting bounty."); }
    }

    // --- 10. КОМАНДА: !clear ---
    if (cmd === "!clear" && msg.member.permissions.has("ManageMessages")) {
        const amount = parseInt(args[0]);
        if (amount > 0 && amount <= 100) await msg.channel.bulkDelete(amount, true);
    }
}

module.exports = { handleCommands };
