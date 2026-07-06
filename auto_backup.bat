@echo off
chcp 65001 > nul
set "BACKUP_DIR=E:\ai_code\memoflow_backups"

if not exist "%BACKUP_DIR%" (
    mkdir "%BACKUP_DIR%"
)

for /f "tokens=2 delims==" %%i in ('wmic os get localdatetime /value') do set "datetime=%%i"
set "DATE_STR=%datetime:~0,4%-%datetime:~4,2%-%datetime:~6,2%"
set "TIME_STR=%datetime:~8,2%-%datetime:~10,2%-%datetime:~12,2%"
set "FILE_NAME=%BACKUP_DIR%\memoflow_backup_%DATE_STR%_%TIME_STR%.sql"

:: 记录备份开始日志
echo [%DATE_STR% %TIME_STR%] 开始自动备份... >> "%BACKUP_DIR%\backup_log.txt"

:: 执行导出
call npx wrangler d1 export memoflow-db --remote --output "%FILE_NAME%"

if %ERRORLEVEL% equ 0 (
    echo [%DATE_STR% %TIME_STR%] 备份成功: %FILE_NAME% >> "%BACKUP_DIR%\backup_log.txt"
) else (
    echo [%DATE_STR% %TIME_STR%] 备份失败，请检查网络或授权 >> "%BACKUP_DIR%\backup_log.txt"
)
