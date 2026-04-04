const { EmbedBuilder } = require("discord.js");
const heroesData = require("../data/heroes.json");
const staticReminders = require("../data/staticReminders");
const { isValidCron } = require("./scheduler");
const { updateBountyRole } = require("./roleHandler"); // Вмъкваме автоматичната смяна на роли

async function handleCommands(msg, pool) {
    const content = msg.content.trim();
    const args = content.split(/\s+/);
    const cmd = args.shift().toLowerCase();

   // --- 1. КОМАНДА: !help ---
if (cmd === "!help") {
    const helpEmbed = new EmbedBuilder()
        .setTitle("🏴‍☠️ Sailing Kingdom - Command Manual")
        .setDescription("Welcome aboard! Here are all the tools available to our crew:")
        .setColor("#00AE86") // Зеленият цвят, който ползваш
        .addFields(
            { 
                name: "🌐 AI Translation System", 
                value: "• **Auto:** Write in any language in `#ai-translator` for 🇺🇸 English.\n• **Reply:** Reply to a message in English to translate it back.\n• *Available in: #ai-translator*" 
            },
            { 
                name: "💰 Bounty System", 
                value: "• `!wanted [@user]` - Show wanted poster.\n• `!setbounty @user <amt>` - Set reward & role (Admin).\n• `!resetbounty @user` - Reset reward & role (Admin)." 
            },
            { 
                name: "⚔️ Heroes & Guides", 
                value: "• `!hero <name>` - Get guide (Only in `#unit-build`)." 
            },
            { 
                name: "⏰ Reminders", 
                value: "• `!remind <cron> <msg>` - Set custom reminder.\n• `!reminders` - List your reminders.\n• `!allreminders` - View all schedules.\n• `!delete <id>` - Remove reminder (Admin)." 
            },
            { 
                name: "🎖️ Role Management (Admin)", 
                value: "• `!addrole @user <Role>` - Assign crew role.\n• `!removerole @user <Role>` - Remove crew role." 
            },
            { 
                name: "🧹 Moderation", 
                value: "• `!clear <1-100>` - Bulk delete messages (Admin)." 
            }
        )
        .setFooter({ text: "Sailing Kingdom | Official Bot Guide" })
        .setTimestamp();

    return msg.reply({ embeds: [helpEmbed] });
}

    // --- 2. КОМАНДА: !hero ---
if (cmd === "!hero") {
    // 1. Проверка за канала
    if (msg.channel.name !== "unit-build") {
        const err = await msg.reply("❌ This command only works in #unit-build!");
        return setTimeout(() => { err.delete().catch(()=>{}); msg.delete().catch(()=>{}); }, 5000);
    }

    // 2.1Вземаме данните от JSON файла (ползваме функцията за презареждане)
    const heroesData = getHeroes(); 

    // 2.2. ПРОВЕРКА ЗА ПРАЗЕН АРГУМЕНТ:
    // Използваме args.length === 0, за да разберем дали потребителят е написал само !hero
    if (!args || args.length === 0 || !args[0]) {
        const heroList = Object.keys(heroesData).sort().join(", ");
        
        const listEmbed = new EmbedBuilder()
            .setTitle("📜 Available Heroes")
            .setColor("#00AE86")
            .setDescription(`Use \`!hero <name>\` for a guide.\n\n**List:** ${heroList}`)
            .setFooter({ text: "Sailing Kingdom Database" });

        return msg.reply({ embeds: [listEmbed] });
    }

    // 2.3. ТЪРСЕНЕ НА ГЕРОЙ:
    const heroName = args[0].toLowerCase(); // Вземаме първата дума след !hero
    const hero = heroesData[heroName];

    if (!hero) {
        return msg.reply(`❌ Hero **${heroName}** not found! Type \`!hero\` for the full list.`);
    }

    // 2.4. ПОКАЗВАНЕ НА ГЕРОЯ:
    const embed = new EmbedBuilder()
        .setTitle(hero.title)
        .setImage(hero.image) // Тук сложи директен .gif линк в JSON-а!
        .setColor(hero.color || "#2b2d31")
        .addFields(
            { name: "Role", value: hero.role || "N/A", inline: true },
            { name: "Seals", value: hero.seals || "N/A", inline: false },
            { name: "Haki Rec", value: hero.haki || "N/A", inline: true }
        );

    return msg.channel.send({ embeds: [embed] });
}


    // --- 3. КОМАНДА: !remind ---
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

    // --- 4. КОМАНДА: !reminders ---
    if (cmd === "!reminders") {
        const res = await pool.query("SELECT * FROM reminders ORDER BY id ASC");
        const list = res.rows.map(r => `ID: \`${r.id}\` | \`${r.cron}\` | ${r.message}`).join("\n") || "No dynamic reminders.";
        return msg.reply("📋 **Dynamic Reminders:**\n" + list);
    }

    // --- 5. КОМАНДА: !allreminders ---
    if (cmd === "!allreminders") {
        const res = await pool.query("SELECT * FROM reminders ORDER BY id ASC");
        const dynamicList = res.rows.map(r => `ID: \`${r.id}\` | \`${r.cron}\` | ${r.message}`).join("\n") || "None";
        const staticList = staticReminders.map((r, i) => `Static ${i + 1} | \`${r.cron}\` | ${r.message}`).join("\n");
        const embed = new EmbedBuilder()
            .setTitle("📋 All Scheduled Events").setColor("#5865F2")
            .addFields({ name: "📌 Static Events", value: staticList }, { name: "⏰ Dynamic Reminders", value: dynamicList });
        return msg.reply({ embeds: [embed] });
    }

    // --- 6. КОМАНДА: !delete ---
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

               // --- 7. КОМАНДА: !wanted (УКРАСЕН ПЛАКАТ) ---
if (cmd === "!wanted") {
    // 1. Намираме канала "bounties" в сървъра
    const bountyChannel = msg.guild.channels.cache.find(ch => ch.name === "bounties");

    // 2. Проверка дали каналът съществува
    if (!bountyChannel) {
        return msg.reply("❌ Error: Channel named `bounties` not found! Please create it first.");
    }
    
    const target = msg.mentions.users.first() || msg.author;
    
    try {
        const res = await pool.query("SELECT bounty FROM users WHERE user_id = $1", [target.id]);
        const bounty = res.rows.length > 0 ? res.rows[0].bounty : 0;

        const embed = new EmbedBuilder()
            .setTitle("☠️ W A N T E D ☠️")
            .setAuthor({ 
                name: "MARINE HEADQUARTERS", 
                iconURL: "https://imgur.com" // Примерно лого на маринците
            })
            .setDescription(`\n**NAME:** ${target.username.toUpperCase()}\n━━━━━━━━━━━━━━━━━━`)
            .addFields(
                { name: "💰 REWARD", value: `**฿ ${parseInt(bounty).toLocaleString()}**`, inline: true },
                { name: "📜 STATUS", value: "🔴 **DEAD OR ALIVE**", inline: true }
            )
            .setColor("#E67E22")
            .setImage(target.displayAvatarURL({ dynamic: true, size: 512 }))
            .setFooter({ 
                text: "By order of the World Government", 
                iconURL: "https://imgur.com" 
            })
            .setTimestamp();

        // 3. Изпращаме плаката в канала "bounties"
        await bountyChannel.send({ embeds: [embed] });

        // 4. Потвърждаваме на потребителя, че плакатът е готов
        return msg.reply(`✅ The poster for **${target.username}** has been posted in ${bountyChannel}!`);

    } catch (err) { 
        console.error(err);
        return msg.reply("❌ Error fetching bounty data from the database."); 
    }
}

    // --- 8. КОМАНДА: !setbounty (С АВТОМАТИЧНА РОЛЯ) ---
    if (cmd === "!setbounty") {
        if (!msg.member.permissions.has("Administrator")) return;
        const targetUser = msg.mentions.users.first();
        const targetMember = msg.mentions.members.first();
        const amount = parseInt(args[1]);

        if (!targetUser || isNaN(amount)) return msg.reply("❌ Usage: `!setbounty @user 50000000` ");
        
        try {
            await pool.query(
                "INSERT INTO users (user_id, bounty, username) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO UPDATE SET bounty = $2, username = $3", 
                [targetUser.id, amount, targetUser.username]
            );

            // Обновяваме цветната роля според сумата
            const newRank = await updateBountyRole(targetMember, amount);

            let response = `💰 **${targetUser.username}**'s bounty set to **฿ ${amount.toLocaleString()}**!`;
            if (newRank) response += `\n🎖️ New Rank: **${newRank}**`;
            
            return msg.channel.send(response);
        } catch (err) { return msg.reply("❌ DB Error setting bounty."); }
    }

    // --- 9. КОМАНДА: !resetbounty (С МАХАНЕ НА РОЛИ) ---
    if (cmd === "!resetbounty") {
        if (!msg.member.permissions.has("Administrator")) return;
        const targetMember = msg.mentions.members.first();
        if (!targetMember) return msg.reply("❌ Usage: `!resetbounty @user` ");
        
        try {
            await pool.query("DELETE FROM users WHERE user_id = $1", [targetMember.id]);
            
            // Махаме всички Bounty роли
            await updateBountyRole(targetMember, 0);

            return msg.channel.send(`🗑️ **${targetMember.user.username}**'s bounty reset to 0 and roles removed.`);
        } catch (err) { return msg.reply("❌ DB Error resetting bounty."); }
    }

    // --- 10. КОМАНДА: !clear ---
    if (cmd === "!clear" && msg.member.permissions.has("ManageMessages")) {
        const amount = parseInt(args[0]);
        if (amount > 0 && amount <= 100) await msg.channel.bulkDelete(amount, true);
    }
}

module.exports = { handleCommands };
