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
  modules: {
    fps: true, cpu: true, ram: true, gpu: true, battery: true, uptime: true,
    ping: false, crosshair: false, net: false, disk: false,
  },
  fontSize: 13,
  opacity: 100,
  fpsAlertThreshold: 30,
  unlocked: false,
  gpu: null,
  net: { iface: '—', rx: 0, tx: 0 },
  disk: { mount: '—', used: 0, size: 0, percent: 0 },
  user: '—',
  uptime: 0,
};

// ---------- FPS ----------

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

function pushHistory(v) { history[histIdx++ % history.length] = v; }

function drawGraph() {
  CTX.clearRect(0, 0, FPS_GRAPH.width, FPS_GRAPH.height);
  CTX.strokeStyle = 'var(--green)';
  CTX.lineWidth = 1;
  CTX.beginPath();
  const step = FPS_GRAPH.width / history.length;
  history.forEach((v, i) => {
    const h = Math.min(v, 140);
    const y = 24 - (h / 140) * 20;
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
  if (c.gpu) cfg.gpu = c.gpu;
});

electronAPI.on('gpu-update', (gpu) => { cfg.gpu = gpu; render(); });

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
}

// ---------- метрики ----------

electronAPI.on('stats-update', (d) => {
  cfg.net = d.net || cfg.net;
  cfg.disk = d.disk || cfg.disk;
  cfg.user = d.user || cfg.user;
  cfg.uptime = d.uptime || cfg.uptime;
  renderMetrics(d);
});

let pingTimer = null;
function startPing() {
  if (pingTimer) clearInterval(pingTimer);
  if (cfg.modules.ping !== true) return;
  pingTimer = setInterval(async () => {
    try {
      const res = await electronAPI.invoke('ping:check', { host: cfg.pingHost || '1.1.1.1', port: Number(cfg.pingPort || 443) });
      const el = document.getElementById('metric-ping');
      if (el) el.querySelector('.value').textContent = res.ok ? res.ms + ' МС' : '—';
    } catch (e) { /* ignore */ }
  }, 3000);
}
function stopPing() { if (pingTimer) { clearInterval(pingTimer); pingTimer = null; } }

function formatUptime(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return [h, m, sec].map(v => v < 10 ? '0' + v : v).join(':');
}

function renderMetrics(d) {
  const rows = [];
  const mod = cfg.modules || {};

  const now = new Date();
  const timeStr = [now.getHours(), now.getMinutes(), now.getSeconds()].map(v => v < 10 ? '0' + v : v).join(':');

  rows.push(`<div class="metric-row" id="metric-time"><span class="name">TIME</span><span class="value">${timeStr}</span></div>`);
  if (mod.user !== false) {
    rows.push(`<div class="metric-row" id="metric-user"><span class="name">USER</span><span class="value">${cfg.user}</span></div>`);
  }
  if (mod.fps !== false) {
    rows.push(`<div class="metric-row" id="metric-fps"><span class="name">FPS</span><span class="value">${d.cpu !== undefined ? fps : '--'}</span></div>`);
  }
  if (mod.cpu !== false) {
    rows.push(`<div class="metric-row" id="metric-cpu"><span class="name">CPU</span><span class="value">${d.cpu || 0}%</span></div>`);
  }
  if (mod.ram !== false) {
    rows.push(`<div class="metric-row" id="metric-ram"><span class="name">RAM</span><span class="value">${d.ram.used} / ${d.ram.total} МБ</span><span class="sub">${d.ram.percent}%</span></div>`);
  }
  if (mod.gpu !== false && cfg.gpu) {
    rows.push(`<div class="metric-row" id="metric-gpu"><span class="name">GPU</span><span class="value">${cfg.gpu.model || cfg.gpu.vendor || 'GPU'}</span></div>`);
  }
  if (mod.battery !== false && d.battery) {
    rows.push(`<div class="metric-row" id="metric-battery"><span class="name">BATT</span><span class="value">${d.battery.percent}% ${d.battery.isCharging ? '+' : ''}</span></div>`);
  }
  if (mod.uptime !== false) {
    rows.push(`<div class="metric-row" id="metric-uptime"><span class="name">UPTIME</span><span class="value">${formatUptime(cfg.uptime)}</span></div>`);
  }
  if (mod.net !== false) {
    rows.push(`<div class="metric-row" id="metric-net"><span class="name">NET ${cfg.net.iface}</span><span class="value">↓${cfg.net.rx} КБ/с ↑${cfg.net.tx} КБ/с</span></div>`);
  }
  if (mod.disk !== false) {
    rows.push(`<div class="metric-row" id="metric-disk"><span class="name">DISK ${cfg.disk.mount}</span><span class="value">${cfg.disk.used} / ${cfg.disk.size} ГБ</span><span class="sub">${cfg.disk.percent}%</span></div>`);
  }
  if (mod.ping !== false) {
    rows.push(`<div class="metric-row" id="metric-ping"><span class="name">PING ${cfg.pingHost}</span><span class="value">—</span></div>`);
  }
  METRICS.innerHTML = rows.join('');
  startPing();
}

// ---------- старт ----------
tick();
