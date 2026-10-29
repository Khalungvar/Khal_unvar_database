@echo off
setlocal
title Ungvar display - install
echo.
echo  Installing the Ungvar shul display...
echo.
set "D=C:\UngvarDisplay"
set "CH=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CH%" set "CH=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CH%" set "CH=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if not exist "%CH%" (
  echo  Chrome was not found on this computer.
  echo  Please install Google Chrome first, then run this file again.
  pause
  exit /b 1
)
if not exist "%D%" mkdir "%D%"
copy /y "%~dp0watchdog.ps1" "%D%\" >nul
copy /y "%~dp0loader.html" "%D%\" >nul
copy /y "%~dp0start.vbs" "%D%\" >nul
copy /y "%~dp0uninstall-display.bat" "%D%\" >nul
> "%D%\chrome-path.txt" echo %CH%

rem --- start automatically when Windows starts ---
copy /y "%D%\start.vbs" "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\UngvarDisplay.vbs" >nul

rem --- never turn off the screen or sleep (while plugged in) ---
powercfg /change monitor-timeout-ac 0 >nul 2>&1
powercfg /change standby-timeout-ac 0 >nul 2>&1
powercfg /change hibernate-timeout-ac 0 >nul 2>&1

rem --- start now ---
wscript.exe "%D%\start.vbs"
echo  Done. The display opens in a few seconds, full screen.
echo  To leave full screen: press Alt+F4.  (It comes back by itself within a minute.)
echo  To stop it for good: run C:\UngvarDisplay\uninstall-display.bat
echo.
pause
