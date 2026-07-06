$ErrorActionPreference = "SilentlyContinue"

$ShortcutName = "MemoFlow"
$TargetUrl = "https://memoflow-li-as-services-projects.vercel.app"
$DesktopPath = [System.Environment]::GetFolderPath('Desktop')
$ShortcutPath = Join-Path $DesktopPath "$ShortcutName.lnk"

$ChromePaths = @(
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)

$EdgePaths = @(
    "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
)

$BrowserExe = ""
$Arguments = ""

foreach ($path in $ChromePaths) {
    if (Test-Path $path) {
        $BrowserExe = $path
        $Arguments = "--app=$TargetUrl --start-maximized"
        break
    }
}

if ($BrowserExe -eq "") {
    foreach ($path in $EdgePaths) {
        if (Test-Path $path) {
            $BrowserExe = $path
            $Arguments = "--app=$TargetUrl --start-maximized"
            break
        }
    }
}

if ($BrowserExe -eq "") {
    Write-Host "Error: No Chrome or Edge browser found."
    Exit
}

$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $BrowserExe
$Shortcut.Arguments = $Arguments
$Shortcut.Description = "MemoFlow Desktop Client App"
$Shortcut.WorkingDirectory = [System.IO.Path]::GetDirectoryName($BrowserExe)
$Shortcut.Save()

Write-Host "=================================================="
Write-Host "  MemoFlow Desktop Shortcut Created Successfully!"
Write-Host "=================================================="
Write-Host "Path: $ShortcutPath"
Write-Host "Double click the 'MemoFlow' icon on your desktop to launch."
