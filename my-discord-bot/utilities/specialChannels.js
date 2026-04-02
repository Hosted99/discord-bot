async function handleSpecialChannels(msg, repairMessages, allowedShips, noShipMessages) {
    if (msg.channel.name === "repair-ship") {
        const content = msg.content.trim();
        if (content.toLowerCase().startsWith("repair ")) {
            const target = content.slice(7).trim();
            if (!target) return;

            if (allowedShips.includes(target.toLowerCase())) {
                const randomMsg = repairMessages[Math.floor(Math.random() * repairMessages.length)];
                return msg.channel.send(randomMsg.replace("{user}", target));
            } else {
                const randomNoShip = noShipMessages[Math.floor(Math.random() * noShipMessages.length)];
                return msg.channel.send(randomNoShip.replace("{user}", target));
            }
        } else {
            try {
                await msg.delete();
                const warning = await msg.channel.send(`⚠️ ${msg.author}, only repair commands are allowed here!`);
                setTimeout(() => warning.delete().catch(() => {}), 5000);
            } catch (err) { console.error(err.message); }
        }
        return true; // Върната стойност, за да спрем по-нататъшна обработка
    }
    return false;
}

module.exports = { handleSpecialChannels };
