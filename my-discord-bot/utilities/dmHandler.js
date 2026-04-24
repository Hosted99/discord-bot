// utilities/dmHandler.js

/**
 * Функция за масово изпращане на ЛС към списък от потребители
 * @param {Array} membersToNotify - Масив с GuildMember обекти
 * @param {string} planUrl - Линк към оригиналното съобщение на плана
 * @param {string} guildName - Името на гилдията (G1 или G2)
 */
async function sendEmergencyDMs(membersToNotify, planUrl, guildName) {

const messageBody = `🚨 **EMERGENCY REMINDER - ${guildName}**\n\n` +
`You haven't voted in today's Mania Plan yet! Please do it now.\n\n` +
`🔗 **Click here to vote:** ${planUrl}\n` +
`👉 Or check the channel: <#${member.guild.channels.cache.find(c => c.name.includes('mania'))?.id || ''}>`;


    let successCount = 0;
    let failCount = 0;

    for (const member of membersToNotify) {
        try {
            if (member.user.bot) continue;
            await member.send(messageBody);
            successCount++;
            console.log(`[DM-Sent] Successfully notified ${member.user.tag}`);
        } catch (err) {
            failCount++;
            console.log(`[DM-Failed] Could not notify ${member.user.tag} (DMs closed)`);
        }

        // 1.2 секунди пауза, за да не те блокира Discord за спам
        await new Promise(resolve => setTimeout(resolve, 1200));
    }

    return { successCount, failCount };
}

module.exports = { sendEmergencyDMs };
