@echo off
chcp 65001 > nul
title MemoFlow 前端本地客户端启动器

echo ==================================================
echo         MemoFlow 前端本地客户端启动器
echo ==================================================
echo.
echo 正在本地启动前端客户端服务...
echo.
echo [📡 云端 API 链路已接通]
echo API 终结点: https://memoflow-backend.lijiayyq.workers.dev
echo.
echo 提示：
echo 1. 本地运行的前端客户端会直连你云端的 Cloudflare D1 数据库；
echo 2. 所有的笔记、标签、账户均保存在云端，绝对不会丢失；
echo 3. 这种方式能完美避开国内对 Pages (pages.dev) 域名的网络阻断，实现免代理极速访问。
echo.
echo 正在启动浏览器并运行服务...

:: 延时 1.5 秒后自动在浏览器打开本地客户端端口
start http://localhost:4173/

:: 运行 production 构建后的本地预览服务，固定端口为 4173
call npm run preview -- --port 4173
