const { EmbedBuilder } = require('discord.js');

module.exports = {
    async getRandomMeme(msg) {
        try {
            // Използваме това API, което е най-стабилно в момента
            const response = await fetch('https://meme-api.com');
            const data = await response.json();

            // Проверка дали имаме валиден URL на картинка
            if (!data.url) throw new Error("No image URL found");

            const embed = new EmbedBuilder()
                .setTitle(data.title || "Random Meme")
                .setURL(data.postLink || "https://reddit.com")
                .setImage(data.url)
                .setColor('#ff4500')
                .setFooter({ text: `👍 ${data.ups || 0} | r/${data.subreddit || 'memes'}` });

            await msg.channel.send({ embeds: [embed] });
            
            // Трием командата само ако всичко е минало успешно
            await msg.delete().catch(() => {});

        } catch (err) {
            console.error("Meme Error:", err.message);
            // Ако всичко друго се провали, пращаме директно едно от тези гарантирани мемета
            const backups = [
                "https://redd.it",
                "https://redd.it",
                "https://imgur.com"
            ];
            const randomBackup = backups[Math.floor(Math.random() * backups.length)];
            await msg.channel.send(randomBackup);
        }
    }
};
