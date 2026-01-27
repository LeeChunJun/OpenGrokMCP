# Building the OpenGrok VS Code Extension

## Quick Build Script

```bash
#!/bin/bash
# build-extension.sh

echo "🏗️  Building OpenGrok MCP Extension..."

# Step 1: Build the MCP server
echo "📦 Building MCP server..."
cd "$(dirname "$0")"
npm install
npm run build

# Step 2: Prepare extension directory
echo "📂 Preparing extension files..."
cd extension
npm install

# Step 3: Copy MCP server to extension
echo "📋 Copying MCP server files..."
rm -rf mcp-server
mkdir -p mcp-server

# Copy dist files
cp -r ../dist mcp-server/

# Copy only production node_modules
cp -r ../node_modules mcp-server/

# Copy package.json for reference
cp ../package.json mcp-server/

# Step 4: Compile extension
echo "🔨 Compiling extension TypeScript..."
npm run compile

# Step 5: Package extension
echo "📦 Creating VSIX package..."
npm run package

echo "✅ Done! Extension package created:"
echo "   📄 extension/opengrok-mcp-extension-1.0.0.vsix"
echo ""
echo "📤 Distribution:"
echo "   1. Share this .vsix file with your team"
echo "   2. Install via: Extensions → Install from VSIX"
```

## Manual Build Steps

### 1. Build MCP Server

```bash
cd openGrok-MCP
npm install
npm run build
```

### 2. Setup Extension

```bash
cd extension
npm install
```

### 3. Bundle MCP Server

```bash
# From extension directory
mkdir -p mcp-server
cp -r ../dist mcp-server/
cp -r ../node_modules mcp-server/
cp ../package.json mcp-server/
```

### 4. Build Extension

```bash
# Compile TypeScript
npm run compile

# Package as VSIX
npm run package
```

The output will be: `opengrok-mcp-extension-1.0.0.vsix`

## Testing Before Distribution

1. **Install locally**:
   ```bash
   code --install-extension opengrok-mcp-extension-1.0.0.vsix
   ```

2. **Configure cookies**:
   - Ctrl+Shift+P → "OpenGrok: Update Authentication Cookies"
   - Paste valid cookies

3. **Test search**:
   - Open Copilot chat
   - Ask: "Search for 'authentication' in MyProject"

4. **Verify**:
   - Check results appear
   - Verify file fetching works
   - Test with expired cookies (should show friendly error)

## Distribution Checklist

- [ ] Version number updated in `package.json`
- [ ] MCP server built successfully
- [ ] Extension compiles without errors
- [ ] VSIX package created
- [ ] Tested locally with fresh install
- [ ] README instructions verified
- [ ] Cookie instructions tested by non-dev

## Sharing with Team

### Email Template

```
Subject: OpenGrok VS Code Extension - Easy Code Search

Hi team,

I've packaged our OpenGrok code search as a VS Code extension!

Installation (5 minutes):
1. Download attached: opengrok-mcp-extension-1.0.0.vsix
2. In VS Code: Ctrl+Shift+P → "Extensions: Install from VSIX"
3. Select the downloaded file
4. Reload VS Code

Setup:
1. Ctrl+Shift+P → "OpenGrok: Update Authentication Cookies"
2. Follow the instructions shown
3. Paste your cookies and reload

Usage:
Ask Copilot questions like:
- "Search for 'UserAuthentication' in MyProject"
- "How does the payment flow work?"
- "Find all uses of AuthenticationService"

Need help? Run: "OpenGrok: Show Cookie Instructions"

Questions? Let me know!
```

### SharePoint/Confluence Page

Create a quick guide with:
- Download link for `.vsix` file
- Installation steps with screenshots
- Cookie setup walkthrough
- Example queries
- Troubleshooting (cookie expiration)

## Updating the Extension

When MCP server code changes:

```bash
# 1. Update version
cd extension
# Edit package.json - increment version

# 2. Rebuild everything
cd ..
npm run build
cd extension
rm -rf mcp-server
# ... repeat bundle steps above
npm run package

# 3. Distribute new version
# Share new .vsix file with team
```

## Troubleshooting Build Issues

### "Cannot find module"
```bash
cd extension
rm -rf node_modules
npm install
```

### "vsce not found"
```bash
npm install -g @vscode/vsce
# OR
npm install --save-dev @vscode/vsce
```

### "Permission denied"
```bash
# Windows: Run terminal as Administrator
# Mac/Linux: Check file permissions
chmod +x build-extension.sh
```

### Extension doesn't work after install
- Check `mcp-server/dist/index.js` exists in the package
- Verify node_modules were copied
- Check VS Code Output → Extension Host for errors

## Size Optimization (Optional)

If `.vsix` is too large (>50MB):

```bash
# Use production-only dependencies
cd extension/mcp-server
rm -rf node_modules
npm install --production
```

Remove dev dependencies from bundled node_modules to reduce size.
