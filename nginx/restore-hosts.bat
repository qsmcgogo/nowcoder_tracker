@echo off
echo 恢复原始hosts文件配置
echo.

REM 检查是否以管理员身份运行
net session >nul 2>&1
if %errorLevel% == 0 (
    echo 检测到管理员权限，继续恢复...
) else (
    echo 错误：请以管理员身份运行此脚本
    echo 右键点击此文件，选择"以管理员身份运行"
    pause
    exit /b 1
)

REM 查找最新的备份文件
for /f "delims=" %%i in ('dir /b /o-d C:\Windows\System32\drivers\etc\hosts.backup.* 2^>nul') do (
    set "latest_backup=%%i"
    goto :found
)

:found
if defined latest_backup (
    echo 找到备份文件：%latest_backup%
    echo 恢复hosts文件...
    copy "C:\Windows\System32\drivers\etc\%latest_backup%" C:\Windows\System32\drivers\etc\hosts
    echo 恢复完成！
) else (
    echo 未找到备份文件，无法恢复
)

echo.
pause
