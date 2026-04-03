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
 * Автоматично посрещане и даване на роля Rookies при влизане на нов член
 */
async function handleNewMember(member) {
    try {
        const welcomeRole = member.guild.roles.cache.find(r => r.name === "Rookies");
        const welcomeChannel = member.guild.channels.cache.find(ch => ch.name === "welcome");

        if (welcomeRole) await member.roles.add(welcomeRole);

        if (welcomeChannel) {
            const welcomeEmbed = new EmbedBuilder()
                .setTitle("⚓ New Pirate Arrived!")
                .setDescription(`Welcome to the crew, ${member}! You are now a **Rookie**. Check the rules and start your journey! 🏴‍☠️`)
                .setColor("#00ff99")
                .setThumbnail(member.user.displayAvatarURL());
            await welcomeChannel.send({ embeds: [welcomeEmbed] });
        }
    } catch (err) { console.error("Welcome Error:", err.message); }
}

/**
 * Контрол на специалните пиратски роли чрез команди !addrole и !removerole
 */
async function handleRoleCommands(msg, cmd, args) {
    if (!msg.member.permissions.has("ManageRoles")) return;

    const targetUser = msg.mentions.members.first();
    const roleName = args.slice(1).join(" ");

    if (!targetUser || !roleName) {
        return msg.reply("❌ Usage: `!addrole @user RoleName`").then(m => setTimeout(() => m.delete(), 5000));
    }

    // Проверка дали ролята е в твоя списък за ръчно управление
    const isManaged = managedRoles.some(r => r.toLowerCase() === roleName.toLowerCase());
    if (!isManaged) return msg.reply("⚠️ This role is not in the managed pirate list!");

    const role = msg.guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());
    if (!role) return msg.reply(`❌ Role "**${roleName}**" not found!`);

    try {
        if (cmd === "!addrole") {
            await targetUser.roles.add(role);
            
            // Специален поздрав за високи рангове
            if (roleName.toLowerCase().includes("leader") || roleName.toLowerCase().includes("king")) {
                const promo = new EmbedBuilder()
                    .setTitle("🎖️ New Promotion!")
                    .setDescription(`Everyone salute! ${targetUser} has been promoted to **${role.name}**!`)
                    .setColor("#FFD700")
                    .setThumbnail(targetUser.user.displayAvatarURL());
                return msg.channel.send({ embeds: [promo] });
            }
            return msg.reply(`✅ **${role.name}** assigned to ${targetUser.user.username}.`);
        }

        if (cmd === "!removerole") {
            await targetUser.roles.remove(role);
            return msg.reply(`🗑️ **${role.name}** removed from ${targetUser.user.username}.`);
        }
    } catch (err) {
        return msg.reply("❌ Hierarchy error! Move my role **HIGHER** than the pirate roles.");
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
