@echo off
echo ========================================================
echo   Installing BusinessOS AI Desktop Icon & Web App...
echo ========================================================

set "APP_URL=%~1"
if "%APP_URL%"=="" set "APP_URL=%BUSINESSOS_URL%"
if "%APP_URL%"=="" set "APP_URL=https://lazymonkeyai.com"

set "TARGET_DIR=%APPDATA%\BusinessOS AI"
if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%"

copy /Y "%~dp0BusinessOS-AI.ico" "%TARGET_DIR%\BusinessOS-AI.ico" >nul

set "DESKTOP=%USERPROFILE%\Desktop"
set "SHORTCUT=%DESKTOP%\BusinessOS AI.url"

echo [InternetShortcut] > "%SHORTCUT%"
echo URL=%APP_URL% >> "%SHORTCUT%"
echo IconFile=%TARGET_DIR%\BusinessOS-AI.ico >> "%SHORTCUT%"
echo IconIndex=0 >> "%SHORTCUT%"

echo.
echo [SUCCESS] BusinessOS AI Desktop Icon installed to your Windows Desktop!
echo Configured Target URL: %APP_URL%
echo Double-click the desktop icon anytime to launch BusinessOS AI.
echo ========================================================
pause
