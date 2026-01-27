@echo off
REM Quick build script for Windows
REM Double-click this file to build the extension

echo.
echo ============================================
echo   Building OpenGrok VS Code Extension
echo ============================================
echo.

REM Check if we're in the right directory
if not exist "package.json" (
    echo ERROR: Please run this from the openGrok-MCP directory
    pause
    exit /b 1
)

echo Step 1: Building MCP server...
call npm install
call npm run build
if errorlevel 1 (
    echo ERROR: MCP server build failed!
    pause
    exit /b 1
)

echo.
echo Step 2: Installing extension dependencies...
cd extension
call npm install
if errorlevel 1 (
    echo ERROR: Extension dependencies install failed!
    pause
    exit /b 1
)

echo.
echo Step 3: Copying MCP server files...
if exist "mcp-server" rmdir /s /q mcp-server
mkdir mcp-server
xcopy /s /y ..\dist mcp-server\dist\
xcopy /s /y ..\node_modules mcp-server\node_modules\
copy ..\package.json mcp-server\

echo.
echo Step 4: Compiling extension...
call npm run compile
if errorlevel 1 (
    echo ERROR: Extension compilation failed!
    pause
    exit /b 1
)

echo.
echo Step 5: Packaging extension...
call npm run package
if errorlevel 1 (
    echo ERROR: Extension packaging failed!
    pause
    exit /b 1
)

echo.
echo ============================================
echo   SUCCESS! Extension built successfully!
echo ============================================
echo.
echo The .vsix file is in the extension folder.
echo Share this file with your team!
echo.

cd ..
dir extension\*.vsix

echo.
pause
