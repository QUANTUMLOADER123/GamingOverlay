const { electronAPI } = window;

const FPS_VALUE = document.getElementById('fps-value');
const FPS_GRAPH = document.getElementById('fps-graph');
const METRICS = document.getElementById('metrics');
const HINT = document.getElementById('hint');
const CROSSHAIR = document.getElementById('crosshair');
const CTX = FPS_GRAPH.getContext('2d');

let fps = 0;
let frames = 0;
let lastTime = performance.now();
const history = new Array(FPS_GRAPH.width).fill(0);
let histIdx = 0;

let cfg = {
  modules: { fps: true, cpu: true, ram: true, gpu: true, battery: true, uptime: true, ping: false, crosshair: false },
  fontSize: 16,
  opacity: 100,
  fpsAlertThreshold: 30,
  unlocked: false,
};

// ---------- FPS измерение ----------

function tick() {
  const now = performance.now();
  frames++;
  if (now - lastTime >= 1000) {
    fps = frames;
    frames = 0;
    lastTime = now;
    FPS_VALUE.textContent = fps;
    pushHistory(fps);
    drawGraph();
    updateAlertColor(fps);
  }
  requestAnimationFrame(tick);
}

function pushHistory(v) {
  history[histIdx++ % history.length] = v;
}

function drawGraph() {
  CTX.clearRect(0, 0, FPS_GRAPH.width, FPS_GRAPH.height);
  CTX.strokeStyle = 'var(--neon-cyan)';
  CTX.lineWidth = 2;
  CTX.beginPath();
  const step = FPS_GRAPH.width / history.length;
  history.forEach((v, i) => {
    const y = 40 - Math.min(v, 140) / 140 * 36;
    i === 0 ? CTX.moveTo(i * step, y) : CTX.lineTo(i * step, y);
  });
  CTX.stroke();
}

function updateAlertColor(v) {
  FPS_VALUE.className = 'value' + (v < cfg.fpsAlertThreshold ? ' alert' : '');
}

// ---------- конфиг ----------

electronAPI.on('config:get-all', (c) => {
  cfg = { ...cfg, ...c, modules: { ...cfg.modules, ...(c.modules || {}) } };
  applyConfig(cfg);
  render();
});

function applyConfig(c) {
  document.documentElement.style.setProperty('--opacity', c.opacity / 100);
  document.documentElement.style.setProperty('--font-size', c.fontSize + 'px');
  const root = document.documentElement;
  Object.entries(c.modules || {}).forEach(([key, on]) => {
    root.classList.toggle('mod-' + key, on !== false);
  });
  document.body.classList.toggle('unlocked', c.unlocked === true);
  document.getElementById('fps-box').style.display = c.modules.fps !== false ? '' : 'none';
  FPS_GRAPH.style.display = c.modules.fps !== false ? '' : 'none';
  CROSSHAIR.style.display = c.modules.crosshair === true ? '' : 'none';
  HINT.style.opacity = c.modules.fps !== false || c.modules.cpu !== false ? '1' : '0.35';
}

// ---------- системные метрики ----------

electronAPI.on('stats-update', (data) => {
  renderMetrics(data);
});

// пинг модуля
let pingTimer = null;
function startPing() {
  if (pingTimer) clearInterval(pingTimer);
  if (cfg.modules.ping !== true) return;
  pingTimer = setInterval(async () => {
    try {
      const res = await electronAPI.invoke('ping:check', { host: cfg.pingHost || '1.1.1.1', port: Number(cfg.pingPort || 443) });
      const el = document.getElementById('metric-ping');
      if (el) el.querySelector('.value').textContent = res.ok ? res.ms + ' мс' : '—';
    } catch (e) { /* ignore */ }
  }, 3000);
}
function stopPing() { if (pingTimer) { clearInterval(pingTimer); pingTimer = null; } }

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map(v => v < 10 ? '0' + v : v).join(':');
}

function renderMetrics(d) {
  const rows = [];
  const mod = cfg.modules || {};

  if (mod.cpu !== false) {
    rows.push(`<div class="metric-row" id="metric-cpu"><span class="name">CPU</span><span class="value">${d.cpu || 0}%</span></div>`);
  }
  if (mod.ram !== false) {
    rows.push(`<div class="metric-row" id="metric-ram"><span class="name">RAM</span><span class="value">${d.ram.used} / ${d.ram.total} МБ</span><span class="sub">${d.ram.percent}%</span></div>`);
  }
  if (mod.gpu !== false && d.gpu) {
    rows.push(`<div class="metric-row" id="metric-gpu"><span class="name">GPU</span><span class="value">${d.gpu.model || d.gpu.vendor || 'GPU'}</span></div>`);
  }
  if (mod.battery !== false && d.battery) {
    rows.push(`<div class="metric-row" id="metric-battery"><span class="name">BATTERY</span><span class="value">${d.battery.percent}% ${d.battery.isCharging ? '⚡' : ''}</span></div>`);
  }
  if (mod.uptime !== false) {
    rows.push(`<div class="metric-row" id="metric-uptime"><span class="name">UPTIME</span><span class="value">${formatUptime(d.uptime || processUptime())}</span></div>`);
  }
  if (mod.ping !== false) {
    rows.push(`<div class="metric-row" id="metric-ping"><span class="name">PING ${cfg.pingHost}</span><span class="value">—</span></div>`);
  }
  METRICS.innerHTML = rows.join('');
  startPing();
}

function processUptime() {
  return 0;
}

// ---------- старт ----------

tick();
