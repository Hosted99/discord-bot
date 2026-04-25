const { EmbedBuilder } = require('discord.js');

module.exports = {
    async getRandomMeme(msg) {
        // Списък с добри източници за мемета
        const subreddits = ['memes', 'dankmemes', 'wholesomememes'];
        const randomSub = subreddits[Math.floor(Math.random() * subreddits.length)];

        try {
            // Опитваме се да вземем меме
            const response = await fetch(`https://meme-api.com{randomSub}`);
            
            if (!response.ok) throw new Error('API Down');

            const data = await response.json();

            const embed = new EmbedBuilder()
                .setTitle(data.title)
                .setURL(data.postLink)
                .setImage(data.url)
                .setColor('#ff4500')
                .setFooter({ text: `👍 ${data.ups} | r/${data.subreddit}` });

            // ВАЖНО: Използваме channel.send, за да не гърми, ако командата е изтрита
            await msg.channel.send({ embeds: [embed] });
            
            // Трием !meme командата чак след като сме пратили мемето
            await msg.delete().catch(() => {});

        } catch (err) {
            console.error("Meme Error:", err.message);
            
            // Ако първият сайт не работи, пробваме втори (алтернативно API)
            try {
                const altRes = await fetch('https://herokuapp.com');
                const altData = await altRes.json();
                
                await msg.channel.send(altData.url);
            } catch (e) {
                await msg.channel.send("🌊 Even the ocean is dry today. No memes found, try again in a bit!");
            }
        }
    }
};
