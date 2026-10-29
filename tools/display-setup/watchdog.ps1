# Ungvar shul display - keeps the display open in Chrome (full screen) all the time.
# - Starts Chrome in kiosk mode with its own profile (no "restore pages" popups).
# - Every minute: if the display window is not running, opens it again.
# - Every night at 3:00: closes Chrome and opens it again (cleans small problems).
$ErrorActionPreference = 'SilentlyContinue'
$D = 'C:\UngvarDisplay'
$prof = Join-Path $D 'profile'
$loader = 'file:///C:/UngvarDisplay/loader.html'
$chrome = (Get-Content (Join-Path $D 'chrome-path.txt') -Raw).Trim()
$lastNight = ''

function Get-Kiosk { Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*UngvarDisplay\profile*' } }
function Start-Kiosk {
  # mark the last exit as normal so Chrome never shows "Restore pages?"
  $pref = Join-Path $prof 'Default\Preferences'
  if (Test-Path $pref) { (Get-Content $pref -Raw) -replace '"exit_type":"Crashed"', '"exit_type":"Normal"' -replace '"exited_cleanly":false', '"exited_cleanly":true' | Set-Content $pref -Encoding UTF8 }
  Start-Process -FilePath $chrome -ArgumentList @(
    '--kiosk', $loader, "--user-data-dir=$prof", '--no-first-run', '--no-default-browser-check', '--noerrdialogs',
    '--disable-session-crashed-bubble', '--disable-infobars', '--disable-features=Translate,TranslateUI',
    '--autoplay-policy=no-user-gesture-required', '--overscroll-history-navigation=0', '--disable-pinch', '--hide-crash-restore-bubble'
  )
}
while ($true) {
  $now = Get-Date
  $today = $now.ToString('yyyy-MM-dd')
  if ($now.Hour -eq 3 -and $lastNight -ne $today) {
    $lastNight = $today
    Get-Kiosk | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
    Start-Sleep -Seconds 5
  }
  if (-not (Get-Kiosk)) { Start-Kiosk; Start-Sleep -Seconds 20 }
  Start-Sleep -Seconds 60
}
