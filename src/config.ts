/**
 * Configuration for OpenGrok MCP Server
 */
export interface OpenGrokConfig {
  baseUrl: string;
  defaultProject?: string;
  username?: string;
  password?: string;
  cookieString?: string;
  useOAuth?: boolean;
}

/**
 * Get configuration from environment variables or defaults
 */
export function getConfig(): OpenGrokConfig {
  return {
    baseUrl: process.env.OPENGROK_URL || 'http://localhost:8080/source',
    defaultProject: process.env.OPENGROK_DEFAULT_PROJECT || undefined,
    username: process.env.OPENGROK_USERNAME || undefined,
    password: process.env.OPENGROK_PASSWORD || undefined,
    cookieString: process.env.OPENGROK_COOKIES || undefined,
    useOAuth: process.env.OPENGROK_USE_OAUTH === 'true',
  };
}
