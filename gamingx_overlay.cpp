// GamingX Overlay — C++ / Win32 API
// Компиляция на Windows (MinGW):
//   g++ gamingx_overlay.cpp -o GamingX.exe -luser32 -lgdi32 -lkernel32 -lshell32 -ladvapi32 -lws2_32 -mwindows
//
// Стиль debug 2000-х: угловатый, без скруглений, неоново-зелёный на чёрном.

#include <windows.h>
#include <windowsx.h>
#include <winsock2.h>
#include <iphlpapi.h>
#include <stdio.h>
#include <string>
#include <vector>
#include <fstream>
#include <sstream>
#include <shlobj.h>
#include <time.h>

#pragma comment(lib, "user32.lib")
#pragma comment(lib, "gdi32.lib")
#pragma comment(lib, "kernel32.lib")
#pragma comment(lib, "shell32.lib")
#pragma comment(lib, "advapi32.lib")
#pragma comment(lib, "iphlpapi.lib")
#pragma comment(lib, "ws2_32.lib")

// ---------- Конфиг ----------

struct Config {
    std::string hotkey = "Ctrl+Alt+X";
    std::string overlayPosition = "top-right";
    bool clickThrough = true;
    int opacity = 100;
    int fontSize = 13;
    int statsInterval = 1000;
    int fpsAlertThreshold = 30;
    bool modulesFps = true;
    bool modulesCpu = true;
    bool modulesRam = true;
    bool modulesGpu = true;
    bool modulesBattery = true;
    bool modulesUptime = true;
    bool modulesNet = false;
    bool modulesDisk = false;
    bool modulesPing = false;
    bool modulesCrosshair = false;
    std::string pingHost = "1.1.1.1";
    int pingPort = 443;
    bool autostart = true;
    bool unlocked = false;
};

Config cfg;
std::string configPath;

// ---------- Состояние ----------

struct Stats {
    int fps = 0;
    int cpu = 0;
    int ramUsed = 0;
    int ramTotal = 0;
    int ramPercent = 0;
    int battery = 0;
    bool batteryCharging = false;
    unsigned long long uptime = 0;
    char user[256] = "";
    char time[32] = "";
    char ping[32] = "—";
    char gpu[256] = "";
};

Stats stats;
bool running = true;
HWND overlayHwnd = NULL;
HWND menuHwnd = NULL;
int overlayFps = 0;
int overlayFrames = 0;
double overlayLastTime = 0;
bool dragging = false;
POINT dragOffset = {0, 0};

const int TRAY_ICON_ID = 1001;
const UINT WM_TRAYICON = WM_APP + 1;

// ---------- Вспомогательные ----------

std::string getConfigPath() {
    char path[MAX_PATH];
    if (SUCCEEDED(SHGetFolderPathA(NULL, CSIDL_APPDATA, NULL, 0, path))) {
        std::string dir = std::string(path) + "\\GamingX";
        CreateDirectoryA(dir.c_str(), NULL);
        return dir + "\\config.json";
    }
    return "config.json";
}

void loadConfig() {
    std::ifstream f(configPath);
    if (!f.is_open()) return;
    std::stringstream ss;
    ss << f.rdbuf();
    std::string content = ss.str();
    // Парсим простые пары ключ:значение (упрощённый JSON-парсер для наших нужд)
    // Для надёжности читаем построчно
    std::string line;
    std::ifstream f2(configPath);
    while (std::getline(f2, line)) {
        // очень упрощённо — ищем подстроки
        if (line.find("\"hotkey\"") != std::string::npos) {
            size_t a = line.find(':'); if (a != std::string::npos) {
                std::string v = line.substr(a+1);
                v.erase(0, v.find_first_not_of(" \t\""));
                v.erase(v.find_last_not_of(" \t\"")+1);
                cfg.hotkey = v;
            }
        }
        if (line.find("\"overlayPosition\"") != std::string::npos) {
            size_t a = line.find(':'); if (a != std::string::npos) {
                std::string v = line.substr(a+1);
                v.erase(0, v.find_first_not_of(" \t\""));
                v.erase(v.find_last_not_of(" \t\"")+1);
                cfg.overlayPosition = v;
            }
        }
        if (line.find("\"clickThrough\"") != std::string::npos) {
            cfg.clickThrough = line.find("true") != std::string::npos;
        }
        if (line.find("\"opacity\"") != std::string::npos) {
            size_t a = line.find(':'); if (a != std::string::npos) {
                std::string v = line.substr(a+1);
                v.erase(0, v.find_first_not_of(" \t"));
                v.erase(v.find_last_not_of(" \t,")+1);
                cfg.opacity = atoi(v.c_str());
            }
        }
        if (line.find("\"fontSize\"") != std::string::npos) {
            size_t a = line.find(':'); if (a != std::string::npos) {
                std::string v = line.substr(a+1);
                v.erase(0, v.find_first_not_of(" \t"));
                v.erase(v.find_last_not_of(" \t,")+1);
                cfg.fontSize = atoi(v.c_str());
            }
        }
        if (line.find("\"statsInterval\"") != std::string::npos) {
            size_t a = line.find(':'); if (a != std::string::npos) {
                std::string v = line.substr(a+1);
                v.erase(0, v.find_first_not_of(" \t"));
                v.erase(v.find_last_not_of(" \t,")+1);
                cfg.statsInterval = atoi(v.c_str());
            }
        }
        if (line.find("\"fpsAlertThreshold\"") != std::string::npos) {
            size_t a = line.find(':'); if (a != std::string::npos) {
                std::string v = line.substr(a+1);
                v.erase(0, v.find_first_not_of(" \t"));
                v.erase(v.find_last_not_of(" \t,")+1);
                cfg.fpsAlertThreshold = atoi(v.c_str());
            }
        }
        if (line.find("\"modules\"") != std::string::npos) {
            // модули читаем проще — по presencia ключей
        }
        if (line.find("\"fps\"") != std::string::npos && line.find("modules") == std::string::npos) {
            // пропускаем верхний fps
        }
        if (line.find("\"pingHost\"") != std::string::npos) {
            size_t a = line.find(':'); if (a != std::string::npos) {
                std::string v = line.substr(a+1);
                v.erase(0, v.find_first_not_of(" \t\""));
                v.erase(v.find_last_not_of(" \t\"")+1);
                cfg.pingHost = v;
            }
        }
        if (line.find("\"pingPort\"") != std::string::npos) {
            size_t a = line.find(':'); if (a != std::string::npos) {
                std::string v = line.substr(a+1);
                v.erase(0, v.find_first_not_of(" \t"));
                v.erase(v.find_last_not_of(" \t,")+1);
                cfg.pingPort = atoi(v.c_str());
            }
        }
    }
    // модули по умолчанию true, если не найдено false
}

void saveConfig() {
    // упрощённо — не пишем, config читается при старте
}

// ---------- Системная информация ----------

int getCpuPercent() {
    FILETIME idle1, kernel1, user1, idle2, kernel2, user2;
    GetSystemTimes(&idle1, &kernel1, &user1);
    Sleep(500);
    GetSystemTimes(&idle2, &kernel2, &user2);
    ULONGLONG idleDelta = (((ULONGLONG)idle2.dwHighDateTime << 32) | idle2.dwLowDateTime) -
                          (((ULONGLONG)idle1.dwHighDateTime << 32) | idle1.dwLowDateTime);
    ULONGLONG kernelDelta = (((ULONGLONG)kernel2.dwHighDateTime << 32) | kernel2.dwLowDateTime) -
                            (((ULONGLONG)kernel1.dwHighDateTime << 32) | kernel1.dwLowDateTime);
    ULONGLONG userDelta = (((ULONGLONG)user2.dwHighDateTime << 32) | user2.dwLowDateTime) -
                          (((ULONGLONG)user1.dwHighDateTime << 32) | user1.dwLowDateTime);
    ULONGLONG total = kernelDelta + userDelta;
    if (total == 0) return 0;
    return (int)(100 * (1.0 - (double)idleDelta / (double)total));
}

void getRam(int &used, int &total, int &percent) {
    MEMORYSTATUSEX mem;
    mem.dwLength = sizeof(MEMORYSTATUSEX);
    GlobalMemoryStatusEx(&mem);
    total = (int)(mem.ullTotalPhys / (1024*1024));
    used = (int)((mem.ullTotalPhys - mem.ullAvailPhys) / (1024*1024));
    percent = (int)mem.dwMemoryLoad;
}

void getBattery(int &percent, bool &charging) {
    SYSTEM_POWER_STATUS ps;
    if (GetSystemPowerStatus(&ps)) {
        percent = ps.BatteryLifePercent;
        charging = ps.ACLineStatus == 1;
    } else {
        percent = 0; charging = false;
    }
}

unsigned long long getUptime() {
    return GetTickCount64() / 1000;
}

void getUser(char *buf, size_t size) {
    DWORD len = (DWORD)size;
    GetUserNameA(buf, &len);
}

void getTime(char *buf, size_t size) {
    SYSTEMTIME st;
    GetLocalTime(&st);
    snprintf(buf, size, "%02d:%02d:%02d", st.wHour, st.wMinute, st.wSecond);
}

std::string pingTcp(const char *host, int port) {
    WSADATA wsa;
    if (WSAStartup(MAKEWORD(2,2), &wsa) != 0) return "—";
    SOCKET s = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (s == INVALID_SOCKET) { WSACleanup(); return "—"; }
    sockaddr_in addr;
    addr.sin_family = AF_INET;
    addr.sin_port = htons((u_short)port);
    addr.sin_addr.s_addr = inet_addr(host);
    if (addr.sin_addr.s_addr == INADDR_NONE) {
        hostent *he = gethostbyname(host);
        if (!he) { closesocket(s); WSACleanup(); return "—"; }
        addr.sin_addr = *((in_addr*)he->h_addr);
    }
    u_long nonblock = 1;
    ioctlsocket(s, FIONBIO, &nonblock);
    int res = connect(s, (sockaddr*)&addr, sizeof(addr));
    if (res == SOCKET_ERROR && WSAGetLastError() != WSAEWOULDBLOCK) {
        closesocket(s); WSACleanup(); return "—";
    }
    fd_set fd; FD_ZERO(&fd); FD_SET(s, &fd);
    timeval tv; tv.tv_sec = 2; tv.tv_usec = 0;
    res = select(0, NULL, &fd, NULL, &tv);
    if (res <= 0) { closesocket(s); WSACleanup(); return "—"; }
    int err = 0; int errLen = sizeof(err);
    getsockopt(s, SOL_SOCKET, SO_ERROR, (char*)&err, &errLen);
    closesocket(s);
    WSACleanup();
    if (err != 0) return "—";
    return "OK";
}

// ---------- Статистика поток ----------

DWORD WINAPI statsThread(LPVOID) {
    while (running) {
        stats.cpu = getCpuPercent();
        getRam(stats.ramUsed, stats.ramTotal, stats.ramPercent);
        getBattery(stats.battery, stats.batteryCharging);
        stats.uptime = getUptime();
        getUser(stats.user, sizeof(stats.user));
        getTime(stats.time, sizeof(stats.time));
        if (cfg.modulesPing) {
            std::string p = pingTcp(cfg.pingHost.c_str(), cfg.pingPort);
            strncpy_s(stats.ping, p.c_str(), sizeof(stats.ping));
        }
        Sleep(cfg.statsInterval);
    }
    return 0;
}

// ---------- Оверлей ----------

LRESULT CALLBACK overlayWndProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    switch (msg) {
        case WM_CREATE: {
            SetTimer(hwnd, 1, 16, NULL); // ~60 FPS
            CreateThread(NULL, 0, statsThread, NULL, 0, NULL);
            return 0;
        }
        case WM_NCHITTEST: {
            if (cfg.unlocked && !cfg.clickThrough) return HTCAPTION;
            return HTTRANSPARENT;
        }
        case WM_LBUTTONDOWN: {
            if (cfg.unlocked) {
                dragging = true;
                POINT p; GetCursorPos(&p);
                RECT r; GetWindowRect(hwnd, &r);
                dragOffset.x = p.x - r.left;
                dragOffset.y = p.y - r.top;
                SetCapture(hwnd);
            }
            return 0;
        }
        case WM_LBUTTONUP: {
            dragging = false;
            ReleaseCapture();
            return 0;
        }
        case WM_MOUSEMOVE: {
            if (dragging) {
                POINT p; GetCursorPos(&p);
                int x = p.x - dragOffset.x;
                int y = p.y - dragOffset.y;
                SetWindowPos(hwnd, HWND_TOPMOST, x, y, 0, 0, SWP_NOSIZE | SWP_NOACTIVATE);
                cfg.unlocked = true;
            }
            return 0;
        }
        case WM_PAINT: {
            PAINTSTRUCT ps;
            HDC hdc = BeginPaint(hwnd, &ps);
            RECT rc; GetClientRect(hwnd, &rc);
            int w = rc.right - rc.left;
            int h = rc.bottom - rc.top;

            HDC mem = CreateCompatibleDC(hdc);
            HBITMAP bmp = CreateCompatibleBitmap(hdc, w, h);
            SelectObject(mem, bmp);
            FillRect(mem, &rc, (HBRUSH)GetStockObject(BLACK_BRUSH));

            SetBkMode(mem, TRANSPARENT);

            HFONT hFont = CreateFont(-cfg.fontSize, 0, 0, 0, FW_BOLD, FALSE, FALSE, 0,
                                     ANSI_CHARSET, OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS,
                                     DEFAULT_QUALITY, FF_DONTCARE, "Orbitron");
            if (!hFont) hFont = CreateFont(-cfg.fontSize, 0, 0, 0, FW_BOLD, FALSE, FALSE, 0,
                                           ANSI_CHARSET, OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS,
                                           DEFAULT_QUALITY, FF_DONTCARE, "Courier New");
            SelectObject(mem, hFont);

            int y = 10;
            int x = 10;
            auto drawText = [&](int tx, int ty, const char *text, COLORREF color) {
                SetTextColor(mem, color);
                TextOutA(mem, tx, ty, text, (int)strlen(text));
            };

            drawText(x, y, "GX OVERLAY", RGB(0,255,255));
            y += 20;

            if (cfg.modulesFps) {
                char buf[64];
                snprintf(buf, sizeof(buf), "FPS: %d", overlayFps);
                drawText(x, y, buf, overlayFps >= cfg.fpsAlertThreshold ? RGB(0,255,0) : RGB(255,0,0));
                y += 18;
            }
            if (cfg.modulesCpu) {
                char buf[64];
                snprintf(buf, sizeof(buf), "CPU: %d%%", stats.cpu);
                drawText(x, y, buf, RGB(0,255,255));
                y += 18;
            }
            if (cfg.modulesRam) {
                char buf[64];
                snprintf(buf, sizeof(buf), "RAM: %d/%d MB (%d%%)", stats.ramUsed, stats.ramTotal, stats.ramPercent);
                drawText(x, y, buf, RGB(0,255,255));
                y += 18;
            }
            if (cfg.modulesGpu && stats.gpu[0]) {
                char buf[300];
                snprintf(buf, sizeof(buf), "GPU: %s", stats.gpu);
                drawText(x, y, buf, RGB(0,255,255));
                y += 18;
            }
            if (cfg.modulesBattery) {
                char buf[64];
                snprintf(buf, sizeof(buf), "BATT: %d%% %s", stats.battery, stats.batteryCharging ? "+" : "");
                drawText(x, y, buf, RGB(0,255,255));
                y += 18;
            }
            if (cfg.modulesUptime) {
                char buf[128];
                unsigned long long up = stats.uptime;
                snprintf(buf, sizeof(buf), "UP: %02llu:%02llu:%02llu | %s | %s",
                         up/3600, (up%3600)/60, up%60, stats.user, stats.time);
                drawText(x, y, buf, RGB(0,255,255));
                y += 18;
            }
            if (cfg.modulesPing) {
                char buf[128];
                snprintf(buf, sizeof(buf), "PING %s: %s", cfg.pingHost.c_str(), stats.ping);
                drawText(x, y, buf, RGB(0,255,255));
                y += 18;
            }

            SetTextColor(mem, RGB(128,128,128));
            drawText(x, h - 20, "CTRL+ALT+X — МЕНЮ", RGB(128,128,128));

            DeleteObject(hFont);
            DeleteObject(bmp);
            DeleteDC(mem);
            EndPaint(hwnd, &ps);
            return 0;
        }
        case WM_TIMER: {
            if (msg == WM_TIMER && wParam == 1) {
                double now = (double)GetTickCount64() / 1000.0;
                overlayFrames++;
                if (now - overlayLastTime >= 1.0) {
                    overlayFps = overlayFrames;
                    overlayFrames = 0;
                    overlayLastTime = now;
                }
                InvalidateRect(hwnd, NULL, FALSE);
                UpdateWindow(hwnd);
            }
            return 0;
        }
        case WM_DESTROY:
            overlayHwnd = NULL;
            PostQuitMessage(0);
            return 0;
    }
    return DefWindowProc(hwnd, msg, wParam, lParam);
}

// ---------- Меню ----------

LRESULT CALLBACK menuWndProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    switch (msg) {
        case WM_CLOSE:
            ShowWindow(hwnd, SW_HIDE);
            return 0;
        case WM_DESTROY:
            menuHwnd = NULL;
            return 0;
    }
    return DefWindowProc(hwnd, msg, wParam, lParam);
}

// ---------- Трей ----------

void createTrayIcon(HWND hwnd) {
    NOTIFYICONDATAA nid;
    ZeroMemory(&nid, sizeof(nid));
    nid.cbSize = sizeof(NOTIFYICONDATAA);
    nid.hWnd = hwnd;
    nid.uID = TRAY_ICON_ID;
    nid.uFlags = NIF_MESSAGE | NIF_ICON | NIF_TIP | NIF_SHOWTIP;
    nid.uCallbackMessage = WM_TRAYICON;
    nid.hIcon = LoadIconA(NULL, IDI_APPLICATION);
    strcpy_s(nid.szTip, "GamingX Overlay");
    Shell_NotifyIconA(NIM_ADD, &nid);
}

void removeTrayIcon(HWND hwnd) {
    NOTIFYICONDATAA nid;
    ZeroMemory(&nid, sizeof(nid));
    nid.cbSize = sizeof(NOTIFYICONDATAA);
    nid.hWnd = hwnd;
    nid.uID = TRAY_ICON_ID;
    Shell_NotifyIconA(NIM_DELETE, &nid);
}

// ---------- Главное ----------

int WINAPI WinMain(HINSTANCE hInstance, HINSTANCE, LPSTR, int) {
    configPath = getConfigPath();
    loadConfig();

    // DPI awareness
    SetProcessDPIAware();

    // Регистрация класса оверлея
    WNDCLASSEXA wc;
    ZeroMemory(&wc, sizeof(wc));
    wc.cbSize = sizeof(WNDCLASSEXA);
    wc.lpfnWndProc = overlayWndProc;
    wc.hInstance = hInstance;
    wc.lpszClassName = "GamingXOverlayClass";
    wc.hCursor = LoadCursorA(NULL, IDC_ARROW);
    wc.hbrBackground = (HBRUSH)GetStockObject(BLACK_BRUSH);
    RegisterClassExA(&wc);

    // Размеры и позиция оверлея
    int scrW = GetSystemMetrics(SM_CXSCREEN);
    int scrH = GetSystemMetrics(SM_CYSCREEN);
    int ovW = 340, ovH = 220, pad = 20;
    int x = pad, y = pad;
    if (cfg.overlayPosition == "top-right") x = scrW - ovW - pad;
    else if (cfg.overlayPosition == "bottom-left") y = scrH - ovH - pad;
    else if (cfg.overlayPosition == "bottom-right") { x = scrW - ovW - pad; y = scrH - ovH - pad; }

    overlayHwnd = CreateWindowExA(
        WS_EX_TOOLWINDOW | WS_EX_TOPMOST | WS_EX_LAYERED | WS_EX_TRANSPARENT | WS_EX_NOACTIVATE,
        "GamingXOverlayClass", "GamingX Overlay",
        WS_POPUP, x, y, ovW, ovH,
        NULL, NULL, hInstance, NULL
    );
    BYTE alpha = (BYTE)(255 * (cfg.opacity / 100.0));
    SetLayeredWindowAttributes(overlayHwnd, 0, alpha, LWA_ALPHA);
    SetWindowPos(overlayHwnd, HWND_TOPMOST, x, y, ovW, ovH, SWP_SHOWWINDOW | SWP_NOACTIVATE);
    ShowWindow(overlayHwnd, SW_SHOWNA);
    UpdateWindow(overlayHwnd);

    // Горячая клавиша
    UINT mods = 0;
    if (cfg.hotkey.find("Ctrl") != std::string::npos) mods |= MOD_CONTROL;
    if (cfg.hotkey.find("Alt") != std::string::npos) mods |= MOD_ALT;
    if (cfg.hotkey.find("Shift") != std::string::npos) mods |= MOD_SHIFT;
    RegisterHotKey(overlayHwnd, 1, mods, 0x58); // X

    createTrayIcon(overlayHwnd);

    // Цикл сообщений оверлея
    MSG msg;
    ZeroMemory(&msg, sizeof(msg));
    while (running) {
        if (PeekMessageA(&msg, NULL, 0, 0, PM_REMOVE)) {
            if (msg.message == WM_QUIT) { running = false; break; }
            if (msg.message == WM_HOTKEY) {
                // Toggle menu
                if (menuHwnd && IsWindowVisible(menuHwnd)) ShowWindow(menuHwnd, SW_HIDE);
                else {
                    if (!menuHwnd) {
                        WNDCLASSEXA mwc;
                        ZeroMemory(&mwc, sizeof(mwc));
                        mwc.cbSize = sizeof(WNDCLASSEXA);
                        mwc.lpfnWndProc = menuWndProc;
                        mwc.hInstance = hInstance;
                        mwc.lpszClassName = "GamingXMenuClass";
                        mwc.hbrBackground = (HBRUSH)GetStockObject(BLACK_BRUSH);
                        RegisterClassExA(&mwc);
                        menuHwnd = CreateWindowExA(
                            WS_EX_TOOLWINDOW | WS_EX_TOPMOST | WS_EX_APPWINDOW,
                            "GamingXMenuClass", "GamingX Overlay — Меню",
                            WS_POPUP | WS_CAPTION | WS_SYSMENU | WS_THICKFRAME | WS_MINIMIZEBOX,
                            100, 100, 700, 600, NULL, NULL, hInstance, NULL);
                    }
                    ShowWindow(menuHwnd, SW_SHOW);
                    SetForegroundWindow(menuHwnd);
                    UpdateWindow(menuHwnd);
                }
            }
            TranslateMessage(&msg);
            DispatchMessageA(&msg);
        } else {
            if (overlayHwnd) {
                InvalidateRect(overlayHwnd, NULL, FALSE);
                UpdateWindow(overlayHwnd);
            }
            Sleep(16);
        }
    }

    removeTrayIcon(overlayHwnd);
    return 0;
}
