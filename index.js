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

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "Chào cậu, tớ là bot nhắc dịp lễ và sự kiện!\n\n- Bật nhắc: /nhacnho\n- Thêm dịp: /themdip <tên> <ngày/tháng> (ví dụ: /themdip Sinh nhật mẹ 12/5)\n- Xem dịp đã lưu: /xemdip\n- Xóa dịp: /xoadip <số>\n- Tắt nhắc: /nhacnho tat\n\nMỗi sáng 8h, tớ nhắn khi có ngày lễ hoặc dịp của cậu còn 7 ngày, 1 ngày hoặc đúng hôm đó.",
  );
});

// ===== MODULE NHAC HEN =====
const fsNho = require("fs");
const pathNho = require("path");
const cronNho = require("node-cron");

const DUONG_DAN_NHO = pathNho.join(__dirname, "data", "nhac-nho.json");

const NGAY_LE_CO_DINH = [
  { ten: "Tết Dương lịch", ngay: 1, thang: 1 },
  { ten: "Valentine", ngay: 14, thang: 2 },
  { ten: "Quốc tế Phụ nữ", ngay: 8, thang: 3 },
  { ten: "Giải phóng miền Nam", ngay: 30, thang: 4 },
  { ten: "Quốc tế Lao động", ngay: 1, thang: 5 },
  { ten: "Quốc tế Thiếu nhi", ngay: 1, thang: 6 },
  { ten: "Quốc khánh", ngay: 2, thang: 9 },
  { ten: "Phụ nữ Việt Nam", ngay: 20, thang: 10 },
  { ten: "Nhà giáo Việt Nam", ngay: 20, thang: 11 },
  { ten: "Giáng sinh", ngay: 25, thang: 12 },
];

// Tết Âm lịch: kiểm tra lại lịch âm mỗi năm rồi sửa bảng này
const TET_AM_LICH = { 2026: [17, 2], 2027: [6, 2] };

function taiDuLieuNho() {
  try {
    return JSON.parse(fsNho.readFileSync(DUONG_DAN_NHO, "utf8"));
  } catch (e) {
    return {};
  }
}

function luuDuLieuNho(duLieu) {
  fsNho.mkdirSync(pathNho.dirname(DUONG_DAN_NHO), { recursive: true });
  fsNho.writeFileSync(DUONG_DAN_NHO, JSON.stringify(duLieu, null, 2), "utf8");
}

function layNguoiDungNho(duLieu, chatId) {
  const id = String(chatId);
  if (!duLieu[id]) duLieu[id] = { remind: false, occasions: [] };
  return duLieu[id];
}

// "Hôm nay" theo giờ Việt Nam, cắt về 0h00
function homNayVN() {
  const bayGio = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }),
  );
  bayGio.setHours(0, 0, 0, 0);
  return bayGio;
}

// Số ngày từ hôm nay tới lần xuất hiện gần nhất của ngày/tháng đó (tự lăn sang năm sau)
function demNgayNho(ngay, thang) {
  const homNay = homNayVN();
  let mucTieu = new Date(homNay.getFullYear(), thang - 1, ngay);
  if (mucTieu < homNay)
    mucTieu = new Date(homNay.getFullYear() + 1, thang - 1, ngay);
  return Math.round((mucTieu - homNay) / 86400000);
}

function dongNhac(ten, conLai) {
  if (conLai === 0) return `• ${ten} — hôm nay!`;
  if (conLai === 1) return `• ${ten} — ngày mai!`;
  return `• ${ten} — còn ${conLai} ngày nữa.`;
}

async function quetVaNhac() {
  const duLieu = taiDuLieuNho();
  const homNay = homNayVN();
  const namHienTai = homNay.getFullYear();
  for (const [chatId, nd] of Object.entries(duLieu)) {
    if (!nd.remind) continue;
    const dong = [];
    const suKien = [...NGAY_LE_CO_DINH];
    const tet = TET_AM_LICH[namHienTai];
    if (tet) suKien.push({ ten: "Tết Âm lịch", ngay: tet[0], thang: tet[1] });
    for (const s of suKien) {
      const conLai = demNgayNho(s.ngay, s.thang);
      if ([0, 1, 7].includes(conLai)) dong.push(dongNhac(s.ten, conLai));
    }
    for (const o of nd.occasions) {
      const conLai = demNgayNho(o.ngay, o.thang);
      if ([0, 1, 7].includes(conLai)) dong.push(dongNhac(o.ten, conLai));
    }
    if (dong.length === 0) continue;
    const tin = `Sắp tới có dịp này nè:\n${dong.join("\n")}\n\nTắt nhắc: /nhacnho tat`;
    try {
      await bot.sendMessage(chatId, tin);
    } catch (e) {}
  }
}

// Lệnh /nhacnho, /nhacnho bat, /nhacnho tat
bot.onText(/\/nhacnho/, (msg) => {
  const duLieu = taiDuLieuNho();
  const nd = layNguoiDungNho(duLieu, msg.chat.id);
  if (/tat/.test(msg.text)) {
    nd.remind = false;
    luuDuLieuNho(duLieu);
    bot.sendMessage(
      msg.chat.id,
      "Tắt nhắc hẹn rồi nhé. Bật lại thì gõ /nhacnho bat.",
    );
  } else {
    nd.remind = true;
    luuDuLieuNho(duLieu);
    bot.sendMessage(
      msg.chat.id,
      "Bật nhắc hẹn rồi nhé! Mỗi sáng 8h, bot sẽ nhắn khi có ngày lễ hoặc dịp của cậu còn 7 ngày, 1 ngày hoặc đúng hôm đó. Xem dịp đã lưu: /xemdip.",
    );
  }
});

// Lệnh /themdip <tên> <DD/MM>
bot.onText(/\/themdip/, (msg) => {
  const khop = msg.text.match(/(\d{1,2})\/(\d{1,2})\s*$/);
  if (!khop) {
    bot.sendMessage(
      msg.chat.id,
      "Cú pháp: /themdip <tên dịp> <ngày/tháng>. Ví dụ: /themdip Sinh nhật mẹ 12/5",
    );
    return;
  }
  const ngay = parseInt(khop[1], 10);
  const thang = parseInt(khop[2], 10);
  const ten = msg.text
    .replace(/\/themdip\s*/, "")
    .replace(/(\d{1,2})\/(\d{1,2})\s*$/, "")
    .trim();
  const thu = new Date(2024, thang - 1, ngay);
  if (
    !ten ||
    thang < 1 ||
    thang > 12 ||
    ngay < 1 ||
    ngay > 31 ||
    thu.getMonth() !== thang - 1
  ) {
    bot.sendMessage(
      msg.chat.id,
      "Ngày chưa đúng rồi, cậu kiểm tra lại nhé. Ví dụ: /themdip Sinh nhật mẹ 12/5",
    );
    return;
  }
  const duLieu = taiDuLieuNho();
  const nd = layNguoiDungNho(duLieu, msg.chat.id);
  nd.occasions.push({ ten, ngay, thang });
  nd.remind = true;
  luuDuLieuNho(duLieu);
  bot.sendMessage(
    msg.chat.id,
    `Đã lưu: ${ten} (${ngay}/${thang}). Nhắc hẹn đang bật. Xem lại: /xemdip.`,
  );
});

// Lệnh /xemdip
bot.onText(/\/xemdip/, (msg) => {
  const duLieu = taiDuLieuNho();
  const nd = layNguoiDungNho(duLieu, msg.chat.id);
  if (nd.occasions.length === 0) {
    bot.sendMessage(
      msg.chat.id,
      "Cậu chưa lưu dịp nào. Thêm bằng: /themdip <tên> <ngày/tháng>. Ví dụ: /themdip Sinh nhật mẹ 12/5",
    );
    return;
  }
  const dong = nd.occasions.map(
    (o, i) => `${i + 1}. ${o.ten} (${o.ngay}/${o.thang})`,
  );
  bot.sendMessage(
    msg.chat.id,
    `Các dịp cậu đã lưu:\n${dong.join("\n")}\n\nXóa: /xoadip <số>. Nhắc hẹn đang ${nd.remind ? "bật" : "tắt"}.`,
  );
});

// Lệnh /xoadip <số>
bot.onText(/\/xoadip/, (msg) => {
  const so = parseInt((msg.text.match(/\d+/) || [])[0], 10);
  const duLieu = taiDuLieuNho();
  const nd = layNguoiDungNho(duLieu, msg.chat.id);
  if (!so || so < 1 || so > nd.occasions.length) {
    bot.sendMessage(
      msg.chat.id,
      "Cú pháp: /xoadip <số>. Xem số thứ tự bằng /xemdip.",
    );
    return;
  }
  const [daXoa] = nd.occasions.splice(so - 1, 1);
  luuDuLieuNho(duLieu);
  bot.sendMessage(
    msg.chat.id,
    `Đã xóa: ${daXoa.ten} (${daXoa.ngay}/${daXoa.thang}).`,
  );
});

// Hẹn giờ 8h sáng giờ Việt Nam, quét mỗi ngày một lần
cronNho.schedule("* * * * *", quetVaNhac, { timezone: "Asia/Ho_Chi_Minh" });
console.log("Module nhac hen da san sang.");

// ===== WEB SERVER (WEBHOOK) =====
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
