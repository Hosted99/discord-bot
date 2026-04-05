const { EmbedBuilder } = require("discord.js");

/**
 * Функция за изпращане на пълното ръководство в #bot-info
 */
const sendBotManual = async (guild) => {
    // 1. Намираме канала по име
    const infoChannel = guild.channels.cache.find(ch => ch.name === "bot-info");
    if (!infoChannel) return;

    // 2. Изчистваме старите съобщения (до 100), за да е винаги чисто и подредено
    await infoChannel.bulkDelete(100).catch(() => {});

    // 3. Създаваме основния Embed с абсолютно всички системи
    const manualEmbed = new EmbedBuilder()
        .setTitle("🏴‍☠️ Sailing Kingdom | Complete Bot Manual")
        .setDescription("Welcome aboard! Here is the complete guide to all automated systems and commands on our ship:")
        .setColor("#ff0044") // Твоето червено
        .setThumbnail(guild.iconURL({ dynamic: true })) // Иконата на сървъра
        .addFields(
            { 
                name: "🌐 1. AI Translator (#ai-translator)", 
                value: "• **Auto-Translate:** Write in any language; I'll instantly translate it to 🇺🇸 **English**.\n" +
                       "• **Reverse Translation:** Reply to a translated message in English to translate it back to the original author's language."
            },
            { 
                name: "⚔️ 2. Mania Strategy System", 
                value: "• **Recording:** Type `mania-strategy <text>` anywhere. I'll react with 📥.\n" +
                       "• **19:25 (London):** I'll post the strategy in <#mania-reminder> with `@everyone` and a poll (✅).\n" +
                       "• **20:00 (London):** Audit time! I'll personally ping everyone who hasn't confirmed their status."
            },
            { 
                name: "🚢 3. Special Channels & Rules", 
                value: "• **#repair-ship:** Only accepts: `repair @mugi`, `repair @goat`, or `repair @ati`. Everything else is auto-deleted!\n" +
                       "• **Photos Only:** In channels with 'photos' in the topic, text messages without attachments are auto-removed."
            },
            { 
                name: "☠️ 4. Bounty & Wanted System", 
                value: "• `!wanted [@user]` — View a pirate's Wanted Poster and reward.\n" +
                       "• `!setbounty @user <amount>` — (Admin) Set a specific bounty for a pirate.\n" +
                       "• `!resetbounty @user` — (Admin) Reset a pirate's bounty to 0.\n" +
                       "• **Bounty Roles:** Your rank updates automatically based on your total bounty."
            },
            { 
                name: "⚔️ 5. Hero Guides (#unit-build)", 
                value: "• `!hero <name>` — Get a full build guide (Role, Seals, Haki) with a custom GIF.\n" +
                       "• `!hero-list` — View all available heroes in our database."
            },
            { 
                name: "⏰ 6. Reminders & Events", 
                value: "• **Static Events:** Automatic pings for `Mania`, `Shandora`, and `Belly Rush`.\n" +
                       "• `!remind <cron> <text>` — Set your own custom reminder (stored in Neon DB).\n" +
                       "• `!reminders` — List your active personal reminders.\n" +
                       "• `!allreminders` — View the full server schedule."
            },
            { 
                name: "🎖️ 7. Role Management & Welcome", 
                value: "• **New Members:** Automatically receive the `Rookies` role and a welcome message.\n" +
                "• `!addrole @user <rank>` — (Admin) Assign specific pirate ranks.\n" +
                "• `!removerole @user <rank>` — (Admin) Revoke a member's rank."
            },
            { 
                name: "🛡️ 8. Admin Control & Security", 
                value: "• **#admin-logs:** Hidden logs for deleted messages (who wrote what).\n" +
                       "• `!clear <1-100>` — Bulk delete messages to keep the chat clean.\n" +
                       "• `!help` — Quick access to this command manual."
            }
        )
        .setFooter({ text: "Sailing Kingdom Engine • v2.7 • Automatically updated on startup" })
        .setTimestamp();

    // Функция за сбогуване
const sendFarewell = async (client) => {
    // Обхождаме всички сървъри, в които е ботът
    const guilds = client.guilds.cache;
    
    for (const [id, guild] of guilds) {
        const botChannel = guild.channels.cache.find(ch => ch.name === "bot-only");
        if (botChannel) {
            const farewellEmbed = new EmbedBuilder()
                .setTitle("📡 System Status: Offline")
                .setDescription("🌅 **Farewell, pirates! I'm heading to port for maintenance. I will be back soon!**")
                .setColor("#ff4444") // Червено за офлайн
                .setTimestamp();

            // Използваме 'await', за да сме сигурни, че съобщението е пратено преди стопа
            await botChannel.send({ embeds: [farewellEmbed] }).catch(() => {});
        }
    }
};

// Не забравяй да я добавиш в exports!
module.exports = { sendBotManual, sendFarewell };
    

    // 4. Изпращаме финалното съобщение
    await infoChannel.send({ embeds: [manualEmbed] });
};

module.exports = { sendBotManual };
