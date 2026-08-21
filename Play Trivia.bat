@echo off
rem ---------------------------------------------------------------------------
rem  Sovereign - double-click launcher.
rem
rem  Opens index.html in whatever browser Windows has set as the default. The
rem  game runs straight off the file:// protocol, so there is nothing to
rem  install, no server to start, and no internet needed.
rem
rem  The path comes from this script own folder, not from the current
rem  directory, because a double-click does not guarantee what the current
rem  directory will be. It is held in a quoted variable the whole way through,
rem  so spaces and an ampersand in a parent folder name stay literal and are
rem  never read as a command separator. This repo lives under a folder with
rem  both, so that is not hypothetical.
rem
rem  This file must stay plain ASCII with CRLF line endings. cmd.exe
rem  mis-parses a batch file that mixes multi-byte characters with bare LF.
rem
rem  The window closes on its own: START hands the file to the shell and
rem  returns at once.
rem ---------------------------------------------------------------------------

setlocal
set "PAGE=%~dp0index.html"

if not exist "%PAGE%" goto missing

start "" "%PAGE%"
exit /b 0

:missing
echo.
echo   Sovereign could not find index.html.
echo.
echo   Looked for: "%PAGE%"
echo   Keep "Play Trivia.bat" in the same folder as index.html.
echo.
pause
exit /b 1
