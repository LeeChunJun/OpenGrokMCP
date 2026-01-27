# OpenGrok MCP Server for VS Code

Query and explore code repositories in OpenGrok directly from VS Code using GitHub Copilot and the Model Context Protocol (MCP).

## Authentication Context

OpenGrok typically requires OAuth/SSO authentication. Since MCP doesn't directly support OAuth flows, this server uses session cookies for authentication. OpenGrok sessions typically expire after ~30 minutes of inactivity, requiring periodic token refresh. This MCP server manages that authentication - you configure cookies once during setup, and the server handles session management. When cookies expire, simply update them in your configuration and reload VS Code.

---

## 🚀 Installation & Setup

### Method 1: VSIX Installation (Quick Setup)

**Step 1: Install the Extension**

Download the pre-built extension package:
- Download: [`opengrok-mcp-extension-1.0.5.vsix`](./extension/opengrok-mcp-extension-1.0.5.vsix)

Installation:
1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Click "Install from VSIX..."
4. Select the downloaded `.vsix` file
5. Reload VS Code (Ctrl+Shift+P → "Developer: Reload Window")

**Step 2: Configure Authentication Cookies**

1. Press `Ctrl+Shift+P`
2. Type "OpenGrok: Update Authentication Cookies"
3. Paste your OpenGrok session cookies when prompted
4. VS Code reloads automatically

To get cookies, see [Getting Authentication Cookies](#getting-authentication-cookies).

---

### Method 2: Manual MCP Configuration

**Step 1: Build the MCP Server**

```bash
# Clone repository
git clone https://github.com/sumanthreddyy/OpenGrokMCP.git
cd openGrok-MCP

# Install dependencies and build
npm install
npm run build
```

**Step 2: Update VS Code MCP Configuration**

Edit `%APPDATA%\Code\User\mcp.json`:

```json
{
  "mcpServers": {
    "opengrok": {
      "command": "node",
      "args": ["C:/path/to/openGrok-MCP/dist/index.js"],
      "env": {
        "OPENGROK_URL": "http://your-opengrok-instance.com/source",
        "OPENGROK_USE_OAUTH": "true",
        "OPENGROK_COOKIES": "session_cookie=YOUR_SESSION_ID; JSESSIONID=YOUR_SESSION_ID"
      }
    }
  }
}
```

Replace:
- `C:/path/to/openGrok-MCP/dist/index.js` with your actual path to the built server
- Cookie values with your copied session cookies

**Step 3: Reload VS Code**

Press `Ctrl+Shift+P` → "Developer: Reload Window"

---

### Method 3: Build and Package as VSIX

If you want to build the extension package yourself from source:

**Prerequisites:**
- Node.js 18+
- npm

**Steps:**

```bash
# Build MCP server
npm install
npm run build

# Build extension
cd extension
npm install
npm run compile

# Create distributable package
npm run package
```

Result: `extension/opengrok-mcp-extension-1.0.5.vsix`

You can then share this `.vsix` file with others, or they can install it using Method 1 above.

---

## Getting Authentication Cookies

1. Open your OpenGrok instance in a browser (e.g., `http://your-opengrok-instance.com/source`)
2. Log in with your credentials (if authentication is required)
3. Press `F12` to open Developer Tools
4. Go to **Application** tab → **Cookies** → Select your OpenGrok domain
5. Copy the relevant session cookies (typically includes session identifiers like `JSESSIONID`)
   - Format: `cookie_name=value; another_cookie=value`

---

## Usage

After setup (using any of the three methods above), use these tools through GitHub Copilot:

---

### `opengrok_search`
Search for code by keyword across projects

**Example:** "Search for 'authentication' in MyProject"

- Finds matching files with line numbers and snippets
- Returns top results with context
- Case-insensitive by default

### `opengrok_get_file`
View complete source code of a file

**Example:** "Show me the UserAuthentication.java file"

- Returns full file content with line numbers
- Works with paths from search results
- Supports multiple programming languages

### `opengrok_list_projects`
Browse all available projects in OpenGrok

**Example:** "List all available projects"

- Shows all indexed projects in your OpenGrok instance
- Use project names in search queries
- Project names are case-sensitive (e.g., `MyProject`, not `myproject`)

### `opengrok_xref`
Find all references to a symbol (function, class, variable)

**Example:** "Find all uses of PaymentProcessor class"

- Shows files that reference the symbol
- Includes line numbers and context
- Useful for understanding code impact

---

## Troubleshooting

### "401 Unauthorized" Error
**Cause:** Your cookies have expired (typically after ~30 minutes of inactivity)

**Fix:**
1. Get fresh cookies (repeat the steps in [Getting Authentication Cookies](#getting-authentication-cookies))
2. Update your configuration with the new cookie values
3. Reload VS Code

### "Cannot find project"
**Cause:** Project name is wrong or doesn't exist

**Fix:**
- Ask Copilot: "List all available projects"
- Project names are case-sensitive (e.g., `MyProject`, not `myproject`)

### Search returns no results
**Possible causes:**
- Cookies are invalid/expired → Get fresh cookies
- Project name is incorrect → Check spelling with list_projects
- No matches exist → Try simpler search terms

### "Extension not found" after install
**Fix:**
- Close VS Code completely
- Reopen VS Code
- Extension should now appear in the Extensions panel

---

## Building from Source

If you want to customize the extension or contribute to development:

### Prerequisites
- Node.js 18+
- npm

### Build Steps

**Windows (Batch file - easiest):**
```powershell
.\build-extension.bat
```

**Windows (PowerShell):**
```powershell
.\build-extension.ps1
```

**Manual Build (Any OS):**
```bash
# 1. Build MCP server
npm install
npm run build

# 2. Build extension
cd extension
npm install
npm run compile

# 3. Create distributable package
npm run package
```

### Output

Creates: `extension/opengrok-mcp-extension-1.0.5.vsix`

Share this file with others, or they can download it from the repository.

---

## Project Structure

```
openGrok-MCP/
├── src/                          # MCP Server source code
│   ├── index.ts                  # Server entry point, tool definitions
│   ├── opengrok-client.ts        # OpenGrok API wrapper
│   ├── auth.ts                   # Authentication/cookie handling
│   └── config.ts                 # Configuration loader
│
├── extension/                     # VS Code Extension
│   ├── src/
│   │   └── extension.ts          # Extension activation, UI commands
│   ├── package.json              # Extension manifest
│   ├── tsconfig.json             # TypeScript config
│   └── out/                       # Compiled extension (generated)
│
├── dist/                          # Compiled MCP server (generated)
├── build-extension.bat            # Windows batch build script
├── build-extension.ps1            # PowerShell build script
├── package.json                   # Root package configuration
├── tsconfig.json                  # Root TypeScript configuration
└── README.md                      # This file
```

---

## How It Works

### Architecture

The MCP server follows a **dumb server, smart LLM** design:

1. **Server provides tools** - Basic search, file fetch, list projects
2. **LLM decides workflow** - Copilot determines what to search and fetch
3. **User asks questions** - Natural language queries like "Show me the payment processor"

### Workflow Example

```
User: "How does authentication work in MyProject?"

1. Copilot uses opengrok_search
   → Finds files containing "authentication"
   → Gets snippets and line numbers

2. Copilot reviews and selects relevant files
   → Identifies: handler, processor, data structure files

3. Copilot uses opengrok_get_file
   → Fetches complete source code for each file

4. Copilot analyzes and explains
   → Explains the flow: validation → JSON building → API call
```

### OpenGrok Details

OpenGrok is a fast code search engine that:
- Indexes multiple projects and repositories
- Provides full-text search
- Tracks cross-references (xref)
- Requires OAuth/SSO authentication

This MCP server wraps OpenGrok's API and returns results to Copilot for intelligent analysis.

---

## Configuration Reference

### Environment Variables

When using manual configuration (mcp.json):

| Variable | Required | Example |
|----------|----------|---------|
| `OPENGROK_URL` | Yes | `http://your-opengrok-instance.com/source` |
| `OPENGROK_USE_OAUTH` | Yes | `true` |
| `OPENGROK_COOKIES` | Yes | `session_cookie=...; JSESSIONID=...` |

### Cookie Lifecycle

- **Duration:** ~30 minutes of inactivity
- **When to refresh:** When you see 401 errors
- **How to get:** See [Getting Authentication Cookies](#getting-authentication-cookies)
- **Required cookies:** Session cookies (e.g., `JSESSIONID`)

---

## Tips & Tricks

### Effective Searching
- Use specific terms: "PaymentGateway" vs "payment"
- Quote phrases: `"boarding pass"` 
- Combine terms: `"user AND authentication"`

### Popular Projects
- Your OpenGrok projects will be listed here
- Ask Copilot to list all with: "List all available projects"

### Understanding Results
- Search returns snippets (first ~100 chars of matches)
- Use `opengrok_get_file` for complete context
- Copilot auto-fetches relevant files based on snippet content

---

## Contributing

Found a bug or want to contribute? 

- **Report issues:** Open an issue on GitHub
- **Contribute code:** Submit a pull request with improvements
- **Share feedback:** Tell us what features would help

---

## Support

### For Users
If the extension isn't working:
1. Check [Prerequisites](#prerequisites) - Do you have fresh cookies?
2. Review [Troubleshooting](#troubleshooting) - Most issues are cookie-related
3. Test connection: Press Ctrl+Shift+P → "OpenGrok: Test Connection"
4. Check VS Code logs: View Output → Extension Host

### For Developers
If you're building from source:
- See [Building from Source](#building-from-source)
- Check [Project Structure](#project-structure)
- Review source code comments for implementation details

---

## License

MIT - See LICENSE file for details

---

## Version

**Current:** 1.0.5  
**Last Updated:** January 2026  
**Repository:** https://github.com/sumanthreddyy/OpenGrokMCP
