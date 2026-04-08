# 🏴‍☠️ Sailing Kingdom Engine | v2.7

Welcome aboard! **Sailing Kingdom Engine** is a powerful, multi-functional Discord bot designed specifically for pirate-themed communities. It automates everything from real-time translations to complex battle strategies and bounty hierarchies.

---

## 🌐 1. AI Translator (#ai-translator)
*Breaking language barriers across the seas.*
*   **Auto-Translate:** Write in any language; the bot instantly translates it to 🇺🇸 English.
*   **Reverse Translation:** Reply to a translated message in English to translate it back to the original author's native language.

## ⚔️ 2. Mania Strategy System
*Full coordination for alliance battles.*
*   **Recording:** Type `mania-strategy <text>` anywhere. The bot reacts with 📥 to confirm.
*   **Auto-Post:** Every day at **19:25 (London)**, the strategy is posted in `<#mania-reminder>` with an `@everyone` ping and a confirmation poll (✅).
*   **Audit:** At **20:00 (London)**, the bot personally pings everyone who hasn't confirmed their status.

## 🚢 3. Special Channels & Smart Rules
*   **#repair-ship:** Strict mode active! Only accepts: `repair @mugi`, `repair @goat`, or `repair @ati`. All other messages are auto-deleted.
*   **Photos Only:** In channels with "photos" in the topic, any text message without an attachment is automatically removed.

## ☠️ 4. Bounty & Wanted System
*Track the heads of the most notorious pirates.*
*   `!wanted [@user]` — View a pirate's custom Wanted Poster and their current reward.
*   `!setbounty @user <amount>` — (Admin) Set a specific bounty for a pirate.
*   `!resetbounty @user` — (Admin) Reset a pirate's bounty to 0.
*   **Bounty Roles:** Your server rank updates automatically based on your total bounty accumulated.

## ⚔️ 5. Hero Guides (#unit-build)
*   `!hero <name>` — Get a full build guide (Role, Seals, Haki) featuring a custom GIF.
*   `!hero-list` — View all available heroes in the database.

## ⏰ 6. Reminders & Events
*   **Static Events:** Automatic pings for server events like Mania, Shandora, and Belly Rush.
*   `!remind <cron> <text>` — Set your own custom reminders (stored securely in Neon DB).
*   `!reminders` — List your active personal reminders.
*   `!allreminders` — View the full global server schedule.

## 🎖️ 7. Role Management & Onboarding
*   **New Members:** Automatically receive the **Rookies** role and a custom welcome message.
*   `!addrole @user <rank>` / `!removerole @user <rank>` — (Admin) Quickly manage pirate ranks.

## 🛡️ 8. Admin Control & Security
*   **#admin-logs:** Hidden logs for deleted messages (tracking author and content).
*   `!clear <1-100>` — Bulk delete messages to keep the deck clean.
*   `!help` — Quick access to this command manual.
*   `!cron` — Show the timing and cron syntax guide.

---
*Sailing Kingdom Engine • Automatically updated on startup*
