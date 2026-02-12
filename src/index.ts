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

// Define MCP tools based on OpenGrok REST API
const tools: Tool[] = [
  {
    name: 'opengrok_search',
    description: 'Search for code in OpenGrok with different search modes using the REST API. Returns file paths, line numbers, and code snippets.',
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
    description: 'Get the content of a specific file from OpenGrok using the REST API.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path relative to source root (e.g., path/to/file.java).',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'opengrok_xref',
    description: 'Find cross-references for a symbol (definitions and usages) using the search API.',
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
    description: 'List all available projects in OpenGrok via the REST API.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'opengrok_get_annotation',
    description: 'Get annotation information for a specific file including revision, author, and description.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path relative to source root (e.g., path/to/file.java)',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'opengrok_get_directory_listing',
    description: 'Get directory entries including file/directory metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Directory path relative to source root (e.g., path/to/dir/)',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'opengrok_get_history',
    description: 'Get history entries for a file or directory.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File or directory path relative to source root (e.g., path/to/file.java)',
        },
        withFiles: {
          type: 'boolean',
          description: 'Whether to include list of files in the response',
        },
        start: {
          type: 'number',
          description: 'Start index for pagination',
        },
        max: {
          type: 'number',
          description: 'Maximum number of entries to return',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'opengrok_get_file_definitions',
    description: 'Get definitions from a specific file including types, signatures, and line information.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path relative to source root (e.g., path/to/file.java)',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'opengrok_get_file_genre',
    description: 'Get the detected genre of a file (e.g., PLAIN, XREFABLE, IMAGE, DATA, HTML).',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path relative to source root (e.g., path/to/file.java)',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'opengrok_ping',
    description: 'Check if the OpenGrok web application is alive.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'opengrok_get_indexed_projects',
    description: 'Get list of projects that are currently indexed.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'opengrok_get_project_repositories',
    description: 'Get list of repositories for a specific project.',
    inputSchema: {
      type: 'object',
      properties: {
        project: {
          type: 'string',
          description: 'Project name',
        },
      },
      required: ['project'],
    },
  },
  {
    name: 'opengrok_get_project_repository_types',
    description: 'Get types of repositories for a specific project.',
    inputSchema: {
      type: 'object',
      properties: {
        project: {
          type: 'string',
          description: 'Project name',
        },
      },
      required: ['project'],
    },
  },
  {
    name: 'opengrok_get_project_indexed_files',
    description: 'Get list of files tracked by the index database for a specific project.',
    inputSchema: {
      type: 'object',
      properties: {
        project: {
          type: 'string',
          description: 'Project name',
        },
      },
      required: ['project'],
    },
  },
  {
    name: 'opengrok_get_last_index_time',
    description: 'Get the last time the index was updated (in ISO 8601 format).',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'opengrok_get_version',
    description: 'Get the version of the OpenGrok web application.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'opengrok_get_suggestions',
    description: 'Get code completion suggestions based on the query.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query for suggestions',
        },
        project: {
          type: 'string',
          description: 'Project name (optional)',
        },
        field: {
          type: 'string',
          description: 'Field to search in (defs, path, hist, refs, type, full). Default is "full".',
          enum: ['defs', 'path', 'hist', 'refs', 'type', 'full'],
        },
      },
      required: ['query'],
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
        const { path } = args as {
          path: string;
        };

        const fileContent = await openGrokClient.getFileContent(path);

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

      case 'opengrok_get_annotation': {
        const { path } = args as {
          path: string;
        };

        const annotation = await openGrokClient.getAnnotation(path);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(annotation, null, 2),
            },
          ],
        };
      }

      case 'opengrok_get_directory_listing': {
        const { path } = args as {
          path: string;
        };

        const directoryListing = await openGrokClient.getDirectoryListing(path);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(directoryListing, null, 2),
            },
          ],
        };
      }

      case 'opengrok_get_history': {
        const { path, withFiles, start, max } = args as {
          path: string;
          withFiles?: boolean;
          start?: number;
          max?: number;
        };

        const history = await openGrokClient.getHistory(path, withFiles, start, max);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(history, null, 2),
            },
          ],
        };
      }

      case 'opengrok_get_file_definitions': {
        const { path } = args as {
          path: string;
        };

        const definitions = await openGrokClient.getFileDefinitions(path);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(definitions, null, 2),
            },
          ],
        };
      }

      case 'opengrok_get_file_genre': {
        const { path } = args as {
          path: string;
        };

        const genre = await openGrokClient.getFileGenre(path);

        return {
          content: [
            {
              type: 'text',
              text: genre,
            },
          ],
        };
      }

      case 'opengrok_ping': {
        const isAlive = await openGrokClient.ping();

        return {
          content: [
            {
              type: 'text',
              text: `OpenGrok server is ${isAlive ? 'alive' : 'not responding'}`,
            },
          ],
        };
      }

      case 'opengrok_get_indexed_projects': {
        const projects = await openGrokClient.getIndexedProjects();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(projects, null, 2),
            },
          ],
        };
      }

      case 'opengrok_get_project_repositories': {
        const { project } = args as {
          project: string;
        };

        const repositories = await openGrokClient.getProjectRepositories(project);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(repositories, null, 2),
            },
          ],
        };
      }

      case 'opengrok_get_project_repository_types': {
        const { project } = args as {
          project: string;
        };

        const repositoryTypes = await openGrokClient.getProjectRepositoryTypes(project);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(repositoryTypes, null, 2),
            },
          ],
        };
      }

      case 'opengrok_get_project_indexed_files': {
        const { project } = args as {
          project: string;
        };

        const indexedFiles = await openGrokClient.getProjectIndexedFiles(project);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(indexedFiles, null, 2),
            },
          ],
        };
      }

      case 'opengrok_get_last_index_time': {
        const lastTime = await openGrokClient.getLastIndexTime();

        return {
          content: [
            {
              type: 'text',
              text: lastTime,
            },
          ],
        };
      }

      case 'opengrok_get_version': {
        const version = await openGrokClient.getVersion();

        return {
          content: [
            {
              type: 'text',
              text: version,
            },
          ],
        };
      }

      case 'opengrok_get_suggestions': {
        const { query, project, field = 'full' } = args as {
          query: string;
          project?: string;
          field?: string;
        };

        const suggestions = await openGrokClient.getSuggestions(query, project, field);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(suggestions, null, 2),
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
