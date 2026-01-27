# OpenGrok Code Search Extension

Search and explore OpenGrok code repositories directly in VS Code using GitHub Copilot or compatible chat interfaces.

## For End Users (QA, BA, Non-Developers)

### Installation

1. Download the `.vsix` file from your team
2. Open VS Code
3. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
4. Type: `Extensions: Install from VSIX`
5. Select the downloaded `.vsix` file
6. Reload VS Code when prompted

### Setup (One-Time)

1. **Get Authentication Cookies** (required - cookies expire every ~30 minutes):
   - Open your OpenGrok instance in your browser
   - Log in with your SSO credentials
   - Press `F12` to open DevTools
   - Go to **Application** → **Cookies** → **your-opengrok-domain**
   - Copy session cookie values (typically includes `JSESSIONID`)
   - Format: `cookie_name=VALUE1; another_cookie=VALUE2`

2. **Configure in VS Code**:
   - Press `Ctrl+Shift+P`
   - Type: `OpenGrok: Update Authentication Cookies`
   - Paste your cookie string
   - Click "Reload Now"

### Usage

Ask GitHub Copilot natural questions about code:

```
"Search for 'UserAuthentication' in MyProject"
"How does the authentication flow work?"
"Find all files using AuthContainer"
"Show me the loginView implementation"
```

### When Cookies Expire

You'll see "401 Unauthorized" errors. Just:
1. Get fresh cookies from browser (same steps as setup)
2. Press `Ctrl+Shift+P` → `OpenGrok: Update Authentication Cookies`
3. Paste new cookies and reload

### Helpful Commands

- **Update Cookies**: `OpenGrok: Update Authentication Cookies`
- **Show Instructions**: `OpenGrok: Show Cookie Instructions`
- **Test Connection**: `OpenGrok: Test Connection`

---

## For Developers (Building & Distribution)

### Building the Extension

```bash
# From the extension directory
cd extension
npm install
npm run compile

# Copy the MCP server files
mkdir -p mcp-server
cp -r ../dist mcp-server/
cp -r ../node_modules mcp-server/

# Package the extension
npm run package
```

This creates `opengrok-mcp-extension-1.0.0.vsix`

### Distribution

**Option 1: Share VSIX file directly**
- Send the `.vsix` file to team members
- They install via VS Code: Extensions → Install from VSIX

**Option 2: Internal VS Code Marketplace**
- Upload to your company's private extension marketplace
- Team installs like any other extension

**Option 3: GitHub Releases**
- Create a GitHub release with the `.vsix` file attached
- Team downloads and installs

### Updating

When the MCP server code changes:
1. Build the MCP server: `npm run build` (in root directory)
2. Copy updated files to `extension/mcp-server/`
3. Increment version in `extension/package.json`
4. Rebuild extension: `npm run package`
5. Redistribute new `.vsix` file

---

## Architecture

```
VS Code Extension
    ↓
Manages mcp.json automatically
    ↓
Starts bundled MCP server
    ↓
Server queries OpenGrok
    ↓
Results shown in Copilot chat
```

The extension bundles the MCP server so users don't need to:
- Install Node.js dependencies manually
- Edit mcp.json files
- Run npm build commands

Everything is handled through VS Code's UI!
