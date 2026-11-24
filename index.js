// require("dotenv").config({ path: require("path").join(__dirname, ".env") });
// if (!process.env.BOT_TOKEN) {
//   console.error(
//     "Thieu BOT_TOKEN trong file .env — kiem tra file .env roi chay lai.",
//   );
//   process.exit(1);
// }
// const ZaloBot = require('node-zalo-bot');

// const bot = new ZaloBot(process.env.BOT_TOKEN, { polling: true });

// bot.on("message", (msg) => {
//   bot.sendMessage(msg.chat.id, `Bạn vừa nói: ${msg.text}`);
// });

// console.log("Bot đang chạy, nhắn tin thử đi...");

require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const express = require("express");
const ZaloBot = require("node-zalo-bot");

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const WEBHOOK_URL = process.env.WEBHOOK_URL || process.env.RENDER_EXTERNAL_URL;

if (!BOT_TOKEN) {
  console.error(
    "Thieu BOT_TOKEN trong file .env — kiem tra file .env roi chay lai.",
  );
  process.exit(1);
}
if (!WEBHOOK_SECRET) {
  console.error("Thieu WEBHOOK_SECRET — them vao file .env roi chay lai.");
  process.exit(1);
}

const bot = new ZaloBot(BOT_TOKEN, { polling: false });

bot.on("message", (msg) => {
  bot.sendMessage(msg.chat.id, `Ban vua noi: ${msg.text}`);
});

const app = express();
app.use(express.json());

app.get("/", (req, res) => res.send("Bot dang chay."));

app.post("/webhook", (req, res) => {
  if (req.headers["x-bot-api-secret-token"] !== WEBHOOK_SECRET) {
    return res.sendStatus(401);
  }
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log("Server chay o cong " + PORT);
  if (!WEBHOOK_URL) {
    console.log(
      "Chua co WEBHOOK_URL — them bien nay tren Render roi deploy lai.",
    );
    return;
  }
  try {
    await bot.setWebHook(WEBHOOK_URL + "/webhook", {
      secret_token: WEBHOOK_SECRET,
    });
    console.log("Webhook da dang ky: " + WEBHOOK_URL + "/webhook");
  } catch (e) {
    console.error("Dang ky webhook that bai:", e.message);
  }
});
