const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// --- JSON DATA ---
// Промени това, за да излезеш от utilities и да влезеш в data
const dataPath = path.join(__dirname, '..', 'data', 'permanent.json');
let permanentData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// --- CONFIG ---
const CONFIG = {
    ADMIN_ID: '190189929316352000',

    // 📌 КАНАЛ ЗА !want
    CHANNEL_ID: '1451310326019526800',

    ROLES: {
        'ship_1': '1491392968270151700',
        'ship_2': '1496765894708301925',
        'ship_3': '1496765963222384641'
    },

    CAPTAINS: ['825016547138732082'],
    PERMANENT_CREW: permanentData.users,
    MAX_MEMBERS: 10
};

// --- SAVE FUNCTION ---
function savePermanent() {
    fs.writeFileSync(dataPath, JSON.stringify(permanentData, null, 2));
}

module.exports = {
    sendShipPanelDirect: async (channel) => {
        const embed = new EmbedBuilder()
            .setTitle('🚢 BELLY RUSH | Ship Registration')
            .setDescription(
                '***Attention Sailors!*** ⚓\n' +
                'The fleet is preparing for departure. Get ready for battle!'
            )
            .addFields(
                { 
                    name: '🛡️ Active Crew', 
                    value: 'These buttons are for **active players** who want to manage their participation. If you like switching ships or join frequently, pick your role below!', 
                    inline: false 
                },
                { 
                    name: '⚓ Permanent Crew', 
                    value: 'Your spots are **secured**. If you don\'t feel like clicking, you are already part of the manifest. This is only for those who want to be active or have time on discord!', 
                    inline: false 
                },
                { 
                    name: '📝 Request Permanent Status', 
                    value: 'If you don\'t want to deal with buttons every time and your ship choice **won\'t change** for future events, please **let us know**! We will assign you a permanent role so you don\'t have to register manually.', 
                    inline: false 
                }
            )
            .setColor('#2ecc71') 
            .setThumbnail('https://flaticon.com') 
            .setImage('https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExczVjbHA5emc1M3NuYmNybXZhNjlsNHk2OGtjbHMxODRzb2U0dGg1ZCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/7zmLy0sYn9Y8O6BrlF/giphy.gif') 
            .setFooter({ 
                text: '⚓ Pick your ship and prepare for battle! | Hosted by Captain', 
                iconURL: 'https://flaticon.com' 
            })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ship_1').setLabel('mugi-ship').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('ship_2').setLabel('mari-ship').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('ship_3').setLabel('goat-ship').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('clear_all').setLabel('Reset Fleet').setStyle(ButtonStyle.Danger)
        );

        await channel.send({
            content: '@everyone Belly Rush is OPEN!',
            embeds: [embed],
            components: [row]
        });
    },

    // 🔘 BUTTON HANDLER
    handleShipInteraction: async (interaction) => {
        if (!interaction.isButton()) return;

        const { customId, member, guild, user } = interaction;

        // 🗑️ CLEAR
        if (customId === 'clear_all') {
            const isAdmin = member.permissions.has('Administrator');

            if (user.id !== CONFIG.ADMIN_ID && !isAdmin) {
                return interaction.reply({ content: '❌ No permission.', ephemeral: true });
            }

            await interaction.deferReply({ ephemeral: true });

            let removed = 0;

            for (const roleId of Object.values(CONFIG.ROLES)) {
                const role = guild.roles.cache.get(roleId);
                if (!role) continue;

                for (const [id, m] of role.members) {
                    if (
                        !CONFIG.PERMANENT_CREW.includes(m.id) &&
                        !CONFIG.CAPTAINS.includes(m.id)
                    ) {
                        await m.roles.remove(role).catch(() => {});
                        removed++;
                    }
                }
            }

            return interaction.editReply(`✅ Cleared ${removed} users.`);
        }

        // 🚢 BUTTON JOIN
        if (CONFIG.ROLES[customId]) {
            const roleId = CONFIG.ROLES[customId];
            const role = guild.roles.cache.get(roleId);

            if (CONFIG.PERMANENT_CREW.includes(member.id)) {
                return interaction.reply({ content: '⚠️ You are permanent crew.', ephemeral: true });
            }

            if (CONFIG.CAPTAINS.includes(member.id)) {
                return interaction.reply({ content: '⚠️ Captains cannot switch.', ephemeral: true });
            }

            if (role.members.size >= CONFIG.MAX_MEMBERS && !member.roles.cache.has(roleId)) {
                return interaction.reply({ content: '❌ Ship is full.', ephemeral: true });
            }

            await interaction.deferReply({ ephemeral: true });

            for (const rId of Object.values(CONFIG.ROLES)) {
                if (member.roles.cache.has(rId) && rId !== roleId) {
                    await member.roles.remove(rId).catch(() => {});
                }
            }

            if (!member.roles.cache.has(roleId)) {
                await member.roles.add(role);
                return interaction.editReply(`✅ Joined ${role.name}`);
            } else {
                return interaction.editReply('ℹ️ Already in this ship.');
            }
        }
    },

    // 💬 !WANT COMMAND (ONLY 1 CHANNEL)
    handleMessage: async (message) => {
        if (message.author.bot) return;

        // 🚫 само в определен канал
        if (message.channel.id !== CONFIG.CHANNEL_ID) return;

        if (!message.content.startsWith('!want')) return;

        const args = message.content.split(' ');
        const ship = args[1];

        const shipMap = {
            'mugi-ship': 'ship_1',
            'mari-ship': 'ship_2',
            'goat-ship': 'ship_3'
        };

        const shipKey = shipMap[ship];
        if (!shipKey) {
            return message.reply('❌ Use: mugi-ship, mari-ship, goat-ship');
        }

        const roleId = CONFIG.ROLES[shipKey];
        const role = message.guild.roles.cache.get(roleId);

        if (!role) return;

        // маха други роли
        for (const rId of Object.values(CONFIG.ROLES)) {
            if (message.member.roles.cache.has(rId)) {
                await message.member.roles.remove(rId).catch(() => {});
            }
        }

        await message.member.roles.add(role);

        // ✅ добавя в permanent
        if (!permanentData.users.includes(message.author.id)) {
            permanentData.users.push(message.author.id);
            savePermanent();
        }

        return message.reply(`✅ You are now PERMANENT in ${role.name}`);
    }
};
