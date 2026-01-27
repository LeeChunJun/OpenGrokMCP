import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
    console.log('OpenGrok MCP Extension is now active');

    // Register the MCP server with VS Code
    registerMcpServer(context);

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('opengrokMcp.updateCookies', updateCookies)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('opengrokMcp.showCookieInstructions', showCookieInstructions)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('opengrokMcp.testConnection', testConnection)
    );

    // Check if cookies are configured on startup
    const config = vscode.workspace.getConfiguration('opengrokMcp');
    const cookies = config.get<string>('cookies');
    
    if (!cookies || cookies.trim() === '') {
        vscode.window.showInformationMessage(
            'OpenGrok: Please configure authentication cookies',
            'Configure Now'
        ).then((selection: string | undefined) => {
            if (selection === 'Configure Now') {
                vscode.commands.executeCommand('opengrokMcp.updateCookies');
            }
        });
    }

    // Watch for configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e: vscode.ConfigurationChangeEvent) => {
            if (e.affectsConfiguration('opengrokMcp')) {
                vscode.window.showInformationMessage(
                    'OpenGrok configuration changed. Reload window to apply changes.',
                    'Reload Now'
                ).then((selection: string | undefined) => {
                    if (selection === 'Reload Now') {
                        vscode.commands.executeCommand('workbench.action.reloadWindow');
                    }
                });
            }
        })
    );
}

function registerMcpServer(context: vscode.ExtensionContext) {
    const config = vscode.workspace.getConfiguration('opengrokMcp');
    const mcpConfigPath = getMcpConfigPath();
    
    // Path to the bundled MCP server
    const mcpServerPath = path.join(context.extensionPath, 'mcp-server', 'dist', 'index.js');
    
    if (!fs.existsSync(mcpServerPath)) {
        vscode.window.showErrorMessage('OpenGrok MCP server files not found. Please reinstall the extension.');
        return;
    }

    // Read or create mcp.json
    let mcpConfig: any = { servers: {} };
    
    if (fs.existsSync(mcpConfigPath)) {
        try {
            const content = fs.readFileSync(mcpConfigPath, 'utf-8');
            mcpConfig = JSON.parse(content);
        } catch (e) {
            console.error('Failed to parse mcp.json', e);
        }
    }

    // Update the opengrok server configuration
    const url = config.get<string>('url') || 'http://localhost:8080/source';
    const cookies = config.get<string>('cookies') || '';

    // Use the current Node.js executable that's running VS Code
    const nodeExecutable = process.execPath;

    mcpConfig.servers = mcpConfig.servers || {};
    mcpConfig.servers.opengrok = {
        command: nodeExecutable,
        args: [mcpServerPath],
        env: {
            OPENGROK_URL: url,
            OPENGROK_USE_OAUTH: 'true',
            OPENGROK_COOKIES: cookies
        }
    };

    // Write back to mcp.json
    try {
        const dir = path.dirname(mcpConfigPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2));
        console.log('MCP configuration updated successfully');
    } catch (e) {
        vscode.window.showErrorMessage(`Failed to update MCP configuration: ${e}`);
    }
}

function getMcpConfigPath(): string {
    const platform = process.platform;
    const home = process.env.HOME || process.env.USERPROFILE;
    
    if (platform === 'win32') {
        return path.join(process.env.APPDATA || '', 'Code', 'User', 'mcp.json');
    } else if (platform === 'darwin') {
        return path.join(home || '', 'Library', 'Application Support', 'Code', 'User', 'mcp.json');
    } else {
        return path.join(home || '', '.config', 'Code', 'User', 'mcp.json');
    }
}

async function updateCookies() {
    const currentConfig = vscode.workspace.getConfiguration('opengrokMcp');
    const currentCookies = currentConfig.get<string>('cookies') || '';

    const cookies = await vscode.window.showInputBox({
        prompt: 'Paste your OpenGrok authentication cookies',
        placeHolder: 'session_cookie=...; JSESSIONID=...',
        value: currentCookies,
        ignoreFocusOut: true,
        validateInput: (value: string) => {
            if (!value || value.trim() === '') {
                return 'Cookies cannot be empty';
            }
            if (!value.includes('JSESSIONID')) {
                return 'Cookies must include JSESSIONID';
            }
            return null;
        }
    });

    if (cookies) {
        await currentConfig.update('cookies', cookies, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(
            'OpenGrok cookies updated successfully! Reload window to apply changes.',
            'Reload Now',
            'Show Instructions'
        ).then((selection: string | undefined) => {
            if (selection === 'Reload Now') {
                vscode.commands.executeCommand('workbench.action.reloadWindow');
            } else if (selection === 'Show Instructions') {
                showCookieInstructions();
            }
        });
    }
}

function showCookieInstructions() {
    const panel = vscode.window.createWebviewPanel(
        'opengrokCookies',
        'How to Get OpenGrok Cookies',
        vscode.ViewColumn.One,
        {}
    );

    panel.webview.html = getInstructionsHtml();
}

function getInstructionsHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OpenGrok Cookie Instructions</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            line-height: 1.6;
        }
        h1 {
            color: var(--vscode-foreground);
        }
        ol {
            padding-left: 20px;
        }
        li {
            margin: 10px 0;
        }
        code {
            background: var(--vscode-textCodeBlock-background);
            padding: 2px 6px;
            border-radius: 3px;
        }
        .warning {
            background: var(--vscode-inputValidation-warningBackground);
            border-left: 4px solid var(--vscode-inputValidation-warningBorder);
            padding: 10px;
            margin: 20px 0;
        }
        .step {
            background: var(--vscode-editor-background);
            padding: 15px;
            margin: 10px 0;
            border-radius: 5px;
        }
    </style>
</head>
<body>
    <h1>🔐 How to Get OpenGrok Authentication Cookies</h1>
    
    <div class="warning">
        ⚠️ <strong>Important:</strong> Cookies expire after ~30 minutes of inactivity. 
        You'll need to refresh them when you see "401 Unauthorized" errors.
    </div>

    <div class="step">
        <h2>Step 1: Open OpenGrok</h2>
        <ol>
            <li>Open your OpenGrok instance in your browser (e.g., <code>http://your-opengrok-instance.com/source</code>)</li>
            <li>Log in with your SSO credentials</li>
        </ol>
    </div>

    <div class="step">
        <h2>Step 2: Open Developer Tools</h2>
        <ol>
            <li>Press <code>F12</code> to open DevTools</li>
            <li>Go to the <strong>Application</strong> tab (or <strong>Storage</strong> in Firefox)</li>
            <li>In the left sidebar, expand <strong>Cookies</strong></li>
            <li>Click on <code>your-opengrok-domain</code></li>
        </ol>
    </div>

    <div class="step">
        <h2>Step 3: Copy Cookie Values</h2>
        <p>You need to copy TWO cookies:</p>
        <ol>
            <li>Find your session cookies (e.g., <code>JSESSIONID</code>) - copy their values</li>
            <li>Find <code>JSESSIONID</code> - copy its value</li>
            <li>Combine them like this:<br>
                <code>session_cookie=VALUE_HERE; JSESSIONID=VALUE_HERE</code>
            </li>
        </ol>
    </div>

    <div class="step">
        <h2>Step 4: Update in VS Code</h2>
        <ol>
            <li>Press <code>Ctrl+Shift+P</code> (or <code>Cmd+Shift+P</code> on Mac)</li>
            <li>Type: <code>OpenGrok: Update Authentication Cookies</code></li>
            <li>Paste your cookie string</li>
            <li>Click "Reload Now" to apply changes</li>
        </ol>
    </div>

    <h2>✅ You're Done!</h2>
    <p>You can now search OpenGrok code directly in VS Code chat!</p>
    <p>Try asking: <em>"Search for 'UserAuthentication' in the MyProject project"</em></p>
</body>
</html>`;
}

async function testConnection() {
    const config = vscode.workspace.getConfiguration('opengrokMcp');
    const cookies = config.get<string>('cookies');

    if (!cookies || cookies.trim() === '') {
        vscode.window.showWarningMessage(
            'No cookies configured. Please update cookies first.',
            'Configure Cookies'
        ).then((selection: string | undefined) => {
            if (selection === 'Configure Cookies') {
                vscode.commands.executeCommand('opengrokMcp.updateCookies');
            }
        });
        return;
    }

    vscode.window.showInformationMessage(
        'Testing OpenGrok connection...',
        'Show Instructions'
    ).then((selection: string | undefined) => {
        if (selection === 'Show Instructions') {
            showCookieInstructions();
        }
    });

    // Test by asking Copilot to list projects
    vscode.window.showInformationMessage(
        'Try asking Copilot: "List all OpenGrok projects"'
    );
}

export function deactivate() {}
