@echo off
REM ============================================================
REM  Start Redis for RestaurantOS, then run the event bus probe.
REM
REM  Redis is the ONLY mechanism that moves events between
REM  services. Without it each service's bus is a separate
REM  singleton in its own process and events are dropped after
REM  the first Redis blip.
REM
REM  Usage (from any folder):
REM      start_redis.bat
REM
REM  Exit codes: 0 = Redis up AND events cross processes
REM              1 = Redis up but events do NOT cross processes
REM              2 = Redis not running after trying to start it
REM              3 = redis-server binary not found anywhere
REM ============================================================

setlocal EnableDelayedExpansion

set "REPO=%~dp0"
set "rc=2"
set "PY=%~dp0backend\.venv\Scripts\python.exe"
if not exist "!PY!" set "PY=C:\Users\abhil\anaconda3\envs\sales\python.exe"
if not exist "!PY!" set "PY=python"

echo ============================================================
echo  RestaurantOS  Redis bootstrap
echo ============================================================
echo  Python: !PY!
echo.

REM ------------------------------------------------------------
REM  Locate redis-server. Windows installs hide it in several
REM  places, so check them all rather than assuming PATH.
REM ------------------------------------------------------------
set "REDIS="

where.exe redis-server >nul 2>nul
if not errorlevel 1 (
    set "REDIS=redis-server"
    goto :found_redis
)

for %%P in (
    "C:\Program Files\Redis\redis-server.exe"
    "C:\Program Files (x86)\Redis\redis-server.exe"
    "C:\Redis\redis-server.exe"
    "C:\Redis\Redis Server\redis-server.exe"
    "C:\Program Files\Microsoft Redis\redis-server.exe"
    "C:\Redis\redis-6.2.6\redis-server.exe"
    "%LOCALAPPDATA%\Programs\Redis\redis-server.exe"
    "%USERPROFILE%\AppData\Roaming\Redis\redis-server.exe"
    "C:\ProgramData\Redis\redis-server.exe"
) do (
    if exist %%~P (
        set "REDIS=%%~P"
        goto :found_redis
    )
)

echo  [!!] redis-server not found on PATH or in the usual locations.
echo.
echo  Redis is not installed yet. Install it with ONE of these, then
echo  run this script again:
echo.
echo    1. Chocolatey (recommended, needs admin + choco installed):
echo       choco install -y redis-mjackson
echo.
echo    2. winget:
echo       winget install Redis.Redis
echo       REM then open a NEW terminal, then this script again
echo.
echo    3. Docker Desktop:
echo       docker run -d --name ros-redis -p 6379:6379 redis:7-alpine
echo       docker start ros-redis          REM after a reboot
echo.
echo  Afterwards, confirm a listener exists:
echo    netstat -ano ^| findstr :6379
echo.
set "rc=3"
goto :finish

:found_redis
echo  [OK] Found redis-server: !REDIS!
echo.

REM ------------------------------------------------------------
REM  Is something already listening on 6379?
REM ------------------------------------------------------------
netstat -ano | findstr "LISTENING" | findstr ":6379" >nul 2>nul
if not errorlevel 1 (
    echo  [OK] Redis already listening on :6379
    set "rc=0"
    goto :run_probe
)

echo  [..] Nothing on :6379 - starting redis-server ...

REM Launch minimized so this console stays free to run the probe.
REM --port is explicit so a stale config pointing elsewhere cannot
REM break the connection the bus expects. --dir keeps dump.rdb
REM writable regardless of where this script was invoked from.
start "RestaurantOS Redis" /min "!REDIS!" --port 6379 --bind 127.0.0.1 --dir "%TEMP%"

echo  Waiting for Redis to come up ...
set /a tries=0
:wait_loop
set /a tries+=1
if !tries! GTR 15 (
    echo.
    echo  [!!] Redis did not come up within 15 seconds.
    echo.
    echo  Common causes:
    echo    - Another program already owns port 6379
    echo        netstat -ano ^| findstr :6379
    echo    - Redis config points at a read-only data dir
    echo    - Antivirus blocking the new process
    echo.
    goto :finish
)
ping -n 3 127.0.0.1 >nul
netstat -ano | findstr "LISTENING" | findstr ":6379" >nul 2>nul
if not errorlevel 1 (
    echo  [OK] Redis is up on :6379
    set "rc=0"
    goto :run_probe
)
echo   ... retrying (!tries!/15)
goto :wait_loop

:run_probe
echo.
echo ============================================================
echo  Cross-process event bus probe
echo ============================================================
echo.
cd /d "!REPO!backend"
"!PY!" scripts\probe_eventbus.py
set "rc=!ERRORLEVEL!"

if !rc!==0 (
    echo.
    echo  All good - Redis is up and events flow between processes.
    echo  Next steps:
    echo    python run_services.py restart all
    echo    python scripts\probe_infra.py
) else (
    echo.
    echo  Redis is listening but events still do not cross processes.
    echo  See the output above - the receiver output line is the clue.
)

:finish
echo.
echo Exit code: !rc!  (0=ok  1=delivery failed  2=redis not running  3=not installed)
echo Press any key to close ...
pause >nul
exit /b !rc!
