const { EmbedBuilder } = require("discord.js");

// --- КОНФИГУРАЦИЯ НА РОЛИТЕ ---

// 1. Твоят списък с роли за ръчен контрол (!addrole)
const managedRoles = [
    "Pirate King Crew", "Pirate King", "Whitebeard's", "Mini Whitebeard's", 
    "Team builder", "Whitebeard's Leader", "Whitebeard's Vice Leader", 
    "Mini Whitebeard's Leader", "Mini Whitebeard's Vice Leader", "Rookies"
];

// 2. Генериране на автоматичните Bounty нива (от 900M надолу до 50M през 50M)
const bountyTiers = [];
for (let i = 900; i >= 50; i -= 50) {
    bountyTiers.push({ min: i * 1000000, name: `Bounty: ${i}M+` });
}

/**
 * Извиква се автоматично при влизане на нов член (от main.js)
 */
async function handleNewMember(member) {
    try {
        // 1. Даване на начална роля
        const rookieRole = member.guild.roles.cache.find(r => r.name === "Rookies");
        if (rookieRole) await member.roles.add(rookieRole);

        // 2. Намиране на канала (увери се, че името съвпада точно)
        const welcomeChannel = member.guild.channels.cache.find(ch => ch.name === "│👋│welcome");
        if (!welcomeChannel) return;

        // 3. Изтриване на старото съобщение за чистота
        if (lastWelcomeMessage) {
            await lastWelcomeMessage.delete().catch(() => {});
        }

        // 4. Създаване на Embed съобщението
        const welcomeEmbed = new EmbedBuilder()
            .setTitle("⚓ New Pirate Aboard!")
            .setDescription(
                `Ahoy, pirate ${member}! 🏴‍☠️\n\n` +
                `Welcome to the **Pirate Queen’s Family**.\n\n` +
                `📜 **The Pirate Code:** Check <#1497466531322527877>.\n` +
                `💰 **Верификация:** Натисни бутона долу, за да въведеш никнейма си, да премахнеш роля **Rookies** и да получиш **Player** достъп! ⚔️`
            )
            .setColor("#2ECC71")
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setFooter({ text: `Member #${member.guild.memberCount}` })
            .setTimestamp();

        // 5. Бутонът
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('start_verify')
                .setLabel('Въведи Никнейм')
                .setStyle(ButtonStyle.Success)
        );

        // Пращане и запазване в променливата
        lastWelcomeMessage = await welcomeChannel.send({ 
            content: `${member}`, 
            embeds: [welcomeEmbed], 
            components: [row] 
        });

    } catch (err) {
        console.error("Welcome Error:", err.message);
    }
}

/**
 * Извиква се при всяко взаимодействие (от main.js)
 */
async function handleInteraction(interaction) {
    // Проверка за бутона
    if (interaction.isButton() && interaction.customId === 'start_verify') {
        const modal = new ModalBuilder()
            .setCustomId('nick_modal')
            .setTitle('Пиратска Регистрация');

        const nameInput = new TextInputBuilder()
            .setCustomId('new_nickname')
            .setLabel("Твоят никнейм в играта:")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Напиши името си тук...")
            .setMinLength(2)
            .setMaxLength(32)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
        return interaction.showModal(modal);
    }

    // Проверка за изпратения Modal
    if (interaction.isModalSubmit() && interaction.customId === 'nick_modal') {
        const newNick = interaction.fields.getTextInputValue('new_nickname');
        const guild = interaction.guild;
        const member = interaction.member;

        try {
            // Намиране на ролите
            const rookieRole = guild.roles.cache.find(r => r.name === "Rookies");
            const playerRole = guild.roles.cache.find(r => r.name === "Player");

            // Екшън: Смяна на име и роли
            await member.setNickname(newNick);
            
            if (rookieRole) await member.roles.remove(rookieRole);
            if (playerRole) await member.roles.add(playerRole);

            await interaction.reply({ 
                content: `✅ Капитан **${newNick}**, добре дошъл! Ролята **Rookies** бе премахната и вече си **Player**.`, 
                ephemeral: true 
            });

        } catch (err) {
            console.error("Verification Error:", err);
            await interaction.reply({ 
                content: "❌ Грешка! Ботът не може да промени името ти (ако си администратор) или ролите му са по-ниско от твоите.", 
                ephemeral: true 
            });
        }
    }
}

module.exports = { handleNewMember, handleInteraction };


///__________________________________ТЕСТ



/**
 * Контрол на специалните пиратски роли чрез команди !addroleall !addrole и !removerole
 */
async function handleRoleCommands(msg, cmd, args) {
    if (!msg.member.permissions.has("ManageRoles")) return;


     // --- МАСОВИ КОМАНДИ ЗА ТАГОВЕ ---
    if (cmd === "!addroleallts" || cmd === "!addroleallgm") {
        msg.delete().catch(() => {});
        
        // Само Админи могат да пускат масово раздаване
        if (!msg.member.permissions.has("Administrator")) {
            return msg.reply("❌ Only Admirals can use mass-role commands.")
                      .then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
        }

        // Определяме кой таг да търсим според командата
        // Ако пишеш !addroleallts -> търси ᐪˢ☠️
        // Ако пишеш !addroleallgm -> търси ᴳᴹ☠️
        const tag = (cmd === "!addroleallgm") ? "ᴳᴹ☠️" : "ᐪˢ☠️";

        const role = msg.mentions.roles.first() || msg.guild.roles.cache.get(args[0]);

        if (!role) {
            return msg.channel.send(`❌ Usage: \`${cmd} @role\``)
                      .then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
        }

        const statusMsg = await msg.channel.send(`⏳ Scanning for pirates with tag **${tag}**...`);

        try {
            const allMembers = await msg.guild.members.fetch();
            
            // Филтрираме по съответния таг
            const targets = allMembers.filter(m => 
                m.user.username.includes(tag) || 
                (m.nickname && m.nickname.includes(tag))
            );

            if (targets.size === 0) {
                return statusMsg.edit(`❌ No users found with tag **${tag}**.`);
            }

            let count = 0;
            for (const [id, member] of targets) {
                if (!member.roles.cache.has(role.id)) {
                    await member.roles.add(role).catch(() => {});
                    count++;
                }
            }

            return statusMsg.edit(`✅ Added **${role.name}** to **${count}** members with the **${tag}** tag.`);
        } catch (err) {
            console.error(err);
            return statusMsg.edit("❌ Error during mass update.");
        }
    }

  
///

    
    const targetUser = msg.mentions.members.first();
    // 1. Проверяваме дали е тагната роля или е написана като текст
    const mentionedRole = msg.mentions.roles.first();
    
    // Ако има тагната роля, взимаме нейното име, иначе взимаме текста след потребителя
    let roleName = mentionedRole ? mentionedRole.name : args.slice(1).join(" ").trim();

    if (!targetUser || !roleName) {
        return msg.reply("❌ Usage: `!addrole @user RoleName`").then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }

    // 2. Проверка в списъка (managedRoles трябва да е дефиниран в същия файл или подаден)
    const isManaged = managedRoles.some(r => r.toLowerCase().trim() === roleName.toLowerCase().trim());
    
    if (!isManaged) {
        console.log(`[DEBUG] Role rejected: "${roleName}"`); // За да видиш в Railway какво точно се проваля
        return msg.reply(`⚠️ The role "**${roleName}**" is not in the managed pirate list!`);
    }

    // 3. Намиране на обекта на ролята в сървъра
    const role = mentionedRole || msg.guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());

    if (!role) return msg.reply(`❌ Role "**${roleName}**" not found in this server!`);

    try {
        if (cmd === "!addrole") {
            await targetUser.roles.add(role);
            
            // Специален поздрав за лидери
            if (roleName.toLowerCase().includes("leader") || roleName.toLowerCase().includes("king")) {
                const promo = new EmbedBuilder()
                    .setTitle("🎖️ New Promotion!")
                    .setDescription(`Everyone salute! ${targetUser} has been promoted to **${role.name}**!`)
                    .setColor("#FFD700")
                    .setThumbnail(targetUser.user.displayAvatarURL({ dynamic: true }));
                return msg.channel.send({ embeds: [promo] });
            }
            return msg.reply(`✅ **${role.name}** assigned to ${targetUser.user.username}.`);
        }

        if (cmd === "!removerole") {
            await targetUser.roles.remove(role);
            return msg.reply(`🗑️ **${role.name}** removed from ${targetUser.user.username}.`);
        }
    } catch (err) {
        console.error(err);
        return msg.reply("❌ **Hierarchy Error!** Go to Server Settings -> Roles and move my bot role **HIGHER** than the pirate roles.");
    }
}

/**
 * АВТОМАТИЧНА СМЯНА НА ЦВЕТНИТЕ BOUNTY РОЛИ (След !setbounty)
 */
async function updateBountyRole(member, amount) {
    if (!member) return null;
    try {
        // Намираме най-високото ниво, което сумата покрива
        const tier = bountyTiers.find(t => amount >= t.min);
        const newRoleName = tier ? tier.name : null;

        // Взимаме всички текущи Bounty роли на човека (за да ги изчистим)
        const currentBountyRoles = member.roles.cache.filter(r => r.name.startsWith("Bounty: "));
        
        // Ако потребителят вече има правилната роля, не правим нищо
        if (newRoleName && member.roles.cache.some(r => r.name === newRoleName)) return newRoleName;

        // Махаме старите Bounty роли, за да не се дублират цветовете
        if (currentBountyRoles.size > 0) await member.roles.remove(currentBountyRoles);

        // Даваме новата роля според наградата
        if (newRoleName) {
            const roleToGive = member.guild.roles.cache.find(r => r.name === newRoleName);
            if (roleToGive) {
                await member.roles.add(roleToGive);
                return newRoleName;
            }
        }
    } catch (err) { console.error("Bounty Role Update Error:", err.message); }
    return null;
}

module.exports = { handleNewMember, handleRoleCommands, updateBountyRole };
