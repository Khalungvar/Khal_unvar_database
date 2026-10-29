@echo off
title Ungvar display - remove
del /q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\UngvarDisplay.vbs" >nul 2>&1
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*UngvarDisplay*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1
echo  The display was stopped and will not start with Windows anymore.
echo  (The folder C:\UngvarDisplay can be deleted by hand.)
pause
