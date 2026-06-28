const TOKEN = process.env.TELEGRAM_TOKEN || "7504360348:AAHwDzXqkikSstpzhuk_R9uMg3XljWTqGM4";
const CHAT_ID = process.env.CHAT_ID || "-1003027102929";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { text, buttons } = req.body;

    const payload = {
      chat_id: CHAT_ID,
      text,
      parse_mode: "HTML",
    };
    if (buttons && buttons.length) {
      payload.reply_markup = { inline_keyboard: buttons };
    }

    const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    return res.status(200).json({ ok: true, data });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
