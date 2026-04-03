// utilities/logger.js
const { EmbedBuilder } = require("discord.js");

/**
 * Изпраща лог съобщение в канал #admin-logs
 */
async function sendLog(guild, embed) {
    const logChannel = guild.channels.cache.find(ch => ch.name === "admin-logs");
    if (logChannel) {
        await logChannel.send({ embeds: [embed] });
    }
}

/**
 * Лог при изтрито съобщение
 */
async function logDeletedMessage(message) {
    if (!message.guild || message.author?.bot) return;

    const embed = new EmbedBuilder()
        .setTitle("🗑️ Message Deleted")
        .setColor("#ff0000")
        .addFields(
            { name: "Author", value: `${message.author.tag} (${message.author.id})`, inline: true },
            { name: "Channel", value: `${message.channel.name}`, inline: true },
            { name: "Content", value: message.content || "*(No text content)*" }
        )
        .setTimestamp();

    await sendLog(message.guild, embed);
}

module.exports = { logDeletedMessage };
