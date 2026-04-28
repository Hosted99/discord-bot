const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// --- JSON DATA ---
// Излизаме от utilities (..) и влизаме в data
const dataPath = path.join(__dirname, '..', 'data', 'permanent.json');

let permanentData = { users: [] };
try {
    const rawData = fs.readFileSync(dataPath, 'utf8');
    permanentData = JSON.parse(rawData);
} catch (err) {
    console.log("⚠️ JSON файлът е празен или липсва. Създавам нов.");
}

// --- CONFIG ---
const CONFIG = {
    ADMIN_ID: '190189929316352000',
    CHANNEL_ID: '1490378124259758261', // Увери се, че това е твоето ID на канала

    ROLES: {
        'ship_1': '1491392968270151700',
        'ship_2': '1490478060322033838',
        'ship_3': '1496765963222384641'
    },

    CAPTAINS: ['825016547138732082'],
    MAX_MEMBERS: 10
};

// --- SAVE FUNCTION ---
function savePermanent() {
    try {
        fs.writeFileSync(dataPath, JSON.stringify(permanentData, null, 2));
    } catch (err) {
        console.error("❌ Грешка при запис в JSON:", err.message);
    }
}

module.exports = {
    sendShipPanelDirect: async (channel) => {
        const embed = new EmbedBuilder()
            .setTitle('🚢 BELLY RUSH | Ship Registration')
            .setDescription('***Attention Sailors!*** ⚓\nThe fleet is preparing for departure. Get ready for battle!')
            .setColor('#2ecc71')
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ship_1').setLabel('mugi-ship').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('ship_2').setLabel('mari-ship').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('ship_3').setLabel('goat-ship').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('clear_all').setLabel('Reset Fleet').setStyle(ButtonStyle.Danger)
        );

        await channel.send({ content: '@everyone Belly Rush is OPEN!', embeds: [embed], components: [row] });
    },

    handleShipInteraction: async (interaction) => {
        if (!interaction.isButton()) return;
        const { customId, member, guild, user } = interaction;

        if (customId === 'clear_all') {
            const isAdmin = member.permissions.has('Administrator');
            if (user.id !== CONFIG.ADMIN_ID && !isAdmin) return interaction.reply({ content: '❌ No permission.', ephemeral: true });

            await interaction.deferReply({ ephemeral: true });
            let removed = 0;
            for (const roleId of Object.values(CONFIG.ROLES)) {
                const role = guild.roles.cache.get(roleId);
                if (!role) continue;
                for (const [id, m] of role.members) {
                    if (!permanentData.users.includes(m.id) && !CONFIG.CAPTAINS.includes(m.id)) {
                        await m.roles.remove(role).catch(() => {});
                        removed++;
                    }
                }
            }
            return interaction.editReply(`✅ Cleared ${removed} users.`);
        }

        if (CONFIG.ROLES[customId]) {
            const roleId = CONFIG.ROLES[customId];
            const role = guild.roles.cache.get(roleId);

            if (permanentData.users.includes(member.id)) return interaction.reply({ content: '⚠️ You are permanent crew.', ephemeral: true });
            if (CONFIG.CAPTAINS.includes(member.id)) return interaction.reply({ content: '⚠️ Captains cannot switch.', ephemeral: true });
            if (role.members.size >= CONFIG.MAX_MEMBERS && !member.roles.cache.has(roleId)) return interaction.reply({ content: '❌ Ship is full.', ephemeral: true });

            await interaction.deferReply({ ephemeral: true });
            for (const rId of Object.values(CONFIG.ROLES)) {
                if (member.roles.cache.has(rId)) await member.roles.remove(rId).catch(() => {});
            }
            await member.roles.add(role);
            return interaction.editReply(`✅ Joined ${role.name}`);
        }
    },

    handleMessage: async (message) => {
        if (message.author.bot || !message.guild) return;
        if (message.channel.id !== CONFIG.CHANNEL_ID) return;
        if (!message.content.startsWith('!want')) return;

        try {
            const args = message.content.trim().split(/\s+/);
            const ship = args[1]; // ВТОРАТА дума е името на кораба

            const shipMap = {
                'mugi-ship': 'ship_1',
                'mari-ship': 'ship_2',
                'goat-ship': 'ship_3'
            };

            const shipKey = shipMap[ship];

            if (!shipKey) {
                return message.reply('❌ Use: `!want mugi-ship`, `!want mari-ship` or `!want goat-ship`');
            }

            const roleId = CONFIG.ROLES[shipKey];
            const role = message.guild.roles.cache.get(roleId);

            if (!role) return message.reply("❌ Error: Role not found on this server.");

            // Махане на другите корабни роли
            for (const rId of Object.values(CONFIG.ROLES)) {
                if (message.member.roles.cache.has(rId)) {
                    await message.member.roles.remove(rId).catch(() => {});
                }
            }

            // Добавяне на новата роля
            await message.member.roles.add(role);

            // Добавяне в постоянния списък
            if (!permanentData.users.includes(message.author.id)) {
                permanentData.users.push(message.author.id);
                savePermanent();
            }

            return message.reply(`✅ You are now **PERMANENT** in ${role.name}`);

        } catch (error) {
            console.error("Грешка в handleMessage:", error);
            return message.reply("⚠️ An error occurred while processing your request.");
        }
    }
};
