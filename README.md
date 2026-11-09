# GamingX Overlay — C++ / Win32

Гейминг-оверлей поверх **всех приложений** (включая игры и полноэкранные окна): счётчик FPS, системная информация, пинг, прицел, панель оптимизации Windows, системный трей. Горячая клавиша меню — **Ctrl+Alt+X**.

## Сборка под Windows (Visual Studio)

Репозиторий содержит готовый проект Visual Studio:

- `GamingX.sln` — решение
- `GamingX.vcxproj` — проект C++ (x64, Release/Debug)
- `GamingX.manifest` — манифест с **`requireAdministrator`** (UAC, запуск от имени администратора)

### Как собрать `.exe`

1. Установите **Visual Studio 2022** с компонентом **«Разработка классических приложений на C++»** (Desktop development with C++).
2. Откройте `GamingX.sln`.
3. В верхней панели выберите конфигурацию **Release** и платформу **x64**.
4. Нажмите **Сборка → Построить решение** (или `Ctrl+Shift+B`).
5. Готовый `GamingX.exe` появится в папке `x64\Release\`.

### Вручную через командную строку (Developer Command Prompt for VS)

```cmd
cd GamingOverlay
cl /nologo /O2 /W3 gamingx_overlay.cpp /link user32.lib gdi32.lib kernel32.lib shell32.lib advapi32.lib iphlpapi.lib ws2_32.lib /MANIFEST:EMBED /MANIFESTFILE:GamingX.manifest /OUT:GamingX.exe
```

## Возможности

| Модуль | Что делает |
|--------|------------|
| **FPS** | Счётчик кадров в реальном времени |
| **CPU / RAM** | Загрузка процессора и оперативной памяти |
| **Батарея** | Процент заряда и состояние зарядки |
| **Время / Пользователь** | Текущее время, имя пользователя, uptime системы |
| **Пинг** | TCP-проверка до любого хоста:порт |
| **Прицел** | Центровой прицел на экране |

## Управление

- **Ctrl+Alt+X** — открыть/закрыть меню.
- Оверлей висит в углу экрана поверх всех окон, клик сквозь него не мешает игре.
- Системный трей: быстрый доступ к программе.

## Технологии

- **C++17** + чистый **Win32 API** (без внешних GUI-библиотек)
- Окно: прозрачное, безрамочное, `alwaysOnTop`, клик сквозь, глобальные горячие клавиши
- Системная информация: `GetSystemTimes`, `GlobalMemoryStatusEx`, `GetSystemPowerStatus`, `GetTickCount64`
- Манифест: `requestedExecutionLevel level="requireAdministrator"` (требуются права администратора)

## Структура

```
GamingX.sln           — решение Visual Studio
GamingX.vcxproj       — проект C++ (x64)
GamingX.manifest      — манифест с requireAdministrator
gamingx_overlay.cpp   — основной код оверлея (Win32 API)
GamingX               — собранный Linux-бинарник (только для проверки, не для Windows)
```

> ⚠️ В этой песочнице нет Windows-компилятора (только Linux `g++`), поэтому `.exe` здесь собрать нельзя. Компилируйте на своей Windows через Visual Studio или MinGW.
