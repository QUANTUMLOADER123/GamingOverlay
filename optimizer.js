const { exec } = require('node:child_process');
const os = require('node:os');
const net = require('node:net');

function run(cmd) {
  return new Promise((resolve) => {
    exec(cmd, { timeout: 20000, shell: true }, (err, stdout, stderr) => {
      resolve({
        ok: !err,
        stdout: (stdout || '').trim(),
        stderr: (stderr || '').trim(),
        err: err ? err.message : null,
      });
    });
  });
}

/** «Game boost»: схема питания на максимум + очистка временных файлов. */
async function gameBoost() {
  const results = [];
  results.push(await setHighPerformance());
  results.push(await cleanTemp());
  return { ok: true, results };
}

/** Высокая производительность питания (Windows powercfg / Linux cpupower hints). */
async function setHighPerformance() {
  const platform = os.platform();
  if (platform === 'win32') {
    const res = await run('powercfg /setactive SCHEME_MIN');
    return {
      step: 'power-plan',
      ok: res.ok,
      message: res.ok
        ? 'Схема питания переведена в «Высокая производительность»'
        : 'Не удалось применить схему питания: ' + (res.stderr || res.err),
    };
  }
  if (platform === 'linux') {
    return {
      step: 'cpu-governor',
      ok: true,
      message:
        'Linux: установите governor вручную, например sudo cpupower frequency-set -g performance',
    };
  }
  if (platform === 'darwin') {
    return { step: 'pmset', ok: true, message: 'macOS управляет производительностью автоматически' };
  }
  return { step: 'power-plan', ok: false, message: 'Платформа не поддерживается' };
}

/** Очистка временных файлов. */
async function cleanTemp() {
  const platform = os.platform();
  if (platform === 'win32') {
    const res = await run('del /q /s /f "%TEMP%\\*" 2>nul');
    return {
      step: 'temp-files',
      ok: res.ok,
      message: res.ok ? 'Временные файлы (%TEMP%) очищены' : 'Не удалось очистить временные файлы',
    };
  }
  if (platform === 'linux') {
    const res = await run('rm -rf /tmp/* 2>/dev/null; sync');
    return {
      step: 'temp-files',
      ok: res.ok,
      message: res.ok ? 'Директория /tmp очищена' : 'Не удалось очистить /tmp',
    };
  }
  return { step: 'temp-files', ok: false, message: 'Платформа не поддерживается' };
}

/** Принудительное завершение процесса по PID. */
async function killProcess(pid) {
  if (!pid) {
    return { ok: false, message: 'PID не указан' };
  }
  try {
    process.kill(Number(pid));
    return { ok: true, message: `Процесс ${pid} завершён` };
  } catch (e) {
    return { ok: false, message: `Не удалось завершить ${pid}: ${e.message}` };
  }
}

/** Псевдо-пинг: время TCP-соединения к хосту:ポート. */
function pingHost(host, port = 443) {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    socket.setTimeout(3000);
    const cleanup = () => {
      socket.destroy();
    };
    socket.on('connect', () => {
      cleanup();
      resolve({ ok: true, ms: Date.now() - start, host, port });
    });
    socket.on('error', () => {
      cleanup();
      resolve({ ok: false, ms: null, host, port });
    });
    socket.on('timeout', () => {
      cleanup();
      resolve({ ok: false, ms: null, host, port });
    });
    socket.connect(port, host);
  });
}

module.exports = { gameBoost, setHighPerformance, cleanTemp, killProcess, pingHost };
