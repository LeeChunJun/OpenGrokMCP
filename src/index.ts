#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

import { OpenGrokClient } from './opengrok-client.js';
import { getConfig } from './config.js';
import { OpenGrokAuth } from './auth.js';

// Initialize configuration and client
const config = getConfig();
let openGrokClient: OpenGrokClient;
let authHandler: OpenGrokAuth | undefined;

// Initialize authentication (non-blocking)
async function initializeClientAsync() {
  try {
    if (config.useOAuth || (!config.username && !config.password)) {
      console.error('Using OAuth/SSO authentication...');
      authHandler = new OpenGrokAuth({
        baseUrl: config.baseUrl,
        cookieString: config.cookieString,
      });

      // Check if already authenticated
      const isAuth = await authHandler.isAuthenticated();
      if (!isAuth && !config.cookieString) {
        console.error('⚠️  Not authenticated. Please do the following:');
        console.error('');
        console.error('1. Visit: ' + config.baseUrl);
        console.error('2. Log in with your SSO credentials');
        console.error('3. Open Developer Tools (F12) → Application → Cookies');
        console.error('4. Copy the cookie value (look for JSESSIONID or session cookie)');
        console.error('5. Set environment variable:');
        console.error('   export OPENGROK_COOKIES="<paste-cookie-value-here>"');
        console.error('6. Restart VS Code');
        console.error('');
      } else if (isAuth) {
        console.error('✓ Successfully authenticated with OAuth/SSO');
      }

      openGrokClient = new OpenGrokClient(
        config.baseUrl,
        authHandler.getCookieJar()
      );
    } else {
      console.error('Using basic authentication...');
      openGrokClient = new OpenGrokClient(
        config.baseUrl,
        undefined,
        config.username,
        config.password
      );
    }
  } catch (error) {
    console.error('Failed to initialize client:', error);
    // Create a client anyway so server can start
    openGrokClient = new OpenGrokClient(config.baseUrl);
  }
}

// Define MCP tools
const tools: Tool[] = [
  {
    name: 'opengrok_search',
    description: 'Search for code in OpenGrok with different search modes. Returns file paths, line numbers, and code snippets.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query string',
        },
        project: {
          type: 'string',
          description: 'Project to search in (REQUIRED). Use opengrok_list_projects to see available projects.',
        },
        searchType: {
          type: 'string',
          enum: ['full', 'defs', 'refs', 'path', 'hist'],
          description: 'Type of search: full=full-text, defs=definitions, refs=symbol references, path=file paths, hist=git history',
          default: 'full',
        },
        language: {
          type: 'string',
          description: 'Filter by language (e.g., java, cxx, python, js, cpp, c, go, rust, etc.). Leave empty for all languages.',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results to return (default: 50)',
          default: 50,
        },
      },
      required: ['query', 'project'],
    },
  },
  {
    name: 'opengrok_get_file',
    description: 'Get the content of a specific file from OpenGrok. IMPORTANT: Use the full path from search results directly (e.g., "ProjectName/path/to/file"). Omit the project parameter - it typically causes 404 errors.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Full file path including project name from search results (e.g., ProjectName/src/main/file.java). The path should already contain the project prefix.',
        },
        project: {
          type: 'string',
          description: 'Project name (DEPRECATED - omit this. Only use if path does not include project prefix and file still cannot be found.)',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'opengrok_xref',
    description: 'Find cross-references for a symbol (definitions and usages).',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Symbol name to find references for',
        },
        project: {
          type: 'string',
          description: 'Project name (optional)',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'opengrok_list_projects',
    description: 'List all available projects in OpenGrok.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// Create MCP server
const server = new Server(
  {
    name: 'opengrok-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tool list requests
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool execution requests
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'opengrok_search': {
        const { query, project, searchType = 'full', language, maxResults = 50 } = args as {
          query: string;
          project?: string;
          searchType?: 'full' | 'defs' | 'refs' | 'path' | 'hist';
          language?: string;
          maxResults?: number;
        };

        if (!project || project.trim() === '') {
          throw new Error('Project parameter is required. Use opengrok_list_projects to see available projects.');
        }

        const results = await openGrokClient.search(
          query,
          project,
          searchType,
          language,
          maxResults
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      }

      case 'opengrok_get_file': {
        const { path, project } = args as {
          path: string;
          project?: string;
        };

        const fileContent = await openGrokClient.getFileContent(
          path,
          project || config.defaultProject
        );

        return {
          content: [
            {
              type: 'text',
              text: fileContent.content,
            },
          ],
        };
      }

      case 'opengrok_xref': {
        const { symbol, project } = args as {
          symbol: string;
          project?: string;
        };

        const refs = await openGrokClient.getCrossReferences(
          symbol,
          project || config.defaultProject
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(refs, null, 2),
            },
          ],
        };
      }

      case 'opengrok_list_projects': {
        const projects = await openGrokClient.listProjects();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(projects, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  // Initialize authentication and client (non-blocking)
  await initializeClientAsync();

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('OpenGrok MCP Server running on stdio');
  console.error(`Connected to: ${config.baseUrl}`);
  if (config.defaultProject) {
    console.error(`Default project: ${config.defaultProject}`);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
