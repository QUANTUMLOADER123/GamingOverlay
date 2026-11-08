const { app, BrowserWindow, globalShortcut, ipcMain, screen, Tray, Menu, nativeImage, powerSaveBlocker } = require('electron');
const path = require('node:path');
const si = require('systeminformation');
const config = require('./config');
const optimizer = require('./optimizer');

let overlayWin = null;
let menuWin = null;
let tray = null;
let statsInterval = null;
const DEFAULT_HOTKEY = 'Ctrl+Alt+X';

function getOverlayPosition() {
  const pos = config.get('overlayPosition') || 'top-right';
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const w = 360;
  const h = 220;
  const pad = 20;
  const positions = {
    'top-left': [pad, pad],
    'top-right': [width - w - pad, pad],
    'bottom-left': [pad, height - h - pad],
    'bottom-right': [width - w - pad, height - h - pad],
  };
  return positions[pos] || positions['top-right'];
}

function createTray() {
  const iconPath = path.join(__dirname, 'build', 'icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);

  const template = [
    { label: 'Показать / скрыть оверлей', click: () => { if (overlayWin) overlayWin.isVisible() ? overlayWin.hide() : overlayWin.show(); } },
    { label: 'Меню управления (Ctrl+Alt+X)', click: toggleMenu },
    { type: 'separator' },
    { label: 'Game Boost', click: () => optimizer.gameBoost() },
    { label: 'Высокая производительность (питание)', click: () => optimizer.setHighPerformance() },
    { type: 'separator' },
    {
      label: 'Автозапуск с Windows',
      type: 'checkbox',
      checked: config.get('autostart') !== false,
      click: (item) => {
        config.set('autostart', item.checked === true);
        app.setLoginItemSettings({ openAtLogin: item.checked === true });
      },
    },
    { type: 'separator' },
    { label: 'Выход', click: () => app.quit() },
  ];
  const contextMenu = Menu.buildFromTemplate(template);
  tray.setContextMenu(contextMenu);
  tray.setToolTip('GamingX Overlay — оверлей активен');
  tray.on('double-click', toggleMenu);
}

function createOverlay() {
  const [x, y] = getOverlayPosition();
  overlayWin = new BrowserWindow({
    x,
    y,
    width: 360,
    height: 220,
    minWidth: 280,
    minHeight: 160,
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
    width: 900,
    height: 720,
    minWidth: 700,
    minHeight: 520,
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
      const [load, mem, battery, net, fs, user] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.battery().catch(() => null),
        si.networkStats().catch(() => []),
        si.fsSize().catch(() => []),
        si.users().catch(() => []),
      ]);
      const activeNet = (net || []).find((n) => n.operstate === 'up' || (n.rx_sec || 0) > 0 || (n.tx_sec || 0) > 0) || (net || [])[0] || {};
      const systemDisk = (fs || []).find((d) => d.mount === 'C:' || d.mount === '/') || (fs || [])[0] || {};
      overlayWin.webContents.send('stats-update', {
        cpu: Math.round(load.currentload || 0),
        ram: {
          used: Math.round((mem.used || 0) / 1024 / 1024),
          total: Math.round(mem.total / 1024 / 1024),
          percent: Math.round(((mem.used || 0) / mem.total) * 100),
        },
        gpu: null,
        battery: battery
          ? { percent: Math.round(battery.percent || 0), isCharging: !!battery.isCharging, secsLeft: battery.secsLeft }
          : null,
        net: {
          iface: activeNet.iface || '—',
          rx: Math.round((activeNet.rx_sec || 0) / 1024),
          tx: Math.round((activeNet.tx_sec || 0) / 1024),
        },
        disk: {
          mount: systemDisk.mount || '—',
          used: Math.round((systemDisk.used || 0) / 1024 / 1024 / 1024),
          size: Math.round((systemDisk.size || 0) / 1024 / 1024 / 1024),
          percent: systemDisk.use ? Math.round(systemDisk.use) : 0,
        },
        user: (user || [])[0] ? (user || [])[0].user || '—' : '—',
        uptime: Math.floor(process.uptime()),
      });
      try {
        const g = await si.graphics();
        const gpu = (g.controllers || [])[0] || null;
        overlayWin.webContents.send('gpu-update', gpu);
      } catch (e) { /* GPU info unavailable */ }
    } catch (e) {
      // тихо игнорируем ошибки сбора системной инфы
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
  createTray();
  createOverlay();
  registerHotkey();
  startStats();

  if (config.get('autostart') !== false) {
    app.setLoginItemSettings({ openAtLogin: true });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createOverlay();
    }
  });
});

app.on('window-all-closed', () => {
  // Оверлей продолжает работать в фоне поверх всех приложений.
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
ipcMain.handle('optimizer:flush-dns', async () => optimizer.flushDns());
ipcMain.handle('optimizer:reset-winsock', async () => optimizer.resetWinsock());
ipcMain.handle('optimizer:reset-tcpip', async () => optimizer.resetTcpIp());
ipcMain.handle('optimizer:clean-prefetch', async () => optimizer.cleanPrefetch());
ipcMain.handle('optimizer:clean-windows-temp', async () => optimizer.cleanWindowsTemp());
ipcMain.handle('optimizer:clean-wu-cache', async () => optimizer.cleanWindowsUpdateCache());
ipcMain.handle('optimizer:clear-icon-cache', async () => optimizer.clearIconCache());
ipcMain.handle('optimizer:game-mode', async () => optimizer.setGameMode());
ipcMain.handle('optimizer:set-process-priority', async (_, { pid, priority }) => optimizer.setProcessPriority(pid, priority));
ipcMain.handle('optimizer:optimize-network', async () => optimizer.optimizeNetwork());
ipcMain.handle('optimizer:run-sfc', async () => optimizer.runSfc());
ipcMain.handle('optimizer:run-dism', async () => optimizer.runDism());
ipcMain.handle('optimizer:kill-process', async (_, pid) => optimizer.killProcess(pid));
ipcMain.handle('ping:check', async (_, { host, port }) => optimizer.pingHost(host, port));
