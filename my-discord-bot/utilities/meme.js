const { EmbedBuilder } = require('discord.js');

module.exports = {
    async getRandomMeme(msg) {
        try {
            const response = await fetch('https://api.imgflip.com/get_memes');
            const json = await response.json();

            if (!json.success) throw new Error("Imgflip API failed");

            const memes = json.data.memes;
            const randomMeme = memes[Math.floor(Math.random() * memes.length)];

            const embed = new EmbedBuilder()
                .setTitle(randomMeme.name)
                .setImage(randomMeme.url)
                .setColor('#2ecc71')
                .setFooter({ text: 'Source: Imgflip | Top Templates' });

            await msg.channel.send({ embeds: [embed] });
            await msg.delete().catch(() => {});

        } catch (err) {
            console.error("Imgflip Error:", err);

            await msg.channel.send("Не стана 😅 пробвай пак");
        }
    }
};
