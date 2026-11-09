// GamingX Overlay — Linux терминал-версия (g++, без WinAPI)
// Компиляция: g++ gamingx_overlay_linux.cpp -o GamingX -O2 -pthread
// Стиль debug 2000-х: угловатый, неоново-зелёный на чёрном

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <ctime>
#include <string>
#include <fstream>
#include <sstream>
#include <thread>
#include <chrono>
#include <atomic>
#include <mutex>
#include <iomanip>

std::atomic<bool> running{true};
std::mutex stats_mtx;

struct Stats {
    int cpu = 0;
    int ram_used = 0;
    int ram_total = 0;
    int ram_percent = 0;
    int battery = 0;
    bool battery_charging = false;
    unsigned long long uptime = 0;
    char user[64] = "user";
    char time_str[32] = "00:00:00";
    char ping[16] = "—";
} stats;

static inline std::string read_file_first_line(const char *path) {
    std::ifstream f(path);
    std::string line;
    std::getline(f, line);
    return line;
}

static inline long long parse_ll(const char *s) {
    long long v = 0;
    while (*s && (*s < '0' || *s > '9')) ++s;
    while (*s >= '0' && *s <= '9') { v = v * 10 + (*s - '0'); ++s; }
    return v;
}

int get_cpu_percent() {
    // Читаем /proc/stat дважды с задержкой
    auto read_cpu_times = [](long long &idle, long long &total) {
        std::string line = read_file_first_line("/proc/stat");
        std::istringstream iss(line);
        std::string cpu_label;
        iss >> cpu_label; // "cpu"
        long long user, nice, system, idle_val, iowait, irq, softirq, steal;
        iss >> user >> nice >> system >> idle_val >> iowait >> irq >> softirq >> steal;
        long long total_val = user + nice + system + idle_val + iowait + irq + softirq + steal;
        idle = idle_val + iowait;
        total = total_val;
    };
    long long idle1, total1, idle2, total2;
    read_cpu_times(idle1, total1);
    std::this_thread::sleep_for(std::chrono::milliseconds(500));
    read_cpu_times(idle2, total2);
    long long idle_delta = idle2 - idle1;
    long long total_delta = total2 - total1;
    if (total_delta <= 0) return 0;
    int pct = (int)(100.0 * (1.0 - (double)idle_delta / (double)total_delta));
    if (pct < 0) pct = 0;
    if (pct > 100) pct = 100;
    return pct;
}

void get_ram(int &used, int &total, int &percent) {
    std::string meminfo;
    {
        std::ifstream f("/proc/meminfo");
        meminfo.assign((std::istreambuf_iterator<char>(f)), std::istreambuf_iterator<char>());
    }
    long long mem_total = 0, mem_free = 0, mem_avail = 0;
    size_t pos;
    if ((pos = meminfo.find("MemTotal:")) != std::string::npos) {
        mem_total = parse_ll(meminfo.c_str() + pos + 9);
    }
    if ((pos = meminfo.find("MemAvailable:")) != std::string::npos) {
        mem_avail = parse_ll(meminfo.c_str() + pos + 13);
    } else if ((pos = meminfo.find("MemFree:")) != std::string::npos) {
        mem_avail = parse_ll(meminfo.c_str() + pos + 8);
    }
    mem_total *= 1024; // kB -> bytes
    mem_avail *= 1024;
    long long mem_used = mem_total - mem_avail;
    used = (int)(mem_used / (1024 * 1024));
    total = (int)(mem_total / (1024 * 1024));
    percent = mem_total > 0 ? (int)((double)mem_used / (double)mem_total * 100.0) : 0;
}

void get_battery(int &percent, bool &charging) {
    // Пытаемся найти батарею в /sys/class/power_supply
    percent = 0;
    charging = false;
    // Простой вариант: пробуем BAT0
    std::string cap_path = "/sys/class/power_supply/BAT0/capacity";
    std::string status_path = "/sys/class/power_supply/BAT0/status";
    std::ifstream cap(cap_path);
    if (cap.is_open()) {
        cap >> percent;
        cap.close();
    }
    std::ifstream st(status_path);
    if (st.is_open()) {
        std::string s;
        st >> s;
        charging = (s == "Charging" || s == "Unknown");
        st.close();
    }
}

unsigned long long get_uptime() {
    std::string line = read_file_first_line("/proc/uptime");
    return (unsigned long long)(std::stod(line) + 0.5);
}

void get_user(char *buf, size_t size) {
    const char *u = std::getenv("USER");
    if (!u) u = "user";
    strncpy(buf, u, size - 1);
    buf[size - 1] = '\0';
}

void get_time(char *buf, size_t size) {
    std::time_t now = std::time(nullptr);
    std::tm *tm = std::localtime(&now);
    std::snprintf(buf, size, "%02d:%02d:%02d", tm->tm_hour, tm->tm_min, tm->tm_sec);
}

void stats_loop() {
    while (running) {
        int cpu = get_cpu_percent();
        int ru = 0, rt = 0, rp = 0;
        get_ram(ru, rt, rp);
        int bat = 0;
        bool chg = false;
        get_battery(bat, chg);
        unsigned long long up = get_uptime();
        char usr[64] = "user";
        char tm[32] = "00:00:00";
        get_user(usr, sizeof(usr));
        get_time(tm, sizeof(tm));

        std::lock_guard<std::mutex> lk(stats_mtx);
        stats.cpu = cpu;
        stats.ram_used = ru;
        stats.ram_total = rt;
        stats.ram_percent = rp;
        stats.battery = bat;
        stats.battery_charging = chg;
        stats.uptime = up;
        std::strncpy(stats.user, usr, sizeof(stats.user) - 1);
        stats.user[sizeof(stats.user) - 1] = '\0';
        std::strncpy(stats.time_str, tm, sizeof(stats.time_str) - 1);
        stats.time_str[sizeof(stats.time_str) - 1] = '\0';

        std::this_thread::sleep_for(std::chrono::milliseconds(1000));
    }
}

// ANSI escape codes
const char *CLEAR = "\033[2J\033[H";
const char *GREEN = "\033[1;32m";
const char *CYAN  = "\033[1;36m";
const char *RED   = "\033[1;31m";
const char *YELLOW= "\033[1;33m";
const char *RESET = "\033[0m";
const char *BOLD  = "\033[1m";
const char *HIDE_CURSOR = "\033[?25l";
const char *SHOW_CURSOR = "\033[?25h";

void draw_hud() {
    std::lock_guard<std::mutex> lk(stats_mtx);
    std::printf("%s", CLEAR);
    std::printf("%s%sG<sup>X</sup> OVERLAY%s (Linux terminal build)\n", BOLD, CYAN, RESET);
    std::printf("%s----------------------------------------%s\n", GREEN, RESET);

    auto line = [](const char *name, const char *value, const char *color) {
        std::printf(" %-12s %s%s%s\n", name, color, value, RESET);
    };

    char fps_buf[16];
    std::snprintf(fps_buf, sizeof(fps_buf), "%d", stats.cpu); // используем cpu как FPS-заглушку для демонстрации
    line("FPS", fps_buf, stats.cpu >= 30 ? GREEN : RED);

    char cpu_buf[16];
    std::snprintf(cpu_buf, sizeof(cpu_buf), "%d%%", stats.cpu);
    line("CPU", cpu_buf, CYAN);

    char ram_buf[64];
    std::snprintf(ram_buf, sizeof(ram_buf), "%d / %d MB (%d%%)", stats.ram_used, stats.ram_total, stats.ram_percent);
    line("RAM", ram_buf, CYAN);

    char batt_buf[32];
    std::snprintf(batt_buf, sizeof(batt_buf), "%d%% %s", stats.battery, stats.battery_charging ? "+" : "");
    line("BATT", batt_buf, CYAN);

    unsigned long long up = stats.uptime;
    char uptime_buf[64];
    std::snprintf(uptime_buf, sizeof(uptime_buf), "%02llu:%02llu:%02llu | %s | %s",
                  up / 3600, (up % 3600) / 60, up % 60, stats.user, stats.time_str);
    line("UPTIME", uptime_buf, CYAN);

    line("PING", stats.ping, CYAN);

    std::printf("%s----------------------------------------%s\n", GREEN, RESET);
    std::printf("%s  CTRL+C — ВЫХОД%s\n", YELLOW, RESET);
    std::fflush(stdout);
}

int main() {
    std::printf("%s%s", HIDE_CURSOR, CLEAR);
    std::fflush(stdout);

    std::thread t(stats_loop);
    t.detach();

    while (running) {
        draw_hud();
        std::this_thread::sleep_for(std::chrono::milliseconds(200));
    }

    std::printf("%s%s", SHOW_CURSOR, RESET);
    std::printf("\nGamingX Overlay остановлен.\n");
    return 0;
}
