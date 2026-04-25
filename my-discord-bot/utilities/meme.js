const { EmbedBuilder } = require('discord.js');

module.exports = {
    async getRandomMeme(msg) {
        // Списък с най-добрите места за мемета
        const subs = ['memes', 'dankmemes', 'wholesomememes', 'PrequelMemes'];
        const randomSub = subs[Math.floor(Math.random() * subs.length)];

        try {
            // Взимаме мемета директно от JSON-а на Reddit (много по-стабилно)
            const response = await fetch(`https://reddit.com{randomSub}/random/.json`);
            const data = await response.json();

            // Reddit връща списък, взимаме първия пост
            const post = data[0].data.children[0].data;

            // Проверка дали постът има картинка
            if (!post.url || post.is_video) {
                return this.getRandomMeme(msg); // Ако е видео или текст, опитай пак
            }

            const embed = new EmbedBuilder()
                .setTitle(post.title.length > 256 ? post.title.substring(0, 253) + '...' : post.title)
                .setURL(`https://reddit.com${post.permalink}`)
                .setImage(post.url)
                .setColor('#ff4500')
                .setFooter({ text: `👍 ${post.ups} | Source: r/${post.subreddit}` });

            await msg.channel.send({ embeds: [embed] });
            await msg.delete().catch(() => {});

        } catch (err) {
            console.error("Reddit Meme Error:", err.message);
            // Ако и това се провали, пращаме едно гарантирано меме, за да не е празно
            await msg.channel.send("https://imgflip.com"); 
        }
    }
};
