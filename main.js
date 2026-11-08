const { app, BrowserWindow, globalShortcut, ipcMain, screen } = require('electron');
const path = require('node:path');
const si = require('systeminformation');
const config = require('./config');
const optimizer = require('./optimizer');

let overlayWin = null;
let menuWin = null;
let statsInterval = null;

const DEFAULT_HOTKEY = 'Ctrl+Alt+X';

function getOverlayPosition() {
  const pos = config.get('overlayPosition') || 'top-right';
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const w = 340;
  const h = 210;
  const pad = 24;
  const positions = {
    'top-left': [pad, pad],
    'top-right': [width - w - pad, pad],
    'bottom-left': [pad, height - h - pad],
    'bottom-right': [width - w - pad, height - h - pad],
  };
  return positions[pos] || positions['top-right'];
}

function createOverlay() {
  const [x, y] = getOverlayPosition();
  overlayWin = new BrowserWindow({
    x,
    y,
    width: 340,
    height: 210,
    minWidth: 260,
    minHeight: 150,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    acceptFirstMouse: true,
    ignoreMouseEvents: config.get('clickThrough') !== false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  overlayWin.loadFile('overlay.html');
  overlayWin.setVisibleOnAllWorkspaces(true);
  overlayWin.setAlwaysOnTop(true, 'floating');

  overlayWin.webContents.on('did-finish-load', () => {
    overlayWin.webContents.send('config:get-all', config.getAll());
  });

  overlayWin.on('closed', () => {
    overlayWin = null;
    stopStats();
  });
}

function createMenu() {
  if (menuWin && !menuWin.isDestroyed()) {
    if (menuWin.isVisible() && menuWin.isFocused()) {
      menuWin.hide();
    } else {
      menuWin.show();
      menuWin.focus();
    }
    return;
  }
  menuWin = new BrowserWindow({
    width: 780,
    height: 640,
    minWidth: 640,
    minHeight: 500,
    title: 'GamingX Overlay — Панель управления',
    alwaysOnTop: true,
    fullscreenable: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  menuWin.loadFile('index.html');
  menuWin.on('closed', () => {
    menuWin = null;
  });
}

function toggleMenu() {
  if (menuWin && !menuWin.isDestroyed()) {
    if (menuWin.isVisible() && menuWin.isFocused()) {
      menuWin.hide();
    } else {
      menuWin.show();
      menuWin.focus();
    }
  } else {
    createMenu();
  }
}

function registerHotkey() {
  globalShortcut.unregisterAll();
  const hk = config.get('hotkey') || DEFAULT_HOTKEY;
  const ok = globalShortcut.register(hk, toggleMenu);
  if (!ok) {
    console.warn('[GamingX] Не удалось зарегистрировать горячую клавишу:', hk);
  } else {
    console.log('[GamingX] Горячая клавиша зарегистрирована:', hk);
  }
}

function startStats() {
  stopStats();
  const interval = Math.max(500, config.get('statsInterval') || 1000);
  statsInterval = setInterval(async () => {
    if (!overlayWin || overlayWin.isDestroyed()) return;
    try {
      const [load, mem, battery] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.battery().catch(() => null),
      ]);
      let gpu = null;
      try {
        const g = await si.graphics();
        gpu = (g.controllers || [])[0] || null;
      } catch (e) {
        // GPU-информация недоступна на этой платформе
      }
      overlayWin.webContents.send('stats-update', {
        cpu: Math.round(load.currentload || 0),
        ram: {
          used: Math.round((mem.used || 0) / 1024 / 1024),
          total: Math.round(mem.total / 1024 / 1024),
          percent: Math.round(((mem.used || 0) / mem.total) * 100),
        },
        gpu,
        battery: battery
          ? { percent: Math.round(battery.percent || 0), isCharging: !!battery.isCharging, secsLeft: battery.secsLeft }
          : null,
      });
    } catch (e) {
      // тихо忽略 ошибки сбора системной инфы
    }
  }, interval);
}

function stopStats() {
  if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = null;
  }
}

app.whenReady().then(() => {
  createOverlay();
  registerHotkey();
  startStats();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createOverlay();
    }
  });
});

app.on('window-all-closed', () => {
  // Оверлей продолжает работать в фоне поверх всех приложений.
  // Не выходим автоматически, чтобы не убить оверлей посреди игры.
});

app.on('before-quit', () => {
  globalShortcut.unregisterAll();
  stopStats();
});

// ---------- IPC ----------

ipcMain.handle('config:get', (_, key) => config.get(key));
ipcMain.handle('config:set', (_, key, value) => config.set(key, value));
ipcMain.handle('config:get-all', () => config.getAll());

ipcMain.handle('stats:request', async () => {
  const [load, mem] = await Promise.all([si.currentLoad(), si.mem()]);
  return {
    cpu: Math.round(load.currentload || 0),
    ram: {
      used: Math.round(mem.used / 1024 / 1024),
      total: Math.round(mem.total / 1024 / 1024),
      percent: Math.round((mem.used / mem.total) * 100),
    },
  };
});

ipcMain.handle('menu:toggle', toggleMenu);
ipcMain.handle('hotkey:register', registerHotkey);
ipcMain.handle('start-stats', startStats);

ipcMain.handle('overlay:reconfigure', () => {
  if (overlayWin && !overlayWin.isDestroyed()) {
    overlayWin.setIgnoreMouseEvents(config.get('clickThrough') !== false);
    overlayWin.webContents.send('config:get-all', config.getAll());
  }
  const [x, y] = getOverlayPosition();
  if (overlayWin && !overlayWin.isDestroyed()) {
    overlayWin.setPosition(x, y);
  }
});

ipcMain.handle('optimizer:game-boost', async () => optimizer.gameBoost());
ipcMain.handle('optimizer:high-perf', async () => optimizer.setHighPerformance());
ipcMain.handle('optimizer:clean-temp', async () => optimizer.cleanTemp());
ipcMain.handle('optimizer:kill-process', async (_, pid) => optimizer.killProcess(pid));
ipcMain.handle('ping:check', async (_, { host, port }) => optimizer.pingHost(host, port));
