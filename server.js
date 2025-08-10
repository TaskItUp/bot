require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEB_APP_URL = process.env.WEB_APP_URL || 'https://taskitup.github.io/Pepe/';

if (!BOT_TOKEN) {
  console.error("ERROR: BOT_TOKEN missing in .env");
  process.exit(1);
}

// Start bot in polling mode
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

bot.on('polling_error', console.error);

bot.onText(/\/start(?:\s+(.+))?/, (msg, match) => {
  const chatId = msg.chat.id;
  const startParam = match[1] ? match[1].trim() : '';
  
  // Add ?ref= to your GitHub pages link if referral exists
  const appUrl = startParam
    ? `${WEB_APP_URL}?ref=${encodeURIComponent(startParam)}`
    : WEB_APP_URL;

  const welcome = `Welcome ${msg.from.first_name || ''}!\n\nTap "Open App" to start earning rewards.`;

  bot.sendMessage(chatId, welcome, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Open App", web_app: { url: appUrl } }]
      ]
    }
  });

  console.log(`Sent Open App link to ${chatId} (ref=${startParam || 'none'})`);
});
