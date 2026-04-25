const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

// --- КОНФИГУРАЦИЯ ---
const CONFIG = {
    ADMIN_ID: '190189929316352000', // Твоето ID
    ROLES: {
        'ship_1': '1490301070029623448', // ID на mugi-ship
        'ship_2': '1490478060322033838', // ID на mari-ship
        'ship_3': '1497553509392974004'  // ID на goat-ship (ПРОВЕРИ ГО ПАК!)
    },
    CAPTAINS: [
        '825016547138732082'
    ],
    PERMANENT_CREW: [
        '529416192893517824'
    ],
    MAX_MEMBERS: 10 // Лимит на хора в кораб
};

module.exports = {
    // Функция за пращане на панела
    sendShipPanelDirect: async (channel) => {
        const embed = new EmbedBuilder()
            .setTitle('🚢 Belly Rush - Ship Registration')
            .setDescription('Select your ship for today\'s event.\n\n*Note: Captains and permanent crew remain in their positions.*')
            .setColor('#2b2d31');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ship_1').setLabel('Ship 1').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('ship_2').setLabel('Ship 2').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('ship_3').setLabel('Ship 3').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('clear_all').setLabel('Clear Active Crew').setStyle(ButtonStyle.Danger)
        );

        await channel.send({ embeds: [embed], components: [row] });
    },

    // Обработка на бутоните
    handleShipInteraction: async (interaction) => {
        if (!interaction.isButton()) return;
        const { customId, member, guild, user } = interaction;

        // 1. ИЗЧИСТВАНЕ
        if (customId === 'clear_all') {
            if (user.id !== CONFIG.ADMIN_ID) {
                return interaction.reply({ content: '❌ Only the administrator can reset crews!', ephemeral: true });
            }
            await interaction.deferReply({ ephemeral: true });
            let removed = 0;
            for (const roleId of Object.values(CONFIG.ROLES)) {
                const role = guild.roles.cache.get(roleId);
                if (role) {
                    for (const [id, m] of role.members) {
                        if (!CONFIG.PERMANENT_CREW.includes(m.id) && !CONFIG.CAPTAINS.includes(m.id)) {
                            await m.roles.remove(role).catch(() => {});
                            removed++;
                        }
                    }
                }
            }
            return interaction.editReply(`✅ Cleared ${removed} active members.`);
        }

        // 2. ИЗБОР НА КОРАБ
        if (CONFIG.ROLES[customId]) {
            const targetRoleId = CONFIG.ROLES[customId];
            const role = guild.roles.cache.get(targetRoleId);

            // ПРОВЕРКА 1: Съществува ли ролята?
            if (!role) {
                console.error(`❌ ГРЕШКА: Роля с ID ${targetRoleId} не е намерена в сървъра!`);
                return interaction.reply({ content: '❌ Error: Role ID not found in this server.', ephemeral: true });
            }

            // ПРОВЕРКА 2: Защита за капитани
            if (CONFIG.PERMANENT_CREW.includes(member.id) || CONFIG.CAPTAINS.includes(member.id)) {
                return interaction.reply({ content: '⚠️ Captains and permanent crew cannot change ships.', ephemeral: true });
            }

            // ПРОВЕРКА 3: Лимит от 10 души
            if (role.members.size >= CONFIG.MAX_MEMBERS && !member.roles.cache.has(targetRoleId)) {
                return interaction.reply({ content: `❌ This ship is full! (Max ${CONFIG.MAX_MEMBERS})`, ephemeral: true });
            }

            try {
                await interaction.deferReply({ ephemeral: true });

                // ПРЕМАХВАНЕ на стари роли за кораби
                const allShipRoles = Object.values(CONFIG.ROLES);
                for (const rId of allShipRoles) {
                    if (member.roles.cache.has(rId) && rId !== targetRoleId) {
                        await member.roles.remove(rId).catch(e => console.log("Грешка при махане:", e.message));
                    }
                }

                // ДОБАВЯНЕ на новата роля
                if (!member.roles.cache.has(targetRoleId)) {
                    await member.roles.add(role);
                    return interaction.editReply(`✅ Joined **${role.name}**!`);
                } else {
                    return interaction.editReply('ℹ️ You are already in this crew.');
                }
            } catch (err) {
                console.error("❌ КРИТИЧНА ГРЕШКА:", err.message);
                return interaction.editReply(`❌ Failed to assign role: ${err.message}`);
            }
        }
    }
};
