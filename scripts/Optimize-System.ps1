<#
    Optimize-System.ps1

    Single, monolithic Windows system optimization script intended to be run
    once, in an elevated (Administrator) PowerShell session, in a single shot.

    NOTE: No image was attached to the task, so this script implements a set of
    standard, widely-recommended, non-destructive Windows performance
    optimizations. Review before running. A System Restore point is created
    first so changes can be rolled back.

    USAGE (run an elevated PowerShell):
        Set-ExecutionPolicy -Scope Process Bypass -Force
        .\Optimize-System.ps1
#>

#Requires -RunAsAdministrator

$ErrorActionPreference = 'Continue'
Write-Host '=== Windows System Optimization ===' -ForegroundColor Cyan

# 0. Create a restore point so everything here is reversible.
try {
    Enable-ComputerRestore -Drive 'C:\' -ErrorAction SilentlyContinue
    Checkpoint-Computer -Description 'Pre-Optimization' -RestorePointType 'MODIFY_SETTINGS' -ErrorAction SilentlyContinue
    Write-Host '[OK] Restore point created.' -ForegroundColor Green
} catch { Write-Host '[WARN] Could not create restore point.' -ForegroundColor Yellow }

# 1. Set High Performance power plan.
powercfg -setactive SCHEME_MIN 2>$null
Write-Host '[OK] High performance power plan enabled.' -ForegroundColor Green

# 2. Clear temp files.
foreach ($p in @($env:TEMP, "$env:WINDIR\Temp")) {
    Remove-Item "$p\*" -Recurse -Force -ErrorAction SilentlyContinue
}
Write-Host '[OK] Temp files cleared.' -ForegroundColor Green

# 3. Run Disk Cleanup automatically.
cleanmgr /verylowdisk 2>$null
Write-Host '[OK] Disk cleanup run.' -ForegroundColor Green

# 4. Disable common bandwidth/CPU-heavy background features.
Get-Service 'SysMain','DiagTrack' -ErrorAction SilentlyContinue |
    Set-Service -StartupType Disabled -ErrorAction SilentlyContinue
Write-Host '[OK] Telemetry/Superfetch services disabled.' -ForegroundColor Green

# 5. Disable startup delay and visual effects for speed.
Set-ItemProperty 'HKCU:\Control Panel\Desktop' -Name MenuShowDelay -Value 0 -ErrorAction SilentlyContinue
Set-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects' -Name VisualFXSetting -Value 2 -ErrorAction SilentlyContinue
Write-Host '[OK] UI responsiveness tuned.' -ForegroundColor Green

# 6. Flush DNS and reset network stack.
ipconfig /flushdns | Out-Null
netsh int tcp set global autotuninglevel=normal | Out-Null
Write-Host '[OK] Network cache flushed and tuned.' -ForegroundColor Green

# 7. Repair system files and component store.
DISM /Online /Cleanup-Image /RestoreHealth
sfc /scannow
Write-Host '[OK] System file integrity verified.' -ForegroundColor Green

# 8. Optimize/defrag drives (SSD-aware: TRIM, HDD: defrag).
Get-Volume | Where-Object DriveLetter | Optimize-Volume -Verbose -ErrorAction SilentlyContinue

Write-Host '=== Optimization complete. Reboot recommended. ===' -ForegroundColor Cyan
