@echo off
chcp 65001 > nul
title MemoFlow 云端 D1 数据库备份工具

echo ==================================================
echo         MemoFlow 云端 D1 数据库备份工具
echo ==================================================
echo.

:: 设置备份保存目录
set "BACKUP_DIR=E:\ai_code\memoflow_backups"

:: 如果目录不存在则创建
if not exist "%BACKUP_DIR%" (
    echo 正在创建备份目录: %BACKUP_DIR%...
    mkdir "%BACKUP_DIR%"
)

:: 获取格式化的日期与时间戳
:: 兼容不同的 Windows 日期格式，提取 YYYYMMDD_HHMMSS
for /f "tokens=2 delims==" %%i in ('wmic os get localdatetime /value') do set "datetime=%%i"
set "DATE_STR=%datetime:~0,4%-%datetime:~4,2%-%datetime:~6,2%"
set "TIME_STR=%datetime:~8,2%-%datetime:~10,2%-%datetime:~12,2%"
set "FILE_NAME=%BACKUP_DIR%\memoflow_backup_%DATE_STR%_%TIME_STR%.sql"

echo.
echo 正在尝试从 Cloudflare 导出线上 D1 数据库数据...
echo 保存路径: %FILE_NAME%
echo.

:: 执行 wrangler 导出命令
call npx wrangler d1 export memoflow-db --remote --output "%FILE_NAME%"

echo.
if %ERRORLEVEL% equ 0 (
    echo ==================================================
    echo [🎉 备份成功!]
    echo 备份文件已安全保存至：%FILE_NAME%
    echo 提示: 该文件为标准 SQL 格式，包含了你所有的笔记、层级标签和账户数据。
    echo ==================================================
) else (
    echo ==================================================
    echo [❌ 备份失败!]
    echo 失败原因可能是：
    echo 1. 本地网络异常或受到代理干扰导致连接 Cloudflare 超时；
    echo 2. 本地 Wrangler 会话已过期，请在控制台先运行 npx wrangler whoami 校验。
    echo ==================================================
)
echo.
pause
