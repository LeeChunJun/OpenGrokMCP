import axios from 'axios';
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';
import open from 'open';
import * as http from 'http';
import * as url from 'url';

export interface AuthConfig {
  baseUrl: string;
  username?: string;
  password?: string;
  cookieString?: string;
}

/**
 * Handles OAuth/SSO authentication for OpenGrok
 */
export class OpenGrokAuth {
  private cookieJar: CookieJar;
  private axiosClient;
  private baseUrl: string;

  constructor(config: AuthConfig) {
    this.baseUrl = config.baseUrl;
    this.cookieJar = new CookieJar();
    const axiosConfig: any = {
      withCredentials: true,
      maxRedirects: 10,
      validateStatus: () => true,
    };
    this.axiosClient = wrapper(axios.create(axiosConfig)) as any;
    (this.axiosClient.defaults as any).jar = this.cookieJar;

    // If cookie string provided, load it
    if (config.cookieString) {
      this.loadCookiesFromString(config.cookieString);
    }
  }

  /**
   * Load cookies from a string (semicolon-separated)
   */
  private loadCookiesFromString(cookieString: string) {
    const cookies = cookieString.split(';');
    for (const cookie of cookies) {
      try {
        this.cookieJar.setCookieSync(cookie.trim(), this.baseUrl);
      } catch (e) {
        console.error('Failed to set cookie:', e);
      }
    }
  }

  /**
   * Get current cookies as a string
   */
  getCookieString(): string {
    const cookies = this.cookieJar.getCookiesSync(this.baseUrl);
    return cookies.map((c: any) => c.cookieString()).join('; ');
  }

  /**
   * Attempt to authenticate and get session cookies
   * This will open a browser for OAuth login
   */
  async authenticate(): Promise<boolean> {
    console.error('Starting OAuth authentication flow...');
    console.error(`Please authenticate in your browser at: ${this.baseUrl}`);
    console.error('After login, check your browser cookies and provide them to continue.');
    
    return new Promise((resolve) => {
      // For now, just wait for user to manually set cookies
      // The server will retry API calls when the user provides cookies via env var
      setTimeout(() => {
        console.error('Note: Set OPENGROK_COOKIES environment variable with your session cookies to proceed.');
        resolve(false);
      }, 5000);
    });
  }

  /**
   * Check if we have valid authentication
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const response = await this.axiosClient.get(`${this.baseUrl}/api/v1/projects`);
      return response.status === 200;
    } catch (e) {
      return false;
    }
  }

  /**
   * Get authenticated axios instance
   */
  getClient() {
    return this.axiosClient;
  }

  /**
   * Get cookie jar for sharing with OpenGrok client
   */
  getCookieJar() {
    return this.cookieJar;
  }
}
