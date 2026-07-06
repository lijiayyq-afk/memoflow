@echo off
chcp 65001 > nul
title MemoFlow 计划任务安装工具

echo ==================================================
echo         MemoFlow 每日自动备份任务注册工具
echo ==================================================
echo.
echo 正在向 Windows 任务计划程序中注册每日自动备份任务...
echo 触发时间：每天晚上 23:00
echo 运行方式：后台静默运行（无控制台黑框打扰）
echo.

schtasks /create /tn "MemoFlow_DailyBackup" /tr "wscript.exe E:\ai_code\memoflow\silent_backup.vbs" /sc daily /st 23:00 /f

echo.
if %ERRORLEVEL% equ 0 (
    echo ==================================================
    echo [🎉 注册成功!]
    echo 任务已成功登记。你可以通过 Windows 的 "任务计划程序" 找到并管理它。
    echo 备份文件将每天自动输出至：E:\ai_code\memoflow_backups\
    echo ==================================================
) else (
    echo ==================================================
    echo [❌ 注册失败!]
    echo 请确认是否以管理员身份运行此脚本。
    echo ==================================================
)
echo.
pause
