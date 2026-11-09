const { electronAPI } = window;

const $ = (id) => document.getElementById(id);
const hotkeyDisplay = $('hotkeyDisplay');
const btnRecordHotkey = $('btnRecordHotkey');
const btnApplyHotkey = $('btnApplyHotkey');
const btnToggleMenu = $('btnToggleMenu');
const clickThrough = $('clickThrough');

const posBtns = document.querySelectorAll('.pos-btn');
let activePos = 'top-right';

const opacity = $('opacity');
const opacityVal = $('opacityVal');
const fontSize = $('fontSize');
const fontSizeVal = $('fontSizeVal');

const modFps = $('modFps');
const modCpu = $('modCpu');
const modRam = $('modRam');
const modGpu = $('modGpu');
const modBattery = $('modBattery');
const modUptime = $('modUptime');
const modNet = $('modNet');
const modDisk = $('modDisk');
const modPing = $('modPing');
const modCrosshair = $('modCrosshair');

const pingHost = $('pingHost');
const pingPort = $('pingPort');
const fpsThreshold = $('fpsThreshold');
const btnCheckPing = $('btnCheckPing');
const pingResult = $('pingResult');

// Оптимизация
const btnGameBoost = $('btnGameBoost');
const btnHighPerf = $('btnHighPerf');
const btnCleanTemp = $('btnCleanTemp');
const btnFlushDns = $('btnFlushDns');
const btnResetWinsock = $('btnResetWinsock');
const btnResetTcpIp = $('btnResetTcpIp');
const btnPrefetch = $('btnPrefetch');
const btnWinTemp = $('btnWinTemp');
const btnWuCache = $('btnWuCache');
const btnIconCache = $('btnIconCache');
const btnGameMode = $('btnGameMode');
const btnNetOpt = $('btnNetOpt');
const btnSfc = $('btnSfc');
const btnDism = $('btnDism');
const killPid = $('killPid');
const procPriority = $('procPriority');
const btnSetPriority = $('btnSetPriority');
const btnKillProc = $('btnKillProc');

const logEl = $('log');

let recordingHotkey = false;
let cfg = {};

// ---------- лог ----------

function log(msg, type = 'info') {
  const entry = document.createElement('div');
  entry.className = 'entry ' + type;
  entry.textContent = new Date().toLocaleTimeString() + '  ' + msg;
  logEl.prepend(entry);
  logEl.scrollTop = 0;
}

// ---------- загрузка конфига ----------

async function loadConfig() {
  cfg = await electronAPI.invoke('config:get-all');
  hotkeyDisplay.textContent = cfg.hotkey || 'Ctrl+Alt+X';
  clickThrough.checked = cfg.clickThrough !== false;
  activePos = cfg.overlayPosition || 'top-right';
  posBtns.forEach((b) => b.classList.toggle('active', b.dataset.pos === activePos));
  opacity.value = cfg.opacity || 100;
  opacityVal.textContent = (cfg.opacity || 100) + '%';
  fontSize.value = cfg.fontSize || 13;
  fontSizeVal.textContent = (cfg.fontSize || 13) + 'px';

  const m = cfg.modules || {};
  modFps.checked = m.fps !== false;
  modCpu.checked = m.cpu !== false;
  modRam.checked = m.ram !== false;
  modGpu.checked = m.gpu !== false;
  modBattery.checked = m.battery !== false;
  modUptime.checked = m.uptime !== false;
  modNet.checked = m.net === true;
  modDisk.checked = m.disk === true;
  modPing.checked = m.ping === true;
  modCrosshair.checked = m.crosshair === true;

  pingHost.value = cfg.pingHost || '1.1.1.1';
  pingPort.value = cfg.pingPort || 443;
  fpsThreshold.value = cfg.fpsAlertThreshold || 30;
}

loadConfig();

// ---------- горячая клавиша ----------

btnRecordHotkey.addEventListener('click', () => {
  recordingHotkey = true;
  btnRecordHotkey.textContent = 'НАЖМИТЕ КЛАВИШУ...';
  btnRecordHotkey.classList.add('primary');
  log('Запись горячей клавиши…');
});

window.addEventListener('keydown', async (e) => {
  if (!recordingHotkey) return;
  e.preventDefault();
  const parts = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  if (e.metaKey) parts.push('Meta');
  const key = e.key.replace(/^(Arrow|Control|Alt|Shift|Meta)$/, '') || e.code;
  if (!key || parts.includes(key)) return;
  const hk = [...parts, key].join('+');
  hotkeyDisplay.textContent = hk;
  recordingHotkey = false;
  btnRecordHotkey.textContent = 'ЗАПИСАТЬ КЛАВИШУ';
  btnRecordHotkey.classList.remove('primary');
  log('Записано: ' + hk);
});

btnApplyHotkey.addEventListener('click', async () => {
  const hk = hotkeyDisplay.textContent.trim();
  await electronAPI.invoke('config:set', 'hotkey', hk);
  await electronAPI.invoke('hotkey:register');
  log('Горячая клавиша: ' + hk);
});

// ---------- позиция ----------

posBtns.forEach((b) => {
  b.addEventListener('click', async () => {
    posBtns.forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    activePos = b.dataset.pos;
    await electronAPI.invoke('config:set', 'overlayPosition', activePos);
    await electronAPI.invoke('overlay:reconfigure');
    log('Позиция оверлея: ' + activePos);
  });
});

// ---------- вид ----------

opacity.addEventListener('input', () => { opacityVal.textContent = opacity.value + '%'; });
opacity.addEventListener('change', async () => {
  await electronAPI.invoke('config:set', 'opacity', Number(opacity.value));
  await electronAPI.invoke('overlay:reconfigure');
});

fontSize.addEventListener('input', () => { fontSizeVal.textContent = fontSize.value + ' px'; });
fontSize.addEventListener('change', async () => {
  await electronAPI.invoke('config:set', 'fontSize', Number(fontSize.value));
  await electronAPI.invoke('overlay:reconfigure');
});

// ---------- модули ----------

const moduleEls = [modFps, modCpu, modRam, modGpu, modBattery, modUptime, modNet, modDisk, modPing, modCrosshair];
const moduleKeys = ['fps', 'cpu', 'ram', 'gpu', 'battery', 'uptime', 'net', 'disk', 'ping', 'crosshair'];

function bindModule(el, key) {
  el.addEventListener('change', async () => {
    const mods = {};
    mods[key] = el.checked === true;
    await electronAPI.invoke('config:set', 'modules', mods);
    await electronAPI.invoke('overlay:reconfigure');
  });
}
moduleEls.forEach((el, i) => bindModule(el, moduleKeys[i]));

clickThrough.addEventListener('change', async () => {
  await electronAPI.invoke('config:set', 'clickThrough', clickThrough.checked === true);
  await electronAPI.invoke('overlay:reconfigure');
  log('Клик сквозь оверлей: ' + (clickThrough.checked ? 'ВКЛ' : 'ВЫКЛ'));
});

btnToggleMenu.addEventListener('click', async () => {
  await electronAPI.invoke('menu:toggle');
});

btnUnlock.addEventListener('click', async () => {
  await electronAPI.invoke('config:set', 'unlocked', true);
  await electronAPI.invoke('overlay:reconfigure');
  log('Оверлей разблокирован — потяните за заголовок.');
});

pingHost.addEventListener('change', async () => {
  await electronAPI.invoke('config:set', 'pingHost', pingHost.value.trim());
});
pingPort.addEventListener('change', async () => {
  await electronAPI.invoke('config:set', 'pingPort', Number(pingPort.value) || 443);
});
fpsThreshold.addEventListener('change', async () => {
  await electronAPI.invoke('config:set', 'fpsAlertThreshold', Number(fpsThreshold.value) || 30);
});

// ---------- пинг ----------

btnCheckPing.addEventListener('click', async () => {
  pingResult.textContent = 'ПРОВЕРКА…';
  try {
    const res = await electronAPI.invoke('ping:check', {
      host: pingHost.value.trim() || '1.1.1.1',
      port: Number(pingPort.value) || 443,
    });
    pingResult.textContent = res.ok ? res.ms + ' МС' : 'НЕДОСТУПЕН';
    pingResult.style.color = res.ok ? 'var(--green)' : 'var(--red)';
    log('Пинг ' + res.host + ':' + res.port + ' = ' + (res.ok ? res.ms + ' мс' : 'таймаут'));
  } catch (e) {
    pingResult.textContent = 'ОШИБКА';
    log('Ошибка пинга: ' + e.message, 'err');
  }
});

// ---------- оптимизация ----------

async function runOpt(label, fn) {
  [btnGameBoost, btnHighPerf, btnCleanTemp, btnFlushDns, btnResetWinsock, btnResetTcpIp,
   btnPrefetch, btnWinTemp, btnWuCache, btnIconCache, btnGameMode, btnNetOpt, btnSfc, btnDism,
   btnSetPriority, btnKillProc].forEach((b) => { b.disabled = true; });
  log(label + '…');
  try {
    const res = await fn();
    if (Array.isArray(res.results)) {
      res.results.forEach((r) => log((r.ok ? '✔' : '✘') + ' ' + r.step + ': ' + r.message, r.ok ? 'ok' : 'err'));
    } else {
      log((res.ok ? '✔' : '✘') + ' ' + res.message, res.ok ? 'ok' : 'err');
    }
  } catch (e) {
    log('Ошибка: ' + e.message, 'err');
  } finally {
    [btnGameBoost, btnHighPerf, btnCleanTemp, btnFlushDns, btnResetWinsock, btnResetTcpIp,
     btnPrefetch, btnWinTemp, btnWuCache, btnIconCache, btnGameMode, btnNetOpt, btnSfc, btnDism,
     btnSetPriority, btnKillProc].forEach((b) => { b.disabled = false; });
  }
}

btnGameBoost.addEventListener('click', () => runOpt('GAME BOOST', electronAPI.invoke.bind(electronAPI, 'optimizer:game-boost')));
btnHighPerf.addEventListener('click', () => runOpt('ПИТАНИЕ', electronAPI.invoke.bind(electronAPI, 'optimizer:high-perf')));
btnCleanTemp.addEventListener('click', () => runOpt('TEMP', electronAPI.invoke.bind(electronAPI, 'optimizer:clean-temp')));
btnFlushDns.addEventListener('click', () => runOpt('DNS', electronAPI.invoke.bind(electronAPI, 'optimizer:flush-dns')));
btnResetWinsock.addEventListener('click', () => runOpt('WINSOCK', electronAPI.invoke.bind(electronAPI, 'optimizer:reset-winsock')));
btnResetTcpIp.addEventListener('click', () => runOpt('TCP/IP', electronAPI.invoke.bind(electronAPI, 'optimizer:reset-tcpip')));
btnPrefetch.addEventListener('click', () => runOpt('PREFETCH', electronAPI.invoke.bind(electronAPI, 'optimizer:clean-prefetch')));
btnWinTemp.addEventListener('click', () => runOpt('WINDOWS TEMP', electronAPI.invoke.bind(electronAPI, 'optimizer:clean-windows-temp')));
btnWuCache.addEventListener('click', () => runOpt('КЭШ ОБНОВЛЕНИЙ', electronAPI.invoke.bind(electronAPI, 'optimizer:clean-wu-cache')));
btnIconCache.addEventListener('click', () => runOpt('КЭШ ИКОНОК', electronAPI.invoke.bind(electronAPI, 'optimizer:clear-icon-cache')));
btnGameMode.addEventListener('click', () => runOpt('ИГРОВОЙ РЕЖИМ', electronAPI.invoke.bind(electronAPI, 'optimizer:game-mode')));
btnNetOpt.addEventListener('click', () => runOpt('СЕТЬ', electronAPI.invoke.bind(electronAPI, 'optimizer:optimize-network')));
btnSfc.addEventListener('click', () => runOpt('SFC /SCANNOW', electronAPI.invoke.bind(electronAPI, 'optimizer:run-sfc')));
btnDism.addEventListener('click', () => runOpt('DISM', electronAPI.invoke.bind(electronAPI, 'optimizer:run-dism')));

btnSetPriority.addEventListener('click', async () => {
  const pid = killPid.value.trim();
  if (!pid) { log('Укажите PID', 'err'); return; }
  const res = await electronAPI.invoke('optimizer:set-process-priority', { pid, priority: procPriority.value });
  log((res.ok ? '✔' : '✘') + ' ' + res.message, res.ok ? 'ok' : 'err');
});

btnKillProc.addEventListener('click', async () => {
  const pid = killPid.value.trim();
  if (!pid) { log('Укажите PID', 'err'); return; }
  const res = await electronAPI.invoke('optimizer:kill-process', pid);
  log((res.ok ? '✔' : '✘') + ' ' + res.message, res.ok ? 'ok' : 'err');
});

// ---------- состояние ----------

electronAPI.on('stats-update', () => {
  $('statusDot').style.opacity = '1';
});
