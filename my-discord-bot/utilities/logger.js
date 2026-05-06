const { EmbedBuilder, AuditLogEvent } = require("discord.js");

/**
 * Помощна функция за изпращане на лога в конкретен канал
 */
async function sendLog(guild, embed) {
    // Намираме канала по точното име
    const logChannel = guild.channels.cache.find(ch => ch.name === "│📑│admin-logs");
    if (logChannel && logChannel.isTextBased()) {
        await logChannel.send({ embeds: [embed] });
    }
}

/**
 * Логване на единично изтрито съобщение (с проверка на Audit Log)
 */
async function logDeletedMessage(message) {
    // Игнорираме, ако няма сървър или ако авторът е бот
    if (!message.guild || message.author?.bot) return;

    // Изчакваме 1 секунда, за да може Discord да запише действието в Audit Log
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Вземаме последния запис за изтрито съобщение от лога на сървъра
    const fetchedLogs = await message.guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.MessageDelete,
    }).catch(() => null);

    const deletionLog = fetchedLogs?.entries.first();
    let executor = "Unknown (Author or Auto)";

    if (deletionLog) {
        const { executor: user, target } = deletionLog;
        // Проверяваме дали логът съвпада с изтритото съобщение (по ID на автора)
        if (target.id === message.author.id) {
            executor = `${user.tag}`;
        }
    }

    const embed = new EmbedBuilder()
        .setTitle("🗑️ Message Deleted")
        .setColor("#ff0000")
        .addFields(
            { name: "Author", value: `${message.author.tag}`, inline: true },
            { name: "Deleted By", value: `${executor}`, inline: true },
            { name: "Channel", value: `#${message.channel.name}`, inline: true },
            { name: "Content", value: message.content?.substring(0, 1024) || "*(No text/Embed)*" }
        )
        .setTimestamp();

    await sendLog(message.guild, embed);
}

/**
 * Логване на масово изтрити съобщения (команда !clear)
 */
async function logBulkDelete(messages) {
    const firstMsg = messages.first();
    if (!firstMsg) return;

    const guild = firstMsg.guild;
    const channel = firstMsg.channel;

    const embed = new EmbedBuilder()
        .setTitle("🧹 Bulk Messages Deleted")
        .setColor("#ffa500")
        .addFields(
            { name: "Channel", value: `#${channel.name}`, inline: true },
            { name: "Amount", value: `${messages.size}`, inline: true }
        )
        .setDescription(`A total of **${messages.size}** messages were removed.`)
        .setFooter({ text: "Individual logs are suppressed for bulk actions." })
        .setTimestamp();

    await sendLog(guild, embed);
}

module.exports = { logDeletedMessage, logBulkDelete };
