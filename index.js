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

// Tự động tính ngày Mùng 1 Tết Âm lịch theo múi giờ Việt Nam (UTC+7)
function jdFromDate(dd, mm, yy) {
  const a = Math.floor((14 - mm) / 12);
  const y = yy + 4800 - a;
  const m = mm + 12 * a - 3;
  return (
    dd +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

function jdToDate(jd) {
  const a = jd + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((b * 146097) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  const day = e - Math.floor((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * Math.floor(m / 10);
  const year = b * 100 + d - 4800 + Math.floor(m / 10);
  return [day, month, year];
}

function getNewMoonDay(k, timeZone) {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const dr = Math.PI / 180;
  let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  Jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let C1 =
    (0.1734 - 0.000393 * T) * Math.sin(M * dr) +
    0.0021 * Math.sin(2 * dr * M) -
    0.4068 * Math.sin(Mpr * dr) +
    0.0161 * Math.sin(dr * 2 * Mpr) -
    0.0004 * Math.sin(dr * 3 * Mpr) +
    0.0104 * Math.sin(dr * 2 * F) -
    0.0051 * Math.sin(dr * (M + Mpr)) -
    0.0074 * Math.sin(dr * (M - Mpr)) +
    0.0004 * Math.sin(dr * (2 * F + M)) -
    0.0004 * Math.sin(dr * (2 * F - M)) -
    0.0006 * Math.sin(dr * (2 * F + Mpr)) +
    0.001 * Math.sin(dr * (2 * F - Mpr)) +
    0.0005 * Math.sin(dr * (2 * Mpr + M));
  const deltat =
    T < -11
      ? 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3
      : -0.000278 + 0.000265 * T + 0.000262 * T2;
  return Math.floor(Jd1 + C1 - deltat + 0.5 + timeZone / 24);
}

function getSunLongitude(jdn, timeZone) {
  const T = (jdn - 2451545.5 - timeZone / 24) / 36525;
  const T2 = T * T;
  const dr = Math.PI / 180;
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  DL += (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.00029 * Math.sin(dr * 3 * M);
  let L = (L0 + DL) * dr;
  L = L - Math.PI * 2 * Math.floor(L / (Math.PI * 2));
  return Math.floor((L / Math.PI) * 6);
}

function getLunarMonth11(yy, timeZone) {
  const off = jdFromDate(31, 12, yy) - 2415021;
  const k = Math.floor(off / 29.530588853);
  let nm = getNewMoonDay(k, timeZone);
  if (getSunLongitude(nm, timeZone) >= 9) nm = getNewMoonDay(k - 1, timeZone);
  return nm;
}

function getLeapMonthOffset(a11, timeZone) {
  const k = Math.floor((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let last = 0;
  let i = 1;
  let arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
  do {
    last = arc;
    i++;
    arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
  } while (arc !== last && i < 14);
  return i - 1;
}

function ngayTetAmLich(namDuong) {
  const timeZone = 7;
  const a11 = getLunarMonth11(namDuong - 1, timeZone);
  const b11 = getLunarMonth11(namDuong, timeZone);
  let k = Math.floor(0.5 + (a11 - 2415021.076998695) / 29.530588853);
  let thangGiengOffset = 2;
  if (b11 - a11 > 365) {
    const leapOff = getLeapMonthOffset(a11, timeZone);
    if (leapOff <= 2) thangGiengOffset = 3;
  }
  const jdTet = getNewMoonDay(k + thangGiengOffset, timeZone);
  const [ngay, thang, nam] = jdToDate(jdTet);
  return new Date(nam, thang - 1, ngay);
}

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

// Số ngày từ hôm nay tới một mốc Date cụ thể
function demNgayDen(mucTieu) {
  return Math.round((mucTieu - homNayVN()) / 86400000);
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
  let tet = ngayTetAmLich(namHienTai);
  if (tet < homNay) tet = ngayTetAmLich(namHienTai + 1);
  const conLaiTet = demNgayDen(tet);

  for (const [chatId, nd] of Object.entries(duLieu)) {
    if (!nd.remind) continue;
    const dong = [];
    for (const s of NGAY_LE_CO_DINH) {
      const conLai = demNgayNho(s.ngay, s.thang);
      if ([0, 1, 7].includes(conLai)) dong.push(dongNhac(s.ten, conLai));
    }
    if ([0, 1, 7].includes(conLaiTet)) {
      dong.push(dongNhac("Tết Âm lịch", conLaiTet));
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
cronNho.schedule("0 8 * * *", quetVaNhac, { timezone: "Asia/Ho_Chi_Minh" });
console.log("Module nhac hen da san sang.");

// Hẹn giờ đánh thức bot lúc 7:55 sáng giờ Việt Nam
// Cron này ping service lên để Render không sleep (dành cho free tier)
cronNho.schedule("55 7 * * *", async () => {
  try {
    const url = process.env.WEBHOOK_URL || process.env.RENDER_EXTERNAL_URL;
    if (url) {
      const http = require("http");
      http.get(`http://${url}/`, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => console.log(`[Wake-up] Ping status: ${res.statusCode}`));
      }).on("error", (e) => console.error(`[Wake-up] Ping error: ${e.message}`));
    } else {
      console.log("[Wake-up] Chua co WEBHOOK_URL/RENDER_EXTERNAL_URL - bot se sleep tiep");
    }
  } catch (err) {
    console.error(`[Wake-up] Loi cron: ${err.message}`);
  }
}, { timezone: "Asia/Ho_Chi_Minh" });
console.log("Module wake-up da san sang.");

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
