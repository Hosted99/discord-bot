const repairMessages = require("../data/repairMessages");

const allowedShips = ["@mugi-ship", "@goat-ship", "@ati-ship"];
const noShipMessages = [
    "🚫 Hmm, **{user}**? This ship is not in our registry.",
    "🔍 We searched everywhere, but couldn't find **{user}**.",
    "⚓ Sorry, our dock doesn't support models like **{user}**.",
    "🛑 **{user}**? Check your spelling, mate!"
];

async function handleSpecialChannels(msg) {
    // --- Логика за REPAIR-SHIP ---
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
        return true; // Връщаме true, за да спрем обработката в main.js
    }
    
    return false; // Продължаваме към командите, ако не сме в специален канал
}

module.exports = { handleSpecialChannels };
