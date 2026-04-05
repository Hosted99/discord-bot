module.exports = [
  { cron: "0 14 * * 2,4", message: "Shandora is open!", target: "everyone" },
  { cron: "0 12 * * 2,5", message: "Belly Rush today!", target: "everyone" },
  { cron: "0 12 * * 3,5,0", message: "Mania today!", target: "@everyone" },
  { cron: "45 21 * * 3,5,0", message: "15 min until Mania starts!", target: "@everyone" },
  { cron: "0 22 * * 3,5,0", message: "Mania is open!", target: "@everyone" },
  // 1. Повтаря се на всеки 2 часа от 12:00 до 18:00 (12, 14, 16, 18 часа)
{ cron: "0 12-18/2 * * 2,5", message: "💰 Belly Rush is active! Go get those berries!", target: "@everyone" },

// 2. Специално съобщение само за финала в 20:00
{ cron: "0 20 * * 2,5", message: "🚨 Belly Rush is ending soon! This is your LAST CHANCE!", target: "@everyone" },
  // 1. Повтаря се на всеки 5 минути (15:00, 15:05, 15:10)
{ cron: "0,5,10 15 * * *", message: "🧪 TEST: Ремайндър на всеки 5 минути! (Ongoing)", target: "@everyone" },

// 2. Финално съобщение точно в 15:15
{ cron: "15 15 * * *", message: "🏁 FINAL TEST: Времето изтече! Това беше последното съобщение.", target: "@everyone" }


];
