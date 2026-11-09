const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

const DEFAULTS = {
  hotkey: 'Ctrl+Alt+X',
  overlayPosition: 'top-right',
  clickThrough: true,
  opacity: 100,
  fontSize: 16,
  statsInterval: 1000,
  fpsAlertThreshold: 30,
  theme: 'dark',
  modules: {
    fps: true,
    cpu: true,
    ram: true,
    gpu: true,
    battery: true,
    uptime: true,
    ping: false,
    crosshair: false,
  },
  pingHost: '1.1.1.1',
  pingPort: 443,
};

let cache = null;

function configFile() {
  return path.join(app.getPath('userData'), 'config.json');
}

function load() {
  try {
    if (fs.existsSync(configFile())) {
      cache = JSON.parse(fs.readFileSync(configFile(), 'utf8'));
    }
  } catch (e) {
    console.warn('[GamingX] Ошибка чтения конфига:', e.message);
    cache = null;
  }
  if (!cache) cache = {};
  const merged = { ...DEFAULTS, ...cache };
  merged.modules = { ...DEFAULTS.modules, ...(cache.modules || {}) };
  return merged;
}

function save(cfg) {
  fs.mkdirSync(path.dirname(configFile()), { recursive: true });
  fs.writeFileSync(configFile(), JSON.stringify(cfg, null, 2));
}

module.exports = {
  getAll() {
    return load();
  },
  get(key) {
    const cfg = load();
    return key === undefined ? cfg : cfg[key];
  },
  set(key, value) {
    const cfg = load();
    if (key === 'modules' && typeof value === 'object') {
      cfg.modules = { ...cfg.modules, ...value };
    } else {
      cfg[key] = value;
    }
    cache = cfg;
    save(cfg);
    return cfg[key];
  },
};
