const repairMessages = require("../data/repairMessages");

const allowedShips = ["@mugi-ship", "@goat-ship", "@ati-ship"];
const noShipMessages = [
    "🚫 Hmm, **{user}**? This ship is not in our registry.",
    "🔍 We searched everywhere, but couldn't find **{user}**.",
    "⚓ Sorry, our dock doesn't support models like **{user}**.",
    "🛑 **{user}**? Check your spelling, mate!"
];

async function handleSpecialChannels(msg) {
    // --- 1. Логика за REPAIR-SHIP ---
    if (msg.channel.name === "repair-ship") {
        const content = msg.content.trim();
        const lowerContent = content.toLowerCase();

        if (lowerContent.startsWith("repair ")) {
            const target = content.slice(7).trim();
            if (!target) return true;

            if (allowedShips.includes(target.toLowerCase())) {
                const randomMsg = repairMessages[Math.floor(Math.random() * repairMessages.length)];
                msg.channel.send(randomMsg.replace("{user}", target));
            } else {
                const randomNoShip = noShipMessages[Math.floor(Math.random() * noShipMessages.length)];
                msg.channel.send(randomNoShip.replace("{user}", target));
            }
        } else {
            // Изтриване на всичко, което не е команда за ремонт
            try {
                await msg.delete();
                const warning = await msg.channel.send(`⚠️ ${msg.author}, only repair commands are allowed here!`);
                setTimeout(() => warning.delete().catch(() => {}), 5000);
            } catch (err) { console.error("Special channel cleanup error:", err.message); }
        }
        return true; // Спираме обработката тук
    }

    // --- 2. Логика САМО ЗА СНИМКИ (Photos Only) ---
    // Проверява дали в описанието (Topic) на канала има думата "photos"
    if (msg.channel.topic && msg.channel.topic.includes("photos")) {
        // Ако съобщението няма прикачени файлове (снимки)
        if (msg.attachments.size === 0) {
            try {
                await msg.delete();
                const warning = await msg.channel.send(`📸 ${msg.author}, only photos are allowed in this channel!`);
                setTimeout(() => warning.delete().catch(() => {}), 5000);
            } catch (err) { console.error("Photo channel cleanup error:", err.message); }
            return true; // Спираме съобщението да стигне до командите
        }
    }
    
    return false; // Продължаваме към командите, ако не сме в специален канал
}

module.exports = { handleSpecialChannels };
