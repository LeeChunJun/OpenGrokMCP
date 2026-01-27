import axios, { AxiosInstance } from 'axios';
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';

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
 * Client for interacting with OpenGrok via web interface
 */
export class OpenGrokClient {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor(baseUrl: string, cookieJar?: CookieJar, username?: string, password?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    
    const config: any = {
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      validateStatus: () => true, // Don't throw on any status code
      withCredentials: true,
    };

    // Use cookie jar if provided (for SSO/OAuth)
    if (cookieJar) {
      this.client = wrapper(axios.create(config)) as any;
      (this.client.defaults as any).jar = cookieJar;
    } else {
      // Fall back to basic auth if credentials provided
      if (username && password) {
        config.auth = {
          username,
          password,
        };
      }
      this.client = axios.create(config);
    }
  }

  /**
   * Search for code across projects (using web interface)
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
      const params: any = {
        project,
        xrd: '',
        nn: '1',  // New results flag
      };

      // Set only the active search parameter
      switch (searchType) {
        case 'defs':
          params.defs = query;
          break;
        case 'refs':
          params.refs = query;
          break;
        case 'path':
          params.path = query;
          break;
        case 'hist':
          params.hist = query;
          break;
        case 'full':
        default:
          params.full = query;
          break;
      }

      // Add language filter if specified
      if (language) {
        params.type = language;
      } else {
        params.type = ''; // Empty means all languages
      }

      const response = await this.client.get('/search', { params, maxRedirects: 10 });
      
      // Check for authentication errors
      if (response.status === 401 || response.status === 403) {
        console.error(`[OpenGrok] Authentication failed (${response.status}). Cookies may have expired.`);
        console.error(`[OpenGrok] Please update OPENGROK_COOKIES in mcp.json with fresh session cookies.`);
        console.error(`[OpenGrok] Steps:`);
        console.error(`[OpenGrok]   1. Visit: ${this.baseUrl}`);
        console.error(`[OpenGrok]   2. Open DevTools (F12) → Application → Cookies`);
        console.error(`[OpenGrok]   3. Copy the whole Cookie string from the Request Headers`);
        console.error(`[OpenGrok]   4. Update OPENGROK_COOKIES in ~/.config/Code/User/mcp.json`);
        console.error(`[OpenGrok]   5. Reload VS Code`);
        throw new Error(`Authentication failed (${response.status}). Your session cookies have expired. See console for instructions.`);
      }

      if (response.status !== 200) {
        throw new Error(`OpenGrok search failed with status ${response.status}`);
      }

      // Parse HTML response to extract results
      const results = this.parseSearchResults(response.data, project);
      return results.slice(0, maxResults);
    } catch (error: any) {
      throw new Error(`OpenGrok search failed: ${error.message}`);
    }
  }

  /**
   * Parse search results from HTML response
   */
  private parseSearchResults(html: string, project?: string): SearchResult[] {
    const results: SearchResult[] = [];
    
    // OpenGrok search result format:
    // <a class="s" href="/xref/PROJECT/path/to/file#LINE"><span class="l">LINE</span>CODE_SNIPPET</a>
    // Extract the full link element including the code snippet
    const resultPattern = /<a\s+class="s"\s+href="\/xref\/([^"]+?)#(\d+)"[^>]*>(.*?)<\/a>/g;
    
    const seen = new Set<string>();
    let match;
    let matchCount = 0;

    while ((match = resultPattern.exec(html)) !== null) {
      matchCount++;
      const filePath = match[1];
      const line = parseInt(match[2], 10) || 0;
      const fullSnippet = match[3]; // Raw HTML snippet from OpenGrok
      
      const key = `${filePath}:${line}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push({
          path: filePath,
          line: line,
          snippet: fullSnippet, // Return the raw snippet so chatbot can see context
          project: project || 'unknown',
        });
      }
    }

    // Log debug info
    if (matchCount > 0) {
      console.error(`[OpenGrok] parseSearchResults: Found ${matchCount} matches, returning ${results.length} unique results`);
    } else {
      console.error(`[OpenGrok] parseSearchResults: No matches found with pattern`);
      // Try simpler pattern for debugging
      const simplePattern = /<a class="s"/g;
      const simpleMatches = html.match(simplePattern);
      console.error(`[OpenGrok] Found ${simpleMatches ? simpleMatches.length : 0} <a class="s" elements`);
    }

    return results;
  }

  /**
   * Get file content
   * 
   * NOTE: OpenGrok's file retrieval works best without the project prefix.
   * The project parameter is kept for compatibility but should typically be omitted.
   * If the file path from search results includes the project name, use that directly.
   */
  async getFileContent(path: string, project?: string): Promise<FileContent> {
    try {
      // OpenGrok API works best with just /xref/path without project prefix
      // Try without project first, then fall back to with project if needed
      let url = `/xref/${path}`;
      let response = await this.client.get(url);
      
      // If 404 and project was provided, try with project prefix as fallback
      if (response.status === 404 && project) {
        url = `/xref/${project}/${path}`;
        response = await this.client.get(url);
      }
      
      if (response.status === 401 || response.status === 403) {
        throw new Error(`Authentication failed (${response.status}). Update OPENGROK_COOKIES.`);
      }

      if (response.status !== 200) {
        throw new Error(`Failed to get file: ${response.status}. Tip: Omit the 'project' parameter and use the full path from search results (e.g., 'ProjectName/path/to/file').`);
      }

      // Extract code content from HTML
      const content = this.extractFileContent(response.data);

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
   * Extract file content from OpenGrok HTML
   */
  private extractFileContent(html: string): string {
    // Look for code in <pre> tags or similar
    const preMatch = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/);
    if (preMatch) {
      return preMatch[1]
        .replace(/<[^>]+>/g, '') // Remove HTML tags
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .trim();
    }
    return 'File content could not be extracted';
  }

  /**
   * Get cross-references for a symbol
   */
  async getCrossReferences(symbol: string, project?: string): Promise<CrossReference[]> {
    try {
      const params: any = {
        q: `definitions:${symbol}`,
      };

      if (project) {
        params.project = project;
      }

      const response = await this.client.get('/search', { params });
      
      if (response.status === 401 || response.status === 403) {
        throw new Error(`Authentication failed (${response.status}). Update OPENGROK_COOKIES.`);
      }

      // Parse results as cross-references
      const searchResults = this.parseSearchResults(response.data, project);
      
      const refs = searchResults.map(r => ({
        symbol: symbol,
        file: r.path,
        line: r.line,
        type: 'definition' as const,
      }));

      return refs;
    } catch (error: any) {
      throw new Error(`Failed to get cross-references: ${error.message}`);
    }
  }

  /**
   * List available projects by scraping the main page
   */
  async listProjects(): Promise<string[]> {
    try {
      const response = await this.client.get('/');
      
      if (response.status === 401 || response.status === 403) {
        throw new Error(`Authentication failed (${response.status}). Update OPENGROK_COOKIES.`);
      }

      if (response.status !== 200) {
        throw new Error(`OpenGrok API error: ${response.status}`);
      }

      // Extract project names from the HTML select dropdown
      const projects = this.parseProjects(response.data);
      return projects;
    } catch (error: any) {
      throw new Error(`Failed to list projects: ${error.message}`);
    }
  }

  /**
   * Parse project list from HTML
   */
  private parseProjects(html: string): string[] {
    const projects: string[] = [];
    
    // Look for <option value="projectname">projectname</option>
    const optionPattern = /<option[^>]*value="([^"]*)"[^>]*>([^<]*)<\/option>/g;
    let match;

    while ((match = optionPattern.exec(html)) !== null) {
      const projectName = match[1] || match[2];
      if (projectName && projectName.trim() !== '') {
        projects.push(projectName.trim());
      }
    }

    return projects;
  }
}
