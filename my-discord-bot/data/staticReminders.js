module.exports = [
  { cron: "0 12 * * 2,4", message: "Shandora is open!", target: "everyone" },
  { cron: "0 12 * * 2,5", message: "Belly Rush today!", target: "everyone" },
  { cron: "0 12 * * 3,5,0", message: "Mania today!", target: "@everyone" },
  { cron: "45 21 * * 3,5,0", message: "15 min until Mania starts!", target: "@everyone" },
  { cron: "0 22 * * 3,5,0", message: "Mania is open!", target: "@everyone" },


  //SHANDORA !!!
  // 1. Повтаря съобщението за отворено състояние през 3 часа (до 21:00 включително)
  { cron: "0 12,15,18,21 * * 2,4", message: "Shandora is open!", target: "everyone"},
  // 2. ПРЕДУПРЕЖДЕНИЕ: Изпраща се в 23:50 (10 минути преди края) във вторник и четвъртък
  { cron: "50 23 * * 2,4", message: "Shandora is closing soon! 10 minutes left.", target: "everyone"},
  // 2. Изпраща финално съобщение за затваряне точно в 00:00 (сряда и петък сутрин)
  { cron: "0 0 * * 3,5", message: "Shandora is now CLOSED!", target: "everyone" },

  //BELLY RUSH !!!
  // Ще изпраща съобщението в 12:00, 16:00 и 20:00 във вторник (2) и петък (5)
  { cron: "0 12,16,20 * * 2,5", message: "Belly Rush today!", target: "everyone"},

  //GUILD WARS !!!
  // 1. ПРЕП ХАЙП (11:00) – Време е за подготовка
{ cron: "0 11 * * 1,3,5", message: "⚔️ Sharpen your blades and chug those potions! Preparation has started. Don't be the one showing up with a wooden sword! 🛡️", target: "everyone" },
// 2. БОЕН ВИК (12, 15, 18:00) – Екшън фаза
{ cron: "0 12,15,18 * * 1,3,5", message: "🔥 THE HORN HAS SOUNDED! Guild war is LIVE! Get in there and show them why we're the legends. Don't make us come find you! 🏹", target: "everyone" },
// 3. ПОБЕДНО ПИТИЕ (21:00) – Край на войната
{ cron: "0 21 * * 1,3,5", message: "🍻 Sheathe your weapons, heroes! The war has ended. Thanks for the carry (and the support)! Time to hit the tavern. 🏆", target: "everyone" }


];
