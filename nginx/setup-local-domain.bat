@echo off
echo 设置本地域名访问 qsmcgogo.nowcoder.com
echo.

REM 检查是否以管理员身份运行
net session >nul 2>&1
if %errorLevel% == 0 (
    echo 检测到管理员权限，继续配置...
) else (
    echo 错误：请以管理员身份运行此脚本
    echo 右键点击此文件，选择"以管理员身份运行"
    pause
    exit /b 1
)

REM 备份原始hosts文件
echo 备份原始hosts文件...
copy C:\Windows\System32\drivers\etc\hosts C:\Windows\System32\drivers\etc\hosts.backup.%date:~0,4%%date:~5,2%%date:~8,2%

REM 添加域名解析
echo 添加域名解析...
echo 127.0.0.1 qsmcgogo.nowcoder.com >> C:\Windows\System32\drivers\etc\hosts

echo.
echo 配置完成！
echo.
echo 现在你可以通过以下地址访问应用：
echo   http://qsmcgogo.nowcoder.com:8000
echo   http://localhost:8000
echo.
echo 注意：需要先启动Node.js服务器
echo   node simple-server.js
echo.
echo 要恢复原始配置，请运行：
echo   restore-hosts.bat
echo.
pause
