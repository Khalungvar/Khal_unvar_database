' Starts the display watchdog without a black window
CreateObject("WScript.Shell").Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""C:\UngvarDisplay\watchdog.ps1""", 0, False
