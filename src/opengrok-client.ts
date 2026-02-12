import axios, { AxiosInstance } from 'axios';
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';
import { OpenGrokApiClient, SearchResponse, SearchResult as ApiSearchResult } from './opengrok-api-client.js';

export interface SearchResult {
  path: string;
  line: number;
  snippet: string;
  project: string;
}

export interface FileContent {
  path: string;
  content: string;
  project: string;
}

export interface CrossReference {
  symbol: string;
  file: string;
  line: number;
  type: 'definition' | 'reference';
}

/**
 * Client for interacting with OpenGrok via REST API
 */
export class OpenGrokClient {
  private apiClient: OpenGrokApiClient;
  private baseUrl: string;

  constructor(baseUrl: string, cookieJar?: CookieJar, username?: string, password?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    
    // 创建API客户端实例
    this.apiClient = new OpenGrokApiClient(this.baseUrl, cookieJar, username, password);
  }

  /**
   * Search for code across projects (using REST API)
   * @param query - The search query string
   * @param project - Project to search in (required)
   * @param searchType - Type of search: 'full' (text), 'defs' (definitions), 'refs' (symbol references), 'path' (file path), 'hist' (history)
   * @param language - Optional language filter (e.g., 'java', 'cxx', 'python', 'js')
   * @param maxResults - Maximum number of results to return
   */
  async search(
    query: string,
    project: string,
    searchType: 'full' | 'defs' | 'refs' | 'path' | 'hist' = 'full',
    language?: string,
    maxResults: number = 50
  ): Promise<SearchResult[]> {
    if (!project) {
      throw new Error('Project is required for OpenGrok search. Please specify a project.');
    }

    try {
      // Build search parameters based on searchType
      let full: string | undefined;
      let def: string | undefined;
      let symbol: string | undefined;
      let path: string | undefined;
      let hist: string | undefined;
      let type: string | undefined;

      // Set only the active search parameter
      switch (searchType) {
        case 'defs':
          def = query;
          break;
        case 'refs':
          symbol = query;
          break;
        case 'path':
          path = query;
          break;
        case 'hist':
          hist = query;
          break;
        case 'full':
        default:
          full = query;
          break;
      }

      // Add language filter if specified
      if (language) {
        type = language;
      }

      // Use projects parameter for project filtering
      const projects = project;

      const response = await this.apiClient.search(
        full, def, symbol, path, hist, type, projects, maxResults.toString()
      );

      // Transform API response to our expected format
      return this.transformSearchResults(response, project).slice(0, maxResults);
    } catch (error: any) {
      throw new Error(`OpenGrok search failed: ${error.message}`);
    }
  }

  /**
   * Transform API search results to our expected format
   */
  private transformSearchResults(apiResponse: SearchResponse, project: string): SearchResult[] {
    const results: SearchResult[] = [];
    
    // apiResponse.results is a map where keys are file paths and values are arrays of hits in those files
    for (const [filePath, hits] of Object.entries(apiResponse.results)) {
      // Type guard for hits array
      if (Array.isArray(hits)) {
        for (const hit of hits) {
          // Ensure hit has the expected structure
          if (typeof hit === 'object' && hit.lineNumber && hit.line) {
            // Extract line number from the hit
            const lineNumber = hit.lineNumber ? parseInt(hit.lineNumber, 10) : 0;
            const key = `${filePath}:${lineNumber}`;
            
            results.push({
              path: filePath,
              line: lineNumber,
              snippet: hit.line, // The actual code snippet with highlighting
              project: project || 'unknown',
            });
          }
        }
      }
    }

    return results;
  }

  /**
   * Get file content using the REST API
   * @param path File path relative to source root
   * @param project Project name (optional for API but kept for compatibility)
   */
  async getFileContent(path: string, project?: string): Promise<FileContent> {
    try {
      const content = await this.apiClient.getFileContent(path);
      
      return {
        path,
        content: content,
        project: project || '',
      };
    } catch (error: any) {
      throw new Error(`Failed to get file content: ${error.message}`);
    }
  }

  /**
   * Get cross-references for a symbol using the search API
   */
  async getCrossReferences(symbol: string, project?: string): Promise<CrossReference[]> {
    try {
      // Use search API to find symbol references
      const response: SearchResponse = await this.apiClient.search(undefined, undefined, symbol, undefined, undefined, undefined, project);
      
      // Transform results to cross-reference format
      const refs: CrossReference[] = [];
      for (const [filePath, hits] of Object.entries(response.results)) {
        // Type guard for hits array
        if (Array.isArray(hits)) {
          for (const hit of hits) {
            if (typeof hit === 'object' && hit.lineNumber) {
              const line = hit.lineNumber ? parseInt(hit.lineNumber, 10) : 0;
              refs.push({
                symbol: symbol,
                file: filePath,
                line: line,
                type: 'reference' as const, // For API-based implementation, we'll consider all as references
              });
            }
          }
        }
      }

      return refs;
    } catch (error: any) {
      throw new Error(`Failed to get cross-references: ${error.message}`);
    }
  }

  /**
   * List available projects using the REST API
   */
  async listProjects(): Promise<string[]> {
    try {
      return await this.apiClient.getProjects();
    } catch (error: any) {
      throw new Error(`Failed to list projects: ${error.message}`);
    }
  }

  // 以下是基于OpenGrok REST API的额外功能方法

  /**
   * Get annotation for a file
   * @param path File path relative to source root
   */
  async getAnnotation(path: string): Promise<any[]> {
    try {
      return await this.apiClient.getAnnotation(path);
    } catch (error: any) {
      throw new Error(`Failed to get annotation: ${error.message}`);
    }
  }

  /**
   * Get directory listing
   * @param path Path to directory relative to source root
   */
  async getDirectoryListing(path: string): Promise<any[]> {
    try {
      return await this.apiClient.getDirectoryListing(path);
    } catch (error: any) {
      throw new Error(`Failed to get directory listing: ${error.message}`);
    }
  }

  /**
   * Get history for a file/directory
   * @param path Path to file/directory relative to source root
   * @param withFiles Whether to include list of files
   * @param start Start index
   * @param max Number of entries to get
   */
  async getHistory(path: string, withFiles?: boolean, start?: number, max?: number): Promise<any> {
    try {
      return await this.apiClient.getHistory(path, withFiles, start, max);
    } catch (error: any) {
      throw new Error(`Failed to get history: ${error.message}`);
    }
  }

  /**
   * Get file definitions
   * @param path File path relative to source root
   */
  async getFileDefinitions(path: string): Promise<any[]> {
    try {
      return await this.apiClient.getFileDefinitions(path);
    } catch (error: any) {
      throw new Error(`Failed to get file definitions: ${error.message}`);
    }
  }

  /**
   * Get file genre
   * @param path File path relative to source root
   */
  async getFileGenre(path: string): Promise<string> {
    try {
      return await this.apiClient.getFileGenre(path);
    } catch (error: any) {
      throw new Error(`Failed to get file genre: ${error.message}`);
    }
  }

  /**
   * Ping the OpenGrok server to check if it's alive
   */
  async ping(): Promise<boolean> {
    try {
      return await this.apiClient.ping();
    } catch (error: any) {
      console.error(`Ping failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Get indexed projects
   */
  async getIndexedProjects(): Promise<string[]> {
    try {
      return await this.apiClient.getIndexedProjects();
    } catch (error: any) {
      throw new Error(`Failed to get indexed projects: ${error.message}`);
    }
  }

  /**
   * Get project repositories
   * @param project Project name
   */
  async getProjectRepositories(project: string): Promise<string[]> {
    try {
      return await this.apiClient.getProjectRepositories(project);
    } catch (error: any) {
      throw new Error(`Failed to get project repositories: ${error.message}`);
    }
  }

  /**
   * Get project repository types
   * @param project Project name
   */
  async getProjectRepositoryTypes(project: string): Promise<string[]> {
    try {
      return await this.apiClient.getProjectRepositoryTypes(project);
    } catch (error: any) {
      throw new Error(`Failed to get project repository types: ${error.message}`);
    }
  }

  /**
   * Get project indexed files
   * @param project Project name
   */
  async getProjectIndexedFiles(project: string): Promise<string[]> {
    try {
      return await this.apiClient.getProjectIndexedFiles(project);
    } catch (error: any) {
      throw new Error(`Failed to get project indexed files: ${error.message}`);
    }
  }

  /**
   * Get suggestions for code completion
   * @param query Search query
   * @param project Project to search in
   * @param field Field to search in (defs, path, hist, refs, type, full)
   */
  async getSuggestions(query: string, project?: string, field: string = 'full'): Promise<any[]> {
    try {
      const projects = project ? project : undefined;
      const response = await this.apiClient.getSuggestions(projects, field, undefined, query, query, query, query, query, undefined);
      return response.suggestions;
    } catch (error: any) {
      throw new Error(`Failed to get suggestions: ${error.message}`);
    }
  }

  /**
   * Get the last index time
   */
  async getLastIndexTime(): Promise<string> {
    try {
      return await this.apiClient.getLastIndexTime();
    } catch (error: any) {
      throw new Error(`Failed to get last index time: ${error.message}`);
    }
  }

  /**
   * Get web application version
   */
  async getVersion(): Promise<string> {
    try {
      return await this.apiClient.getVersion();
    } catch (error: any) {
      throw new Error(`Failed to get version: ${error.message}`);
    }
  }
}
