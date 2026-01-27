# PowerShell Build Script for OpenGrok Extension
# Run this from the openGrok-MCP directory

Write-Host "🏗️  Building OpenGrok MCP Extension..." -ForegroundColor Cyan

# Step 1: Build the MCP server
Write-Host "`n📦 Building MCP server..." -ForegroundColor Yellow
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Error: Must run from openGrok-MCP root directory" -ForegroundColor Red
    exit 1
}

npm install
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ MCP server build failed" -ForegroundColor Red
    exit 1
}

# Step 2: Prepare extension directory
Write-Host "`n📂 Preparing extension files..." -ForegroundColor Yellow
Set-Location extension
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Extension dependencies install failed" -ForegroundColor Red
    exit 1
}

# Step 3: Copy MCP server to extension
Write-Host "`n📋 Copying MCP server files..." -ForegroundColor Yellow
if (Test-Path "mcp-server") {
    Remove-Item -Recurse -Force "mcp-server"
}
New-Item -ItemType Directory -Path "mcp-server" | Out-Null

# Copy dist files
Copy-Item -Recurse "..\dist" "mcp-server\"

# Copy production node_modules
Copy-Item -Recurse "..\node_modules" "mcp-server\"

# Copy package.json
Copy-Item "..\package.json" "mcp-server\"

Write-Host "✅ MCP server files copied" -ForegroundColor Green

# Step 4: Compile extension
Write-Host "`n🔨 Compiling extension TypeScript..." -ForegroundColor Yellow
npm run compile

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Extension compilation failed" -ForegroundColor Red
    exit 1
}

# Step 5: Package extension
Write-Host "`n📦 Creating VSIX package..." -ForegroundColor Yellow
npm run package

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Extension packaging failed" -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ Done! Extension package created:" -ForegroundColor Green
Get-ChildItem "*.vsix" | ForEach-Object {
    Write-Host "   📄 $($_.Name)" -ForegroundColor Cyan
}

Write-Host "`n📤 Distribution:" -ForegroundColor Yellow
Write-Host "   1. Share the .vsix file with your team"
Write-Host "   2. Install via: Extensions → Install from VSIX"
Write-Host "   3. Or email using template in BUILD_EXTENSION.md"

# Return to original directory
Set-Location ..
