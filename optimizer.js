const { exec } = require('node:child_process');
const os = require('node:os');
const net = require('node:net');

function run(cmd, timeout = 60000) {
  return new Promise((resolve) => {
    exec(cmd, { timeout, shell: true }, (err, stdout, stderr) => {
      resolve({
        ok: !err,
        stdout: (stdout || '').trim(),
        stderr: (stderr || '').trim(),
        err: err ? err.message : null,
      });
    });
  });
}

/** Помощник для Windows-команд. */
function isWin() { return os.platform() === 'win32'; }

/** «Game boost»: схема питания на максимум + очистка temp + игровой режим. */
async function gameBoost() {
  const results = [];
  results.push(await setHighPerformance());
  results.push(await cleanTemp());
  results.push(await setGameMode());
  return { ok: true, results };
}

/** Высокая производительность питания. */
async function setHighPerformance() {
  if (isWin()) {
    const res = await run('powercfg /setactive SCHEME_MIN');
    return {
      step: 'power-plan',
      ok: res.ok,
      message: res.ok
        ? 'Схема питания переведена в «Высокая производительность»'
        : 'Не удалось применить схему питания: ' + (res.stderr || res.err),
    };
  }
  return { step: 'power-plan', ok: false, message: 'Только Windows' };
}

/** Очистка временных файлов (%TEMP%). */
async function cleanTemp() {
  if (isWin()) {
    const res = await run('del /q /s /f "%TEMP%\\*" 2>nul');
    return {
      step: 'temp-files',
      ok: res.ok,
      message: res.ok ? 'Временные файлы (%TEMP%) очищены' : 'Не удалось очистить %TEMP%',
    };
  }
  if (os.platform() === 'linux') {
    const res = await run('rm -rf /tmp/* 2>/dev/null; sync');
    return { step: 'temp-files', ok: res.ok, message: res.ok ? 'Директория /tmp очищена' : 'Не удалось очистить /tmp' };
  }
  return { step: 'temp-files', ok: false, message: 'Платформа не поддерживается' };
}

/** Очистка Prefetch (Windows). */
async function cleanPrefetch() {
  if (!isWin()) return { step: 'prefetch', ok: false, message: 'Только Windows' };
  const res = await run('del /q /s /f "C:\\Windows\\Prefetch\\*" 2>nul');
  return {
    step: 'prefetch',
    ok: res.ok,
    message: res.ok ? 'Prefetch очищен' : 'Не удалось очистить Prefetch',
  };
}

/** Очистка C:\\Windows\\Temp. */
async function cleanWindowsTemp() {
  if (!isWin()) return { step: 'windows-temp', ok: false, message: 'Только Windows' };
  const res = await run('del /q /s /f "C:\\Windows\\Temp\\*" 2>nul');
  return {
    step: 'windows-temp',
    ok: res.ok,
    message: res.ok ? 'C:\\Windows\\Temp очищен' : 'Не удалось очистить C:\\Windows\\Temp',
  };
}

/** Сброс DNS-кеша. */
async function flushDns() {
  if (!isWin()) return { step: 'flushdns', ok: false, message: 'Только Windows' };
  const res = await run('ipconfig /flushdns');
  return {
    step: 'flush-dns',
    ok: res.ok,
    message: res.ok ? 'DNS-кеш сброшен (ipconfig /flushdns)' : 'Не удалось сбросить DNS',
  };
}

/** Сброс Winsock. */
async function resetWinsock() {
  if (!isWin()) return { step: 'winsock', ok: false, message: 'Только Windows' };
  const res = await run('netsh winsock reset');
  return {
    step: 'reset-winsock',
    ok: res.ok,
    message: res.ok ? 'Winsock сброшен. Требуется перезагрузка.' : 'Не удалось сбросить Winsock',
  };
}

/** Сброс TCP/IP стека. */
async function resetTcpIp() {
  if (!isWin()) return { step: 'tcpip', ok: false, message: 'Только Windows' };
  const res = await run('netsh int ip reset');
  return {
    step: 'reset-tcpip',
    ok: res.ok,
    message: res.ok ? 'TCP/IP сброшен. Требуется перезагрузка.' : 'Не удалось сбросить TCP/IP',
  };
}

/** Оптимизация сетевого стека для игр. */
async function optimizeNetwork() {
  if (!isWin()) return { step: 'network', ok: false, message: 'Только Windows' };
  const cmds = [
    'netsh int tcp set global autotuninglevel=disabled',
    'netsh int tcp set global ecncapability=disabled',
    'netsh int tcp set global timestamps=disabled',
    'netsh int tcp set global congestionprovider=ctcp',
  ];
  let ok = true;
  const msgs = [];
  for (const cmd of cmds) {
    const res = await run(cmd);
    if (!res.ok) ok = false;
    msgs.push(`${cmd} → ${res.ok ? 'OK' : 'ERR: ' + (res.stderr || res.err)}`);
  }
  return {
    step: 'optimize-network',
    ok,
    message: msgs.join(' | '),
  };
}

/** Очистка кэша обновлений Windows. */
async function cleanWindowsUpdateCache() {
  if (!isWin()) return { step: 'wu-cache', ok: false, message: 'Только Windows' };
  const res = await run(
    'net stop wuauserv >nul 2>&1 & net stop bits >nul 2>&1 & del /q /s /f "%WINDIR%\\SoftwareDistribution\\Download\\*" >nul 2>&1 & net start wuauserv >nul 2>&1 & net start bits >nul 2>&1',
    30000
  );
  return {
    step: 'windows-update-cache',
    ok: res.ok,
    message: res.ok ? 'Кэш обновлений Windows очищен' : 'Не удалось очистить кэш обновлений',
  };
}

/** Очистка кэша иконок. */
async function clearIconCache() {
  if (!isWin()) return { step: 'icon-cache', ok: false, message: 'Только Windows' };
  const res = await run(
    'taskkill /IM explorer.exe /F >nul 2>&1 & del /q /f "%userprofile%\\AppData\\Local\\IconCache.db" >nul 2>&1 & del /q /f /s "%userprofile%\\AppData\\Local\\Microsoft\\Windows\\Explorer\\iconcache_*.db" >nul 2>&1 & start explorer.exe >nul 2>&1',
    15000
  );
  return {
    step: 'icon-cache',
    ok: res.ok,
    message: res.ok ? 'Кэш иконок очищен (проводник перезапущен)' : 'Не удалось очистить кэш иконок',
  };
}

/** Игровой режим Windows (отключение Game DVR / Game Bar). */
async function setGameMode() {
  if (!isWin()) return { step: 'game-mode', ok: false, message: 'Только Windows' };
  const cmds = [
    'reg add "HKCU\\System\\GameConfigStore" /v "GameDVR_Enabled" /t REG_DWORD /d 0 /f >nul 2>&1',
    'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR" /v "AppCaptureEnabled" /t REG_DWORD /d 0 /f >nul 2>&1',
    'reg add "HKCU\\Software\\Microsoft\\GameBar" /v "AutoGameModeEnabled" /t REG_DWORD /d 0 /f >nul 2>&1',
  ];
  let ok = true;
  const msgs = [];
  for (const cmd of cmds) {
    const res = await run(cmd);
    if (!res.ok) ok = false;
    msgs.push(res.ok ? 'OK' : 'ERR');
  }
  return {
    step: 'game-mode',
    ok,
    message: ok ? 'Игровой режим оптимизирован (Game DVR/Game Bar отключены)' : 'Частично применено',
  };
}

/** Приоритет процесса. */
async function setProcessPriority(pid, priority = 'high') {
  if (!pid) return { ok: false, message: 'PID не указан' };
  const map = { idle: '256', below: '16384', normal: '32', above: '32768', high: '128', realtime: '256' };
  const val = map[priority] || '128';
  if (os.platform() === 'win32') {
    const res = await run(`wmic process where ProcessId=${Number(pid)} CALL SetPriority ${val}`);
    return {
      ok: res.ok,
      message: res.ok
        ? `Процессу ${pid} установлен приоритет ${priority}`
        : `Не удалось установить приоритет: ${res.stderr || res.err}`,
    };
  }
  try {
    const nice = { idle: 19, below: 10, normal: 0, above: -5, high: -10, realtime: -20 }[priority] || -10;
    process.kill(Number(pid), 0);
    // Linux nice через renice нужен root; просто проверим что процесс есть
    return { ok: true, message: `Процесс ${pid} найден (приоритет не изменён на этой ОС)` };
  } catch (e) {
    return { ok: false, message: `Процесс ${pid} не найден: ${e.message}` };
  }
}

/** Завершение процесса по PID. */
async function killProcess(pid) {
  if (!pid) return { ok: false, message: 'PID не указан' };
  try {
    process.kill(Number(pid));
    return { ok: true, message: `Процесс ${pid} завершён` };
  } catch (e) {
    return { ok: false, message: `Не удалось завершить ${pid}: ${e.message}` };
  }
}

/** Pсевдо-пинг через TCP-соединение. */
function pingHost(host, port = 443) {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    socket.setTimeout(3000);
    const cleanup = () => socket.destroy();
    socket.on('connect', () => { cleanup(); resolve({ ok: true, ms: Date.now() - start, host, port }); });
    socket.on('error', () => { cleanup(); resolve({ ok: false, ms: null, host, port }); });
    socket.on('timeout', () => { cleanup(); resolve({ ok: false, ms: null, host, port }); });
    socket.connect(port, host);
  });
}

/** SFC /SCANNOW (долго, до 2 мин). */
async function runSfc() {
  if (!isWin()) return { step: 'sfc', ok: false, message: 'Только Windows' };
  const res = await run('sfc /scannow', 180000);
  return {
    step: 'sfc-scannow',
    ok: res.ok,
    message: res.ok ? 'Проверка системных файлов запущена (sfc /scannow)' : 'Ошибка SFC: ' + (res.stderr || res.err),
  };
}

/** DISM restore health. */
async function runDism() {
  if (!isWin()) return { step: 'dism', ok: false, message: 'Только Windows' };
  const res = await run('DISM /Online /Cleanup-Image /RestoreHealth', 300000);
  return {
    step: 'dism-restore',
    ok: res.ok,
    message: res.ok ? 'DISM восстановление запущено' : 'Ошибка DISM: ' + (res.stderr || res.err),
  };
}

module.exports = {
  gameBoost,
  setHighPerformance,
  cleanTemp,
  cleanPrefetch,
  cleanWindowsTemp,
  flushDns,
  resetWinsock,
  resetTcpIp,
  optimizeNetwork,
  cleanWindowsUpdateCache,
  clearIconCache,
  setGameMode,
  setProcessPriority,
  killProcess,
  pingHost,
  runSfc,
  runDism,
};
