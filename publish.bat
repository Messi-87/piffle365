@echo off
REM Hexo 一键发布（Windows 双击运行）
REM 把本文件与 publish.mjs 放在 Hexo 仓库根目录，双击即可发布。
REM 用法：双击 或  publish.bat 文章：我的第一篇
cd /d "%~dp0"
node publish.mjs %*
pause
