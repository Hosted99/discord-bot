const { EmbedBuilder } = require('discord.js');

module.exports = {
    async getRandomMeme(msg) {
        try {
            // Използваме официалното Imgflip API
            const response = await fetch('https://imgflip.com');
            const json = await response.json();

            if (!json.success) throw new Error("Imgflip API failed");

            // Imgflip връща списък от 100-те най-популярни мемета в момента
            const memes = json.data.memes;
            const randomMeme = memes[Math.floor(Math.random() * memes.length)];

            const embed = new EmbedBuilder()
                .setTitle(randomMeme.name) // Името на меме шаблона
                .setImage(randomMeme.url) // Самата картинка
                .setColor('#2ecc71') // Зелено
                .setFooter({ text: 'Source: Imgflip API | Top 100 Templates' });

            await msg.channel.send({ embeds: [embed] });
            await msg.delete().catch(() => {});

        } catch (err) {
            console.error("Imgflip Error:", err.message);
            // Ако и това падне, пращаме директен линк
            await msg.channel.send("https://imgflip.com");
        }
    }
};
