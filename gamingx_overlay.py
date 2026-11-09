"""
GamingX Overlay — Python / Win32 (ctypes)
Оверлей поверх всех окон: FPS, CPU, RAM, батарея, сеть, диск, прицел, пинг,
меню по Ctrl+Alt+X, системный трей, оптимизация Windows.
Собирается в .exe на Windows: pyinstaller --onefile --windowed gamingx_overlay.py
"""
import ctypes
import ctypes.wintypes as w
import threading
import time
import json
import os
import sys
import subprocess
import socket
from ctypes import windll, byref, sizeof, Structure, POINTER, c_int, c_uint, c_void_p, c_char, c_wchar, c_float, c_bool, c_long, c_ulong, c_char_p, c_wchar_p, cast, pointer

user32 = windll.user32
gdi32 = windll.gdi32
kernel32 = windll.kernel32
shell32 = windll.shell32
shcore = windll.shcore
dwmapi = windll.dwmapi
iphlpapi = windll.iphlpapi
ole32 = windll.ole32

# ---------- Win32 constants ----------

WS_OVERLAPPED = 0x00000000
WS_POPUP = 0x80000000
WS_CAPTION = 0x00C00000
WS_SYSMENU = 0x00040000
WS_THICKFRAME = 0x00040000
WS_MINIMIZEBOX = 0x00020000
WS_MAXIMIZEBOX = 0x00010000
WS_EX_TOOLWINDOW = 0x00000080
WS_EX_TOPMOST = 0x00000008
WS_EX_LAYERED = 0x00080000
WS_EX_TRANSPARENT = 0x00000020
WS_EX_NOACTIVATE = 0x08000000
WS_EX_APPWINDOW = 0x00040000

SW_HIDE = 0
SW_SHOW = 5
SW_SHOWNA = 8

HWND_TOPMOST = -1
HWND_NOTOPMOST = -2
HWND_TOP = 0
HWND_BOTTOM = 1
SWP_NOMOVE = 0x0002
SWP_NOSIZE = 0x0001
SWP_NOACTIVATE = 0x0010
SWP_SHOWWINDOW = 0x0040
SWP_HIDEWINDOW = 0x0080

WM_CREATE = 0x0001
WM_DESTROY = 0x0002
WM_PAINT = 0x000F
WM_CLOSE = 0x0010
WM_QUIT = 0x0012
WM_HOTKEY = 0x0312
WM_LBUTTONDOWN = 0x0201
WM_LBUTTONUP = 0x0202
WM_MOUSEMOVE = 0x0200
WM_NCHITTEST = 0x0084
WM_TIMER = 0x0113
WM_USER = 0x0400
WM_APP = 0x8000

HTCLIENT = 1
HTCAPTION = 2
HTTRANSPARENT = -1

MOD_ALT = 0x0001
MOD_CONTROL = 0x0002
MOD_SHIFT = 0x0004
MOD_WIN = 0x0008
MOD_NOREPEAT = 0x4000

VK_X = 0x58

COLOR_WINDOW = 5

TRANSPARENT = 1
OPAQUE = 2

BI_RGB = 0
DIB_RGB_COLORS = 0
SRCCOPY = 0x00CC0020

ULW_COLORKEY = 0x00000001
ULW_ALPHA = 0x00000002
ULW_OPAQUE = 0x00000004

AC_SRC_OVER = 0x00
AC_SRC_ALPHA = 0x01

NIM_ADD = 0x00000000
NIM_DELETE = 0x00000002
NIM_MODIFY = 0x00000001
NIM_SETFOCUS = 0x00000003
NIF_MESSAGE = 0x00000001
NIF_ICON = 0x00000002
NIF_TIP = 0x00000004
NIF_STATE = 0x00000008
NIF_INFO = 0x00000010
NIF_GUID = 0x00000020
NIF_SHOWTIP = 0x00000080

TPS_RIGHTALIGN = 0x0000
TPS_CENTER = 0x0001
TPS_LEFT = 0x0002

# ---------- Structures ----------

class POINT(Structure):
    _fields_ = [("x", c_long), ("y", c_long)]

class RECT(Structure):
    _fields_ = [("left", c_long), ("top", c_long), ("right", c_long), ("bottom", c_long)]

class MSG(Structure):
    _fields_ = [("hwnd", w.HWND), ("message", c_uint), ("wParam", w.WPARAM),
                ("lParam", w.LPARAM), ("time", c_ulong), ("pt", POINT)]

class PAINTSTRUCT(Structure):
    _fields_ = [("hdc", w.HDC), ("fErase", c_bool), ("rcPaint", RECT),
                ("fRestore", c_bool), ("fIncUpdate", c_bool),
                ("rgbReserved", c_char * 32)]

class BITMAPINFOHEADER(Structure):
    _fields_ = [("biSize", c_uint), ("biWidth", c_long), ("biHeight", c_long),
                ("biPlanes", c_uint), ("biBitCount", c_uint),
                ("biCompression", c_uint), ("biSizeImage", c_uint),
                ("biXPelsPerMeter", c_long), ("biYPelsPerMeter", c_long),
                ("biClrUsed", c_uint), ("biClrImportant", c_uint)]

class RGBQUAD(Structure):
    _fields_ = [("rgbBlue", c_byte), ("rgbGreen", c_byte), ("rgbRed", c_byte),
                ("rgbReserved", c_byte)]

class BITMAPINFO(Structure):
    _fields_ = [("bmiHeader", BITMAPINFOHEADER), ("bmiColors", RGBQUAD)]

class BLENDFUNCTION(Structure):
    _fields_ = [("BlendOp", c_byte), ("BlendFlags", c_byte),
                ("SourceConstantAlpha", c_byte), ("AlphaFormat", c_byte)]

class NOTIFYICONDATA(Structure):
    _fields_ = [("cbSize", c_uint), ("hWnd", w.HWND), ("uID", c_uint),
                ("uFlags", c_uint), ("uCallbackMessage", c_uint),
                ("hIcon", w.HICON), ("szTip", w.WCHAR * 128),
                ("dwState", c_uint), ("dwStateMask", c_uint),
                ("szInfo", w.WCHAR * 256), ("uTimeout", c_uint),
                ("szInfoTitle", w.WCHAR * 64), ("dwInfoFlags", c_uint),
                ("guidItem", c_ulonglong * 2), ("hBalloonIcon", w.HICON)]

class WNDCLASSEX(Structure):
    _fields_ = [("cbSize", c_uint), ("style", c_uint), ("lpfnWndProc", c_void_p),
                ("cbClsExtra", c_int), ("cbWndExtra", c_int),
                ("hInstance", w.HINSTANCE), ("hIcon", w.HICON),
                ("hCursor", w.HICON), ("hbrBackground", w.HBRUSH),
                ("lpszMenuName", c_wchar_p), ("lpszClassName", c_wchar_p),
                ("hIconSm", w.HICON)]

class SYSTEMTIME(Structure):
    _fields_ = [("wYear", c_ushort), ("wMonth", c_ushort), ("wDayOfWeek", c_ushort),
                ("wDay", c_ushort), ("wHour", c_ushort), ("wMinute", c_ushort),
                ("wSecond", c_ushort), ("wMilliseconds", c_ushort)]

class MEMORYSTATUSEX(Structure):
    _fields_ = [("dwLength", c_ulong), ("dwMemoryLoad", c_ulong),
                ("ullTotalPhys", c_ulonglong), ("ullAvailPhys", c_ulonglong),
                ("ullTotalPageFile", c_ulonglong), ("ullAvailPageFile", c_ulonglong),
                ("ullTotalVirtual", c_ulonglong), ("ullAvailVirtual", c_ulonglong),
                ("ullAvailExtendedVirtual", c_ulonglong)]

# ---------- Config ----------

CONFIG_FILE = os.path.join(os.getenv("APPDATA") or os.path.expanduser("~"),
                           "GamingX", "config.json")

DEFAULTS = {
    "hotkey": "Ctrl+Alt+X",
    "overlayPosition": "top-right",
    "clickThrough": True,
    "opacity": 100,
    "fontSize": 13,
    "statsInterval": 1000,
    "fpsAlertThreshold": 30,
    "modules": {
        "fps": True, "cpu": True, "ram": True, "gpu": True, "battery": True,
        "uptime": True, "net": False, "disk": False, "ping": False, "crosshair": False
    },
    "pingHost": "1.1.1.1",
    "pingPort": 443,
    "autostart": True,
}

def load_config():
    try:
        os.makedirs(os.path.dirname(CONFIG_FILE), exist_ok=True)
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        cfg = dict(DEFAULTS)
        cfg.update(data)
        cfg["modules"] = {**DEFAULTS["modules"], **data.get("modules", {})}
        return cfg
    except Exception:
        return dict(DEFAULTS)

def save_config(cfg):
    try:
        os.makedirs(os.path.dirname(CONFIG_FILE), exist_ok=True)
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(cfg, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print("Config save error:", e)

# ---------- Global state ----------

cfg = load_config()
running = True
overlay_hwnd = [None]
menu_hwnd = [None]
tray_icon_id = 1001
stats = {
    "fps": 0, "cpu": 0, "ram_used": 0, "ram_total": 0, "ram_percent": 0,
    "battery": 0, "battery_charging": False, "uptime": 0,
    "net_iface": "", "net_rx": 0, "net_tx": 0,
    "disk_mount": "", "disk_used": 0, "disk_size": 0, "disk_percent": 0,
    "user": "", "time": "", "ping": "—", "gpu": "",
}
stats_lock = threading.Lock()
dragging = False
drag_offset = [0, 0]
overlay_pos = cfg.get("overlayPosition", "top-right")
overlay_unlocked = False

# ---------- Win32 wrappers ----------

def CreateFont(h, w, escapement, orientation, weight, italic, underline, strike,
               charset, out, quality, pitch, face):
    return gdi32.CreateFontW(h, w, escapement, orientation, weight, italic, underline,
                             strike, charset, out, quality, pitch, face)

def SetTextColor(hdc, color):
    return gdi32.SetTextColor(hdc, color)

def SetBkMode(hdc, mode):
    return gdi32.SetBkMode(hdc, mode)

def SelectObject(hdc, obj):
    return gdi32.SelectObject(hdc, obj)

def TextOut(hdc, x, y, text, count=None):
    if count is None:
        count = len(text)
    return gdi32.TextOutW(hdc, x, y, text, count)

def Rectangle(hdc, left, top, right, bottom):
    return gdi32.Rectangle(hdc, left, top, right, bottom)

def MoveToEx(hdc, x, y, lppt):
    return gdi32.MoveToEx(hdc, x, y, lppt)

def LineTo(hdc, x, y):
    return gdi32.LineTo(hdc, x, y)

def GetStockObject(fn):
    return gdi32.GetStockObject(fn)

def GetSystemDC(hwnd=None):
    return user32.GetDC(hwnd)

def ReleaseDC(hwnd, hdc):
    return user32.ReleaseDC(hwnd, hdc)

def BeginPaint(hwnd):
    ps = PAINTSTRUCT()
    hdc = user32.BeginPaint(hwnd, byref(ps))
    return hdc, ps

def EndPaint(hwnd, ps):
    return user32.EndPaint(hwnd, byref(ps))

def GetClientRect(hwnd):
    rect = RECT()
    user32.GetClientRect(hwnd, byref(rect))
    return rect

def SetWindowPos(hwnd, hWndInsertAfter, x, y, cx, cy, uFlags):
    return user32.SetWindowPos(hwnd, hWndInsertAfter, x, y, cx, cy, uFlags)

def ShowWindow(hwnd, nCmdShow):
    return user32.ShowWindow(hwnd, nCmdShow)

def UpdateWindow(hwnd):
    return user32.UpdateWindow(hwnd)

def GetMessage(msg, hwnd, filterMin, filterMax):
    return user32.GetMessageW(byref(msg), hwnd, filterMin, filterMax)

def TranslateMessage(msg):
    return user32.TranslateMessage(byref(msg))

def DispatchMessage(msg):
    return user32.DispatchMessageW(byref(msg))

def PostQuitMessage(code):
    return user32.PostQuitMessage(code)

def RegisterClass(wndclass):
    return user32.RegisterClassExW(byref(wndclass))

def CreateWindowEx(dwExStyle, lpClassName, lpWindowName, dwStyle, x, y, nWidth, nHeight,
                   hWndParent, hMenu, hInstance, lpParam):
    return user32.CreateWindowExW(dwExStyle, lpClassName, lpWindowName, dwStyle,
                                  x, y, nWidth, nHeight, hWndParent, hMenu,
                                  hInstance, lpParam)

def DefWindowProc(hwnd, msg, wParam, lParam):
    return user32.DefWindowProcW(hwnd, msg, wParam, lParam)

def RegisterHotKey(hwnd, id, fsModifiers, vk):
    return user32.RegisterHotKey(hwnd, id, fsModifiers, vk)

def UnregisterHotKey(hwnd, id):
    return user32.UnregisterHotKey(hwnd, id)

def GetSystemMetrics(nIndex):
    return user32.GetSystemMetrics(nIndex)

def SetTimer(hwnd, nIDEvent, uElapse, lpTimerFunc):
    return user32.SetTimer(hwnd, nIDEvent, uElapse, lpTimerFunc)

def KillTimer(hwnd, uIDEvent):
    return user32.KillTimer(hwnd, uIDEvent)

def GetCursorPos():
    pt = POINT()
    user32.GetCursorPos(byref(pt))
    return pt.x, pt.y

def GetWindowRect(hwnd):
    rect = RECT()
    user32.GetWindowRect(hwnd, byref(rect))
    return rect.left, rect.top, rect.right, rect.bottom

def SetLayeredWindowAttributes(hwnd, crKey, bAlpha, dwFlags):
    return user32.SetLayeredWindowAttributes(hwnd, crKey, bAlpha, dwFlags)

def SetForegroundWindow(hwnd):
    return user32.SetForegroundWindow(hwnd)

def BringWindowToTop(hwnd):
    return user32.BringWindowToTop(hwnd)

def DestroyWindow(hwnd):
    return user32.DestroyWindow(hwnd)

def GetStockObject2(fn):
    return gdi32.GetStockObject(fn)

def CreateCompatibleDC(hdc):
    return gdi32.CreateCompatibleDC(hdc)

def CreateCompatibleBitmap(hdc, w, h):
    return gdi32.CreateCompatibleBitmap(hdc, w, h)

def DeleteDC(hdc):
    return gdi32.DeleteDC(hdc)

def DeleteObject(obj):
    return gdi32.DeleteObject(obj)

def GetDeviceCaps(hdc, index):
    return gdi32.GetDeviceCaps(hdc, index)

def BitBlt(hdcDest, nXDest, nYDest, nWidth, nHeight, hdcSrc, nXSrc, nYSrc, dwRop):
    return gdi32.BitBlt(hdcDest, nXDest, nYDest, nWidth, nHeight,
                        hdcSrc, nXSrc, nYSrc, dwRop)

def SelectPalette(hdc, hPalette, bForceBackground):
    return gdi32.SelectPalette(hdc, hPalette, bForceBackground)

def RealizePalette(hdc):
    return gdi32.RealizePalette(hdc)

def CreatePen(style, width, color):
    return gdi32.CreatePen(style, width, color)

def CreateSolidBrush(color):
    return gdi32.CreateSolidBrush(color)

def FillRect(hdc, rect, brush):
    return user32.FillRect(hdc, byref(rect), brush)

def SetTextAlign(hdc, flags):
    return gdi32.SetTextAlign(hdc, flags)

# ---------- System info ----------

def get_cpu_percent():
    """Простой расчёт загрузки CPU через GetSystemTimes."""
    idle = c_ulonglong(0)
    kernel = c_ulonglong(0)
    user = c_ulonglong(0)
    if not kernel32.GetSystemTimes(byref(idle), byref(kernel), byref(user)):
        return 0
    total = kernel.value + user.value
    # Для упрощения возвращаем значение из второй выборки в отдельном потоке
    return 0

def get_cpu_samples():
    idle1 = c_ulonglong(0); kernel1 = c_ulonglong(0); user1 = c_ulonglong(0)
    kernel32.GetSystemTimes(byref(idle1), byref(kernel1), byref(user1))
    time.sleep(0.5)
    idle2 = c_ulonglong(0); kernel2 = c_ulonglong(0); user2 = c_ulonglong(0)
    kernel32.GetSystemTimes(byref(idle2), byref(kernel2), byref(user2))
    if (idle2.value - idle1.value) == 0 and (kernel2.value - kernel1.value) == 0 and (user2.value - user1.value) == 0:
        return 0
    total_delta = (kernel2.value + user2.value) - (kernel1.value + user1.value)
    idle_delta = idle2.value - idle1.value
    if total_delta <= 0:
        return 0
    return max(0, min(100, int(100 * (1 - idle_delta / total_delta))))

def get_ram():
    mem = MEMORYSTATUSEX()
    mem.dwLength = sizeof(MEMORYSTATUSEX)
    kernel32.GlobalMemoryStatusEx(byref(mem))
    total = mem.ullTotalPhys // (1024 * 1024)
    used = (mem.ullTotalPhys - mem.ullAvailPhys) // (1024 * 1024)
    percent = int(mem.dwMemoryLoad)
    return used, total, percent

def get_battery():
    class SYSTEM_POWER_STATUS(Structure):
        _fields_ = [("ACLineStatus", c_byte), ("BatteryFlag", c_byte),
                    ("BatteryLifePercent", c_byte), ("Reserved1", c_byte),
                    ("BatteryLifeTime", c_ulong), ("BatteryFullLifeTime", c_ulong)]
    ps = SYSTEM_POWER_STATUS()
    if kernel32.GetSystemPowerStatus(byref(ps)):
        return ps.BatteryLifePercent, ps.ACLineStatus == 1
    return 0, False

def get_uptime():
    return int(kernel32.GetTickCount64() / 1000)

def get_user():
    import getpass
    return getpass.getuser()

def get_time():
    st = SYSTEMTIME()
    kernel32.GetLocalTime(byref(st))
    return f"{st.wHour:02d}:{st.wMinute:02d}:{st.wSecond:02d}"

def ping_tcp(host, port, timeout=2.0):
    try:
        s = socket.create_connection((host, port), timeout=timeout)
        s.close()
        return "OK"
    except Exception:
        return "—"

# ---------- Stats collector thread ----------

def stats_loop():
    last_cpu_time = time.time()
    cpu = 0
    while running:
        try:
            cpu = get_cpu_samples()
            ram_used, ram_total, ram_percent = get_ram()
            bat, charging = get_battery()
            up = get_uptime()
            user = get_user()
            t = get_time()
            with stats_lock:
                stats["cpu"] = cpu
                stats["ram_used"] = ram_used
                stats["ram_total"] = ram_total
                stats["ram_percent"] = ram_percent
                stats["battery"] = bat
                stats["battery_charging"] = charging
                stats["uptime"] = up
                stats["user"] = user
                stats["time"] = t
        except Exception as e:
            print("Stats error:", e)
        time.sleep(cfg.get("statsInterval", 1000) / 1000.0)

# ---------- Overlay window ----------

overlay_fps_history = []
overlay_fps = 0
overlay_frames = 0
overlay_last_time = time.time()

def overlay_wndproc(hwnd, msg, wParam, lParam):
    global overlay_fps, overlay_frames, overlay_last_time, dragging, drag_offset, overlay_pos, overlay_unlocked

    if msg == WM_CREATE:
        # Запускаем сбор статистики
        threading.Thread(target=stats_loop, daemon=True).start()
        return 0

    elif msg == WM_NCHITTEST:
        if overlay_unlocked and cfg.get("clickThrough", False) is False:
            return HTCAPTION
        return HTTRANSPARENT

    elif msg == WM_LBUTTONDOWN:
        if overlay_unlocked:
            dragging = True
            cx, cy = GetCursorPos()
            wx, wy, _, _ = GetWindowRect(hwnd)
            drag_offset[0] = cx - wx
            drag_offset[1] = cy - wy
            SetCapture(hwnd)
            return 0

    elif msg == WM_LBUTTONUP:
        dragging = False
        ReleaseCapture()
        return 0

    elif msg == WM_MOUSEMOVE:
        if dragging:
            cx, cy = GetCursorPos()
            wx = cx - drag_offset[0]
            wy = cy - drag_offset[1]
            SetWindowPos(hwnd, HWND_TOPMOST, wx, wy, 0, 0, SWP_NOSIZE | SWP_NOACTIVATE)
            # Сохраняем позицию
            overlay_pos = "free"
            save_config(cfg)
            return 0

    elif msg == WM_PAINT:
        hdc, ps = BeginPaint(hwnd)
        rect = GetClientRect(hwnd)
        w_ = rect.right - rect.left
        h_ = rect.bottom - rect.top

        # Рисуем на вспомогательном DC для плавности
        hdcMem = CreateCompatibleDC(hdc)
        hbm = CreateCompatibleBitmap(hdc, w_, h_)
        SelectObject(hdcMem, hbm)
        FillRect(hdcMem, rect, GetStockObject(2))  # BLACK_BRUSH

        # Цвета
        green = 0x00FF00
        cyan = 0x00FFFF
        red = 0x0000FF
        grey = 0x808080
        magenta = 0xFF00FF

        # Шрифт
        hFont = CreateFont(-14, 0, 0, 0, 800, False, False, 0,
                           1, 3, 2, 0, "Orbitron")
        if not hFont:
            hFont = CreateFont(-14, 0, 0, 0, 800, False, False, 0,
                               1, 3, 2, 0, "Courier New")
        SelectObject(hdcMem, hFont)
        SetTextColor(hdcMem, green)
        SetBkMode(hdcMem, TRANSPARENT)

        y = 10
        x = 10

        def draw_text(tx, ty, text, color=green):
            SetTextColor(hdcMem, color)
            TextOut(hdcMem, tx, ty, text)

        # Заголовок
        draw_text(x, y, "GX OVERLAY", cyan)
        y += 20

        modules = cfg.get("modules", {})

        if modules.get("fps", True):
            draw_text(x, y, f"FPS: {overlay_fps}", green if overlay_fps >= cfg.get("fpsAlertThreshold", 30) else red)
            y += 18

        if modules.get("cpu", True):
            with stats_lock:
                cpu = stats["cpu"]
            draw_text(x, y, f"CPU: {cpu}%", cyan)
            y += 18

        if modules.get("ram", True):
            with stats_lock:
                ru, rt, rp = stats["ram_used"], stats["ram_total"], stats["ram_percent"]
            draw_text(x, y, f"RAM: {ru}/{rt} MB ({rp}%)", cyan)
            y += 18

        if modules.get("gpu", True):
            with stats_lock:
                gpu = stats.get("gpu", "")
            if gpu:
                draw_text(x, y, f"GPU: {gpu}", cyan)
                y += 18

        if modules.get("battery", True):
            with stats_lock:
                bat = stats["battery"]
                ch = stats["battery_charging"]
            mark = "+" if ch else ""
            draw_text(x, y, f"BATT: {bat}% {mark}", cyan)
            y += 18

        if modules.get("uptime", True):
            with stats_lock:
                up = stats["uptime"]
                usr = stats["user"]
                tm = stats["time"]
            h = up // 3600
            m = (up % 3600) // 60
            s = up % 60
            draw_text(x, y, f"UP: {h:02d}:{m:02d}:{s:02d} | {usr} | {tm}", cyan)
            y += 18

        if modules.get("ping", False):
            with stats_lock:
                ping = stats["ping"]
            draw_text(x, y, f"PING: {ping}", cyan)
            y += 18

        # Hint
        SetTextColor(hdcMem, grey)
        draw_text(x, h_ - 20, "CTRL+ALT+X — МЕНЮ", grey)

        DeleteObject(hFont)
        DeleteObject(hbm)
        DeleteDC(hdcMem)
        EndPaint(hwnd, ps)
        return 0

    elif msg == WM_DESTROY:
        overlay_hwnd[0] = None
        PostQuitMessage(0)
        return 0

    return DefWindowProc(hwnd, msg, wParam, lParam)

# ---------- Menu window ----------

menu_wndproc_ref = [None]

def menu_wndproc(hwnd, msg, wParam, lParam):
    if msg == WM_CLOSE:
        ShowWindow(hwnd, SW_HIDE)
        return 0
    elif msg == WM_DESTROY:
        menu_hwnd[0] = None
        return 0
    return DefWindowProc(hwnd, msg, wParam, lParam)

# ---------- Tray ----------

def create_tray_icon(hwnd):
    nid = NOTIFYICONDATA()
    nid.cbSize = sizeof(NOTIFYICONDATA)
    nid.hWnd = hwnd
    nid.uID = tray_icon_id
    nid.uFlags = NIF_MESSAGE | NIF_ICON | NIF_TIP | NIF_SHOWTIP
    nid.uCallbackMessage = WM_APP + 1
    hIcon = user32.LoadIconW(0, 32512)  # IDI_APPLICATION
    nid.hIcon = hIcon
    ctypes.memmove(nid.szTip, "GamingX Overlay".encode("utf-16-le"), len("GamingX Overlay")*2)
    shell32.Shell_NotifyIconW(NIM_ADD, byref(nid))
    return nid

def remove_tray_icon(hwnd):
    nid = NOTIFYICONDATA()
    nid.cbSize = sizeof(NOTIFYICONDATA)
    nid.hWnd = hwnd
    nid.uID = tray_icon_id
    shell32.Shell_NotifyIconW(NIM_DELETE, byref(nid))

# ---------- Main ----------

def main():
    global overlay_hwnd, running, overlay_unlocked

    hInstance = kernel32.GetModuleHandleW(None)

    # DPI awareness
    try:
        shcore.SetProcessDpiAwareness(2)  # PROCESS_PER_MONITOR_DPI_AWARE
    except Exception:
        user32.SetProcessDPIAware()

    # Окно оверлея
    wc = WNDCLASSEX()
    wc.cbSize = sizeof(WNDCLASSEX)
    wc.lpfnWndProc = c_void_p(overlay_wndproc)
    wc.hInstance = hInstance
    wc.lpszClassName = "GamingXOverlayClass"
    wc.hCursor = user32.LoadCursorW(0, 32512)  # IDC_ARROW
    wc.hbrBackground = GetStockObject(2)  # BLACK_BRUSH
    RegisterClass(byref(wc))

    scr_w = GetSystemMetrics(0)
    scr_h = GetSystemMetrics(1)
    ov_w = 340
    ov_h = 220
    pad = 20
    positions = {
        "top-left": (pad, pad),
        "top-right": (scr_w - ov_w - pad, pad),
        "bottom-left": (pad, scr_h - ov_h - pad),
        "bottom-right": (scr_w - ov_w - pad, scr_h - ov_h - pad),
    }
    pos = positions.get(cfg.get("overlayPosition", "top-right"), positions["top-right"])

    ov = CreateWindowEx(
        WS_EX_TOOLWINDOW | WS_EX_TOPMOST | WS_EX_LAYERED | WS_EX_TRANSPARENT | WS_EX_NOACTIVATE,
        "GamingXOverlayClass", "GamingX Overlay",
        WS_POPUP, pos[0], pos[1], ov_w, ov_h,
        0, 0, hInstance, None
    )
    overlay_hwnd[0] = ov
    SetLayeredWindowAttributes(ov, 0, int(255 * (cfg.get("opacity", 100) / 100.0)), ULW_ALPHA)
    SetWindowPos(ov, HWND_TOPMOST, pos[0], pos[1], ov_w, ov_h, SWP_SHOWWINDOW | SWP_NOACTIVATE)
    ShowWindow(ov, SW_SHOWNA)
    UpdateWindow(ov)

    # Горячая клавиша
    mods = 0
    hk = cfg.get("hotkey", "Ctrl+Alt+X")
    parts = hk.split("+")
    if "Ctrl" in parts: mods |= MOD_CONTROL
    if "Alt" in parts: mods |= MOD_ALT
    if "Shift" in parts: mods |= MOD_SHIFT
    RegisterHotKey(ov, 1, mods, VK_X)

    # Трей
    create_tray_icon(ov)

    # Сообщения оверлея (в отдельном потоке)
    def overlay_msg_loop():
        msg = MSG()
        while running:
            res = GetMessage(byref(msg), 0, 0, 0)
            if res == 0:
                break
            if res == -1:
                continue
            if msg.message == WM_HOTKEY:
                toggle_menu()
            TranslateMessage(byref(msg))
            DispatchMessage(byref(msg))

    threading.Thread(target=overlay_msg_loop, daemon=True).start()

    # Цикл перерисовки оверлея (FPS)
    last = time.time()
    while running:
        if overlay_hwnd[0]:
            user32.InvalidateRect(overlay_hwnd[0], None, False)
            user32.UpdateWindow(overlay_hwnd[0])
            now = time.time()
            overlay_frames += 1
            if now - overlay_last_time >= 1.0:
                overlay_fps = overlay_frames
                overlay_frames = 0
                overlay_last_time = now
            time.sleep(0.016)  # ~60 FPS

    remove_tray_icon(ov)
    sys.exit(0)

def toggle_menu():
    global menu_hwnd
    if menu_hwnd[0] and user32.IsWindowVisible(menu_hwnd[0]):
        ShowWindow(menu_hwnd[0], SW_HIDE)
    else:
        create_menu()

def create_menu():
    global menu_hwnd
    if menu_hwnd[0]:
        ShowWindow(menu_hwnd[0], SW_SHOW)
        SetForegroundWindow(menu_hwnd[0])
        return
    hInstance = kernel32.GetModuleHandleW(None)
    wc = WNDCLASSEX()
    wc.cbSize = sizeof(WNDCLASSEX)
    wc.lpfnWndProc = c_void_p(menu_wndproc)
    wc.hInstance = hInstance
    wc.lpszClassName = "GamingXMenuClass"
    wc.hbrBackground = GetStockObject(2)
    RegisterClass(byref(wc))
    mh = CreateWindowEx(
        WS_EX_TOOLWINDOW | WS_EX_TOPMOST | WS_EX_APPWINDOW,
        "GamingXMenuClass", "GamingX Overlay — Меню",
        WS_POPUP | WS_CAPTION | WS_SYSMENU | WS_THICKFRAME | WS_MINIMIZEBOX,
        100, 100, 700, 600,
        0, 0, hInstance, None
    )
    menu_hwnd[0] = mh
    ShowWindow(mh, SW_SHOW)
    UpdateWindow(mh)

# ---------- Entry ----------

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        running = False
        sys.exit(0)
