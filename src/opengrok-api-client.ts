import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';

// 定义API响应类型
export interface Annotation {
  revision: string;
  author: string;
  description: string;
  version: string;
}

export interface Configuration {
  [key: string]: any;
}

export interface FileDefinition {
  type: string;
  signature: string;
  text: string;
  symbol: string;
  lineStart: number;
  lineEnd: number;
  line: number;
  namespace: string | null;
}

export interface HistoryEntry {
  revision: string;
  date: number;
  author: string;
  tags: string | null;
  message: string;
  files: string[];
}

export interface HistoryResponse {
  entries: HistoryEntry[];
  start: number;
  count: number;
  total: number;
}

export interface DirectoryEntry {
  path: string;
  numLines: number;
  loc: number;
  date: number;
  description: string | null;
  pathDescription: string;
  isDirectory: boolean;
  size: number | null;
}

export interface SearchResult {
  path: string;
  line: number;
  snippet: string;
  project: string;
}

export interface SearchResponse {
  time: number;
  resultCount: number;
  startDocument: number;
  endDocument: number;
  results: {
    [key: string]: {
      line: string;
      lineNumber: string;
      tag: string;
    }[];
  };
}

export interface Group {
  name: string;
  pattern: string;
}

export interface Project {
  name: string;
}

export interface Repository {
  path: string;
}

export interface RepositoryProperty {
  working: boolean;
  type: string;
  remote: boolean;
  parent: string;
  branch: string;
  currentVersion: string;
  handleRenamedFiles: boolean;
  historyEnabled: boolean;
  annotationCacheEnabled: boolean;
}

export interface SuggesterConfig {
  enabled: boolean;
  maxResults: number;
  minChars: number;
  allowedProjects: string[] | null;
  maxProjects: number;
  allowedFields: string[];
  allowComplexQueries: boolean;
  allowMostPopular: boolean;
  showScores: boolean;
  showProjects: boolean;
  showTime: boolean;
  rebuildCronConfig: string;
  buildTerminationTime: number;
  timeThreshold: number;
}

export interface Suggestion {
  phrase: string;
  projects: string[];
  score: number;
}

export interface SuggesterResponse {
  time: number;
  suggestions: Suggestion[];
  identifier: string;
  queryText: string;
  partialResult: boolean;
}

/**
 * 基于OpenGrok REST API的客户端实现
 */
export class OpenGrokApiClient {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor(baseUrl: string, cookieJar?: CookieJar, username?: string, password?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash

    const config: any = {
      baseURL: `${this.baseUrl}/api/v1`, // 使用API v1端点
      timeout: 30000,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; OpenGrokMCP/1.0)',
      },
      validateStatus: (status: number) => status >= 200 && status < 500, // Don't throw on any status code up to 4xx
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
   * 获取文件注解信息
   * @param path 文件路径，相对于源码根目录
   */
  async getAnnotation(path: string): Promise<Annotation[]> {
    try {
      const response: AxiosResponse<Annotation[]> = await this.client.get('/annotation', {
        params: { path }
      });

      if (response.status === 401 || response.status === 403) {
        throw new Error(`Authentication failed (${response.status}). Update OPENGROK_COOKIES.`);
      }

      if (response.status !== 200) {
        throw new Error(`Failed to get annotation: ${response.status}`);
      }

      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get annotation: ${error.message}`);
    }
  }

  /**
   * 重新加载授权框架
   */
  async reloadAuthorizationFramework(): Promise<void> {
    try {
      const response = await this.client.post('/configuration/authorization/reload');

      if (response.status === 401 || response.status === 403) {
        throw new Error(`Authentication failed (${response.status}). Update OPENGROK_COOKIES.`);
      }

      if (response.status === 202) {
        // 异步操作，需要检查状态
        console.log('Authorization framework reload started. Check status with status endpoint.');
      } else if (response.status !== 204) {
        throw new Error(`Failed to reload authorization framework: ${response.status}`);
      }
    } catch (error: any) {
      throw new Error(`Failed to reload authorization framework: ${error.message}`);
    }
  }

  /**
   * 获取配置信息
   */
  async getConfiguration(): Promise<Configuration> {
    try {
      const response = await this.client.get('/configuration');

      if (response.status === 401 || response.status === 403) {
        throw new Error(`Authentication failed (${response.status}). Update OPENGROK_COOKIES.`);
      }

      if (response.status !== 200) {
        throw new Error(`Failed to get configuration: ${response.status}`);
      }

      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get configuration: ${error.message}`);
    }
  }

  /**
   * 设置配置信息
   * @param config XML格式的配置信息
   */
  async setConfiguration(config: string): Promise<void> {
    try {
      const response = await this.client.put('/configuration', config, {
        headers: {
          'Content-Type': 'application/xml'
        }
      });

      if (response.status === 401 || response.status === 403) {
        throw new Error(`Authentication failed (${response.status}). Update OPENGROK_COOKIES.`);
      }

      if (response.status === 202) {
        // 异步操作，需要检查状态
        console.log('Configuration update started. Check status with status endpoint.');
      } else if (response.status !== 201) {
        throw new Error(`Failed to set configuration: ${response.status}`);
      }
    } catch (error: any) {
      throw new Error(`Failed to set configuration: ${error.message}`);
    }
  }

  /**
   * 获取特定配置字段
   * @param field 配置字段名称
   */
  async getConfigurationField(field: string): Promise<any> {
    try {
      const response = await this.client.get(`/configuration/${field}`);

      if (response.status === 401 || response.status === 403) {
        throw new Error(`Authentication failed (${response.status}). Update OPENGROK_COOKIES.`);
      }

      if (response.status !== 200) {
        throw new Error(`Failed to get configuration field: ${response.status}`);
      }

      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get configuration field: ${error.message}`);
    }
  }

  /**
   * 设置特定配置字段
   * @param field 配置字段名称
   * @param value 字段值
   * @param reindex 是否重新索引
   */
  async setConfigurationField(field: string, value: string, reindex?: boolean): Promise<void> {
    try {
      const params: any = {};
      if (reindex !== undefined) {
        params.reindex = reindex;
      }

      const response = await this.client.put(`/configuration/${field}`, value, {
        params,
        headers: {
          'Content-Type': 'application/text'
        }
      });

      if (response.status === 401 || response.status === 403) {
        throw new Error(`Authentication failed (${response.status}). Update OPENGROK_COOKIES.`);
      }

      if (response.status === 202) {
        // 异步操作，需要检查状态
        console.log('Configuration field update started. Check status with status endpoint.');
      } else if (response.status !== 204) {
        throw new Error(`Failed to set configuration field: ${response.status}`);
      }
    } catch (error: any) {
      throw new Error(`Failed to set configuration field: ${error.message}`);
    }
  }

  /**
   * 获取文件内容
   * @param path 文件路径，相对于源码根目录
   */
  async getFileContent(path: string): Promise<string> {
    try {
      const response = await this.client.get('/file/content', {
        params: { path },
        headers: {
          'Accept': 'text/plain'
        }
      });

      if (response.status === 401 || response.status === 403) {
        throw new Error(`Authentication failed (${response.status}). Update OPENGROK_COOKIES.`);
      }

      if (response.status !== 200) {
        throw new Error(`Failed to get file content: ${response.status}`);
      }

      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get file content: ${error.message}`);
    }
  }

  /**
   * 获取文件类型
   * @param path 文件路径，相对于源码根目录
   */
  async getFileGenre(path: string): Promise<string> {
    try {
      const response = await this.client.get('/file/genre', {
        params: { path }
      });

      if (response.status === 401 || response.status === 403) {
        throw new Error(`Authentication failed (${response.status}). Update OPENGROK_COOKIES.`);
      }

      if (response.status !== 200) {
        throw new Error(`Failed to get file genre: ${response.status}`);
      }

      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get file genre: ${error.message}`);
    }
  }

  /**
   * 获取文件定义信息
   * @param path 文件路径，相对于源码根目录
   */
  async getFileDefinitions(path: string): Promise<FileDefinition[]> {
    try {
      const response: AxiosResponse<FileDefinition[]> = await this.client.get('/file/defs', {
        params: { path }
      });

      if (response.status === 401 || response.status === 403) {
        throw new Error(`Authentication failed (${response.status}). Update OPENGROK_COOKIES.`);
      }

      if (response.status !== 200) {
        throw new Error(`Failed to get file definitions: ${response.status}`);
      }

      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get file definitions: ${error.message}`);
    }
  }

  /**
   * 获取历史记录
   * @param path 文件或目录路径，相对于源码根目录
   * @param withFiles 是否包含文件列表
   * @param start 起始索引
   * @param max 条目数量
   */
  async getHistory(path: string, withFiles?: boolean, start?: number, max?: number): Promise<HistoryResponse> {
    try {
      const params: any = { path };
      if (withFiles !== undefined) params.withFiles = withFiles;
      if (start !== undefined) params.start = start;
      if (max !== undefined) params.max = max;

      const response: AxiosResponse<HistoryResponse> = await this.client.get('/history', { params });

      if (response.status === 401 || response.status === 403) {
        throw new Error(`Authentication failed (${response.status}). Update OPENGROK_COOKIES.`);
      }

      if (response.status !== 200) {
        throw new Error(`Failed to get history: ${response.status}`);
      }

      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get history: ${error.message}`);
    }
  }

  /**
   * 获取目录列表
   * @param path 目录路径，相对于源码根目录
   */
  async getDirectoryListing(path: string): Promise<DirectoryEntry[]> {
    try {
      const response: AxiosResponse<DirectoryEntry[]> = await this.client.get('/list', {
        params: { path }
      });

      if (response.status === 401 || response.status === 403) {
        throw new Error(`Authentication failed (${response.status}). Update OPENGROK_COOKIES.`);
      }

      if (response.status !== 200) {
        throw new Error(`Failed to get directory listing: ${response.status}`);
      }

      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get directory listing: ${error.message}`);
    }
  }

  /**
   * 重新加载包含文件
   */
  async reloadIncludeFiles(): Promise<void> {
    try {
      const response = await this.client.put('/system/includes/reload');

      if (response.status === 401 || response.status === 403) {
        throw new Error(`Authentication failed (${response.status}). Update OPENGROK_COOKIES.`);
      }

      if (response.status !== 204) {
        throw new Error(`Failed to reload include files: ${response.status}`);
      }
    } catch (error: any) {
      throw new Error(`Failed to reload include files: ${error.message}`);
    }
  }

  /**
   * 获取最后索引时间
   */
  async getLastIndexTime(): Promise<string> {
    try {
      const response = await this.client.get('/system/indextime');

      if (response.status === 401 || response.status === 403) {
        throw new Error(`Authentication failed (${response.status}). Update OPENGROK_COOKIES.`);
      }

      if (response.status !== 200) {
        throw new Error(`Failed to get last index time: ${response.status}`);
      }

      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get last index time: ${error.message}`);
    }
  }

  /**
   * 添加消息到系统
   * @param message 消息对象
   */
  async addMessage(message: {
    tags: string[];
    messageLevel: 'success' | 'info' | 'warning' | 'error';
    text: string;
    duration: string;
  }): Promise<void> {
    try {
      const response = await this.client.post('/messages', message);

      if (response.status === 401 || response.status === 403) {
        throw new Error(`Authentication failed (${response.status}). Update OPENGROK_COOKIES.`);
      }

      if (response.status !== 201) {
        throw new Error(`Failed to add message: ${response.status}`);
      }
    } catch (error: any) {
      throw new Error(`Failed to add message: ${error.message}`);
    }
  }

  /**
   * 删除指定标签的消息
   * @param tag 标签
   * @param text 消息文本
   */
  async deleteMessages(tag: string, text?: string): Promise<void> {
    try {
      const response = await this.client.delete(`/messages/${tag}`, {
        data: text
      });

      if (response.status === 401 || response.status === 403) {
        throw new Error(`Authentication failed (${response.status}). Update OPENGROK_COOKIES.`);
      }

      if (response.status !== 204) {
        throw new Error(`Failed to delete messages: ${response.status}`);
      }
    } catch (error: any) {
      throw new Error(`Failed to delete messages: ${error.message}`);
    }
  }

  /**
   * 获取指定标签的消息
   * @param tag 标签
   */
  async getMessages(tag: string): Promise<any[]> {
    try {
      const response = await this.client.get(`/messages`, {
        params: { tag }
      });

      if (response.status === 401 || response.status === 403) {
        throw new Error(`Authentication failed (${response.status}). Update OPENGROK_COOKIES.`);
      }

      if (response.status !== 200) {
        throw new Error(`Failed to get messages: ${response.status}`);
      }

      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get messages: ${error.message}`);
    }
  }

  /**
   * 获取Prometheus格式的监控指标
   */
  async getMetrics(): Promise<string> {
    try {
      const response = await this.client.get('/metrics/prometheus');

      if (response.status !== 200) {
        throw new Error(`Failed to get metrics: ${response.status}`);
      }

      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get metrics: ${error.message}`);
    }
  }

  /**
   * 更新路径描述
   * @param pathDescriptions 路径描述对象数组
   */
  async updatePathDescriptions(pathDescriptions: { path: string; description: string }[]): Promise<void> {
    try {
      const response = await this.client.post('/system/pathdesc', pathDescriptions);

      if (response.status === 401 || response.status === 403) {
        throw new Error(`Authentication failed (${response.status}). Update OPENGROK_COOKIES.`);
      }

      if (response.status !== 204) {
        throw new Error(`Failed to update path descriptions: ${response.status}`);
      }
    } catch (error: any) {
      throw new Error(`Failed to update path descriptions: ${error.message}`);
    }
  }

  /**
   * 获取Web应用版本
   */
  async getVersion(): Promise<string> {
    try {
      const response = await this.client.get('/system/version');

      if (response.status !== 200) {
        throw new Error(`Failed to get version: ${response.status}`);
      }

      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get version: ${error.message}`);
    }
  }

  /**
   * 检查Web应用是否在线
   */
  async ping(): Promise<boolean> {
    try {
      const response = await this.client.get('/system/ping');

      return response.status === 200;
    } catch (error: any) {
      return false;
    }
  }

  /**
   * 获取所有组
   */
  async getGroups(): Promise<string[]> {
    try {
      const response: AxiosResponse<string[]> = await this.client.get('/groups');

      if (response.status === 401 || response.status === 403) {
        throw new Error(`Authentication failed (${response.status}). Update OPENGROK_COOKIES.`);
      }

      if (response.status !== 200) {
        throw new Error(`Failed to get groups: ${response.status}`);
      }

      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get groups: ${error.message}`);
    }
  }

  /**
   * 获取组的所有项目
   * @param group 组名
   */
  async getGroupAllProjects(group: string): Promise<string[]> {
    try {
      const response: AxiosResponse<string[]> = await this.client.get(`/groups/${group}/allprojects`);

      if (response.status === 401 || response.status === 403) {
        throw new Error(`Authentication failed (${response.status}). Update OPENGROK_COOKIES.`);
      }

      if (response.status !== 200) {
        throw new Error(`Failed to get group projects: ${response.status}`);
      }

      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get group projects: ${error.message}`);
    }
  }

  /**
   * 获取组的模式
   * @param group 组名
   */
  async getGroupPattern(group: string): Promise<string> {
    try {
      const response = await this.client.get(`/groups/${group}/pattern`);

      if (response.status === 401 || response.status === 403) {
        throw new Error(`Authentication failed (${response.status}). Update OPENGROK_COOKIES.`);
      }

      if (response.status !== 200) {
        throw new Error(`Failed to get group pattern: ${response.status}`);
      }

      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get group pattern: ${error.message}`);
    }
  }

  /**
   * 检查项目名是否匹配组模式
   * @param group 组名
   * @param projectName 项目名
   */
  async checkGroupMatch(group: string, projectName: string): Promise<boolean> {
    try {
      const response = await this.client.post(`/groups/${group}/match`, projectName, {
        headers: {
          'Content-Type': 'text/plain'
        }
      });

      if (response.status === 401 || response.status === 403) {
        throw new Error(`Authentication failed (${response.status}). Update OPENGROK_COOKIES.`);
      }

      // 200表示匹配，204表示不匹配
      return response.status === 200;
    } catch (error: any) {
      throw new Error(`Failed to check group match: ${error.message}`);
    }
  }

  /**
   * 获取所有项目
   */
  async getProjects(): Promise<string[]> {
    try {
      const response: AxiosResponse<string[]> = await this.client.get('/projects');

      if (response.status === 401 || response.status === 403) {
        throw new Error(`Authentication failed (${response.status}). Update OPENGROK_COOKIES.`);
      }

      if (response.status !== 200) {
        throw new Error(`Failed to get projects: ${response.status}`);
      }

      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get projects: ${error.message}`);
    }
  }

  /**
   * 添加项目
   * @param projectName 项目名称
   */
  async addProject(projectName: string): Promise<void> {
    try {
      const response = await this.client.post('/projects', projectName, {
        headers: {
          'Content-Type': 'text/plain'
        }
      });

      if (response.status === 401 || response.status === 403) {
        throw new Error(`Authentication failed (${response.status}). Update OPENGROK_COOKIES.`);
      }

      if (response.status !== 201) {
        throw new Error(`Failed to add project: ${response.status}`);
      }
    } catch (error: any) {
      throw new Error(`Failed to add project: ${error.message}`);
    }
  }

  /**
   * 删除项目
   * @param projectName 项目名称
   */
  async deleteProject(projectName: string): Promise<void> {
    try {
      const response = await this.client.delete(`/projects/${projectName}`);

      if (response.status === 401 || response.status === 403) {
        throw new Error(`Authentication failed (${response.status}). Update OPENGROK_COOKIES.`);
      }

      if (response.status !== 204) {
        throw new Error(`Failed to delete project: ${response.status}`);
      }
    } catch (error: any) {
      throw new Error(`Failed to delete project: ${error.message}`);
    }
  }

  /**
   * 删除项目索引数据
   * @param projectName 项目名称
   */
  async deleteProjectIndexData(projectName: string): Promise<void> {
    try {
      const response = await this.client.delete(`/projects/${projectName}/data`);

      if (response.status === 401 || response.status === 403) {
        throw new Error(`Authentication failed (${response.status}). Update OPENGROK_COOKIES.`);
      }

      if (response.status !== 204) {
        throw new Error(`Failed to delete project index data: ${response.status}`);
      }
    } catch (error: any) {
      throw new Error(`Failed to delete project index data: ${error.message}`);
    }
  }

  /**
   * 删除项目历史缓存
   * @param projectName 项目名称
   */
  async deleteProjectHistoryCache(projectName: string): Promise<string[]> {
    try {
      const response: AxiosResponse<string[]> = await this.client.delete(`/projects/${projectName}/historycache`);

      if (response.status === 401 || response.status === 403) {
        throw new Error(`Authentication failed (${response.status}). Update OPENGROK_COOKIES.`);
      }

      if (response.status !== 200) {
        throw new Error(`Failed to delete project history cache: ${response.status}`);
      }

      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to delete project history cache: ${error.message}`);
    }
  }

  /**
   * 删除项目注解缓存
   * @param projectName 项目名称
   */
  async deleteProjectAnnotationCache(projectName: string): Promise<string[]> {
    try {
      const response: AxiosResponse<string[]> = await this.client.delete(`/projects/${projectName}/annotationcache`);

      if (response.status === 401 || response.status === 403) {
        throw new Error(`Authentication failed (${response.status}). Update OPENGROK_COOKIES.`);
      }

      if (response.status !== 200) {
        throw new Error(`Failed to delete project annotation cache: ${response.status}`);
      }

      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to delete project annotation cache: ${error.message}`);
    }
  }

  /**
   * 标记项目为已索引
   * @param projectName 项目名称
   */
  async markProjectAsIndexed(projectName: string): Promise<void> {
    try {
      const response = await this.client.put(`/projects/${projectName}/indexed`, '', {
        headers: {
          'Content-Type': 'text/plain'
        }
      });

      if (response.status === 401 || response.status === 403) {
        throw new Error(`Authentication failed (${response.status}). Update OPENGROK_COOKIES.`);
      }

      if (response.status === 202) {
        // 异步操作，需要检查状态
        console.log('Mark project as indexed started. Check status with status endpoint.');
      } else if (response.status !== 204) {
        throw new Error(`Failed to mark project as indexed: ${response.status}`);
      }
    } catch (error: any) {
      throw new Error(`Failed to mark project as indexed: ${error.message}`);
    }
  }

  /**
   * 获取项目索引文件列表
   * @param projectName 项目名称
   */
  async getProjectIndexedFiles(projectName: string): Promise<string[]> {
    try {
      const response: AxiosResponse<string[]> = await this.client.get(`/projects/${projectName}/files`);

      if (response.status === 401 || response.status === 403) {
        throw new Error(`Authentication failed (${response.status}). Update OPENGROK_COOKIES.`);
      }

      if (response.status !== 200) {
        throw new Error(`Failed to get project indexed files: ${response.status}`);
      }

      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get project indexed files: ${error.message}`);
    }
  }

  /**
   * 设置项目属性
   * @param projectName 项目名称
   * @param propertyName 属性名称
   * @param value 属性值
   */
  async setProjectProperty(projectName: string, propertyName: string, value: string): Promise<void> {
    try {
      const response = await this.client.put(`/projects/${projectName}/property/${propertyName}`, value);

      if (response.status === 401 || response.status === 403) {
        throw new Error(`Authentication failed (${response.status}). Update OPENGROK_COOKIES.`);
      }

      if (response.status !== 204) {
        throw new Error(`Failed to set project property: ${response.status}`);
      }
    } catch (error: any) {
      throw new Error(`Failed to set project property: ${error.message}`);
    }
  }

  /**
   * 获取项目属性
   * @param projectName 项目名称
   * @param propertyName 属性名称
   */
  async getProjectProperty(projectName: string, propertyName: string): Promise<any> {
    try {
      const response = await this.client.get(`/projects/${projectName}/property/${propertyName}`);

      if (response.status === 401 || response.status === 403) {
        throw new Error(`Authentication failed (${response.status}). Update OPENGROK_COOKIES.`);
      }

      if (response.status !== 200) {
        throw new Error(`Failed to get project property: ${response.status}`);
      }

      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get project property: ${error.message}`);
    }
  }

  /**
   * 获取项目仓库
   * @param projectName 项目名称
   */
  async getProjectRepositories(projectName: string): Promise<string[]> {
    try {
      const response: AxiosResponse<string[]> = await this.client.get(`/projects/${projectName}/repositories`);

      if (response.status === 401 || response.status === 403) {
        throw new Error(`Authentication failed (${response.status}). Update OPENGROK_COOKIES.`);
      }

      if (response.status !== 200) {
        throw new Error(`Failed to get project repositories: ${response.status}`);
      }

      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get project repositories: ${error.message}`);
    }
  }

  /**
   * 获取项目仓库类型
   * @param projectName 项目名称
   */
  async getProjectRepositoryTypes(projectName: string): Promise<string[]> {
    try {
      const response: AxiosResponse<string[]> = await this.client.get(`/projects/${projectName}/repositories/type`);

      if (response.status === 401 || response.status === 403) {
        throw new Error(`Authentication failed (${response.status}). Update OPENGROK_COOKIES.`);
      }

      if (response.status !== 200) {
        throw new Error(`Failed to get project repository types: ${response.status}`);
      }

      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get project repository types: ${error.message}`);
    }
  }

  /**
   * 获取已索引项目列表
   */
  async getIndexedProjects(): Promise<string[]> {
    try {
      const response: AxiosResponse<string[]> = await this.client.get('/projects/indexed');

      if (response.status === 401 || response.status === 403) {
        throw new Error(`Authentication failed (${response.status}). Update OPENGROK_COOKIES.`);
      }

      if (response.status !== 200) {
        throw new Error(`Failed to get indexed projects: ${response.status}`);
      }

      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get indexed projects: ${error.message}`);
    }
  }

  /**
   * 获取仓库属性值
   * @param field 字段名称
   * @param repository 仓库路径
   */
  async getRepositoryField(field: string, repository?: string): Promise<any> {
    try {
      const params: any = {};
      if (repository) params.repository = repository;

      const response = await this.client.get(`/repositories/property/${field}`, { params });

      if (response.status === 401 || response.status === 403) {
        throw new Error(`Authentication failed (${response.status}). Update OPENGROK_COOKIES.`);
      }

      if (response.status !== 200) {
        throw new Error(`Failed to get repository field: ${response.status}`);
      }

      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get repository field: ${error.message}`);
    }
  }

  /**
   * 搜索代码
   * @param full 全文搜索查询
   * @param def 定义搜索查询
   * @param symbol 符号搜索查询
   * @param path 文件路径搜索查询
   * @param hist 历史搜索查询
   * @param type 文件类型过滤
   * @param projects 项目过滤
   * @param maxResults 最大结果数
   * @param start 起始索引
   * @param sort 排序方式
   */
  async search(
    full?: string,
    def?: string,
    symbol?: string,
    path?: string,
    hist?: string,
    type?: string,
    projects?: string,
    maxResults?: string,
    start?: string,
    sort?: 'relevancy' | 'fullpath' | 'lastmodtime'
  ): Promise<SearchResponse> {
    try {
      const params: any = {};
      if (full !== undefined) params.full = full;
      if (def !== undefined) params.def = def;
      if (symbol !== undefined) params.symbol = symbol;
      if (path !== undefined) params.path = path;
      if (hist !== undefined) params.hist = hist;
      if (type !== undefined) params.type = type;
      if (projects !== undefined) params.projects = projects;
      if (maxResults !== undefined) params.maxresults = maxResults;
      if (start !== undefined) params.start = start;
      if (sort !== undefined) params.sort = sort;

      const response: AxiosResponse<SearchResponse> = await this.client.get('/search', { params });

      if (response.status !== 200) {
        throw new Error(`Search failed with status ${response.status}`);
      }

      return response.data;
    } catch (error: any) {
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  /**
   * 获取建议
   * @param projects 项目列表
   * @param field 字段
   * @param caret 光标位置
   * @param full 全文搜索值
   * @param defs 定义搜索值
   * @param refs 符号搜索值
   * @param path 文件路径搜索值
   * @param hist 历史搜索值
   * @param type 类型搜索值
   */
  async getSuggestions(
    projects?: string,
    field?: string,
    caret?: number,
    full?: string,
    defs?: string,
    refs?: string,
    path?: string,
    hist?: string,
    type?: string
  ): Promise<SuggesterResponse> {
    try {
      const params: any = {};
      if (projects !== undefined) params.projects = projects;
      if (field !== undefined) params.field = field;
      if (caret !== undefined) params.caret = caret;
      if (full !== undefined) params.full = full;
      if (defs !== undefined) params.defs = defs;
      if (refs !== undefined) params.refs = refs;
      if (path !== undefined) params.path = path;
      if (hist !== undefined) params.hist = hist;
      if (type !== undefined) params.type = type;

      const response: AxiosResponse<SuggesterResponse> = await this.client.get('/suggest', { params });

      if (response.status !== 200) {
        throw new Error(`Get suggestions failed with status ${response.status}`);
      }

      return response.data;
    } catch (error: any) {
      throw new Error(`Get suggestions failed: ${error.message}`);
    }
  }

  /**
   * 获取建议器配置
   */
  async getSuggesterConfig(): Promise<SuggesterConfig> {
    try {
      const response: AxiosResponse<SuggesterConfig> = await this.client.get('/suggest/config');

      if (response.status !== 200) {
        throw new Error(`Get suggester config failed with status ${response.status}`);
      }

      return response.data;
    } catch (error: any) {
      throw new Error(`Get suggester config failed: ${error.message}`);
    }
  }

  /**
   * 使用查询初始化流行度数据
   * @param queries 查询列表
   */
  async initSuggesterPopularityWithQueries(queries: string[]): Promise<void> {
    try {
      const response = await this.client.post('/suggest/init/queries', queries);

      if (response.status !== 204) {
        throw new Error(`Init suggester popularity with queries failed with status ${response.status}`);
      }
    } catch (error: any) {
      throw new Error(`Init suggester popularity with queries failed: ${error.message}`);
    }
  }

  /**
   * 使用原始数据初始化流行度数据
   * @param data 原始数据
   */
  async initSuggesterPopularityWithRawData(data: { project: string; field: string; token: string; increment: number }[]): Promise<void> {
    try {
      const response = await this.client.post('/suggest/init/raw', data);

      if (response.status !== 204) {
        throw new Error(`Init suggester popularity with raw data failed with status ${response.status}`);
      }
    } catch (error: any) {
      throw new Error(`Init suggester popularity with raw data failed: ${error.message}`);
    }
  }

  /**
   * 获取流行度数据
   * @param project 项目名称
   * @param field 字段
   * @param page 页码
   * @param pageSize 页大小
   * @param all 是否获取所有数据
   */
  async getSuggesterPopularityData(
    project: string,
    field?: string,
    page?: number,
    pageSize?: number,
    all?: boolean
  ): Promise<any[]> {
    try {
      const params: any = {};
      if (field !== undefined) params.field = field;
      if (page !== undefined) params.page = page;
      if (pageSize !== undefined) params.pageSize = pageSize;
      if (all !== undefined) params.all = all;

      const response = await this.client.get(`/suggest/popularity/${project}`, { params });

      if (response.status !== 200) {
        throw new Error(`Get suggester popularity data failed with status ${response.status}`);
      }

      return response.data;
    } catch (error: any) {
      throw new Error(`Get suggester popularity data failed: ${error.message}`);
    }
  }

  /**
   * 重建所有项目的建议器数据
   */
  async rebuildSuggesterData(): Promise<void> {
    try {
      const response = await this.client.put('/suggest/rebuild');

      if (response.status !== 204) {
        throw new Error(`Rebuild suggester data failed with status ${response.status}`);
      }
    } catch (error: any) {
      throw new Error(`Rebuild suggester data failed: ${error.message}`);
    }
  }

  /**
   * 重建指定项目的建议器数据
   * @param project 项目名称
   */
  async rebuildSuggesterDataForProject(project: string): Promise<void> {
    try {
      const response = await this.client.put(`/suggest/rebuild/${project}`);

      if (response.status !== 204) {
        throw new Error(`Rebuild suggester data for project failed with status ${response.status}`);
      }
    } catch (error: any) {
      throw new Error(`Rebuild suggester data for project failed: ${error.message}`);
    }
  }

  /**
   * 检查API请求状态
   * @param uuid 请求UUID
   */
  async checkRequestStatus(uuid: string): Promise<number> {
    try {
      const response = await this.client.get(`/status/${uuid}`);

      return response.status;
    } catch (error: any) {
      throw new Error(`Check request status failed: ${error.message}`);
    }
  }

  /**
   * 删除API请求跟踪状态
   * @param uuid 请求UUID
   */
  async deleteRequestStatus(uuid: string): Promise<void> {
    try {
      const response = await this.client.delete(`/status/${uuid}`);

      if (response.status !== 200) {
        throw new Error(`Delete request status failed with status ${response.status}`);
      }
    } catch (error: any) {
      throw new Error(`Delete request status failed: ${error.message}`);
    }
  }
}