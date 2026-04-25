const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

// --- CONFIGURATION ---
const CONFIG = {
    ADMIN_ID: 'YOUR_DISCORD_ID', // Твоето ID
    ROLES: {
        'ship_1': 'ROLE_ID_1', // ID на роля за Кораб 1
        'ship_2': 'ROLE_ID_2', // ID на роля за Кораб 2
        'ship_3': 'ROLE_ID_3'  // ID на роля за Кораб 3
    },
    PERMANENT_CREW: [
        'PERMANENT_USER_ID_1', // Неактивен човек 1
        'PERMANENT_USER_ID_2'  // Неактивен човек 2
    ]
};

module.exports = {
    // Функция за директно изпращане на панела (използва се от графика)
    sendShipPanelDirect: async (channel) => {
        const embed = new EmbedBuilder()
            .setTitle('🚢 Belly Rush - Ship Registration')
            .setDescription('Select your ship for today\'s event.\n\n*Note: Permanent crew members remain in their positions.*')
            .setColor('#2b2d31');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ship_1').setLabel('Ship 1').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('ship_2').setLabel('Ship 2').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('ship_3').setLabel('Ship 3').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('clear_all').setLabel('Clear Crew').setStyle(ButtonStyle.Danger)
        );

        await channel.send({ embeds: [embed], components: [row] });
    },

    // Обработка на натискането на бутони
    handleShipInteraction: async (interaction) => {
        if (!interaction.isButton()) return;
        const { customId, member, guild, user } = interaction;

        // 1. ЛОГИКА ЗА ИЗЧИСТВАНЕ
        if (customId === 'clear_all') {
            if (user.id !== CONFIG.ADMIN_ID) {
                return interaction.reply({ content: '❌ Only the administrator can reset the crews!', ephemeral: true });
            }
            await interaction.deferReply({ ephemeral: true });
            let removed = 0;
            for (const roleId of Object.values(CONFIG.ROLES)) {
                const role = guild.roles.cache.get(roleId);
                if (role) {
                    for (const [id, m] of role.members) {
                        // Махаме ролята само ако човекът не е в постоянния списък
                        if (!CONFIG.PERMANENT_CREW.includes(m.id)) {
                            await m.roles.remove(role).catch(() => {});
                            removed++;
                        }
                    }
                }
            }
            return interaction.editReply(`✅ Successfully cleared ${removed} active players. Permanent crew was not affected.`);
        }

        // 2. ЛОГИКА ЗА ЗАПИСВАНЕ НА КОРАБ
        if (CONFIG.ROLES[customId]) {
            const targetRoleId = CONFIG.ROLES[customId];
            
            // Проверка за постоянни членове
            if (CONFIG.PERMANENT_CREW.includes(member.id)) {
                return interaction.reply({ content: '⚠️ You are a permanent crew member and cannot change your ship.', ephemeral: true });
            }

            // Махане на други роли за кораби (предотвратява дублиране)
            for (const roleId of Object.values(CONFIG.ROLES)) {
                if (member.roles.cache.has(roleId)) await member.roles.remove(roleId).catch(() => {});
            }

            await member.roles.add(targetRoleId);
            const roleName = guild.roles.cache.get(targetRoleId).name;
            return interaction.reply({ content: `✅ You have joined **${roleName}**!`, ephemeral: true });
        }
    }
};
