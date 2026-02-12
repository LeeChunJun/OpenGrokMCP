import { OpenGrokClient } from './src/opengrok-client.js';
import { OpenGrokAuth } from './src/auth.js';

async function testAPI() {
  console.log('Testing OpenGrok API...');

  // 使用默认配置进行测试
  const baseUrl = process.env.OPENGROK_URL || 'http://localhost:8080/source';
  console.log(`Testing against: ${baseUrl}`);

  try {
    // 创建客户端实例
    const client = new OpenGrokClient(baseUrl);

    // 测试ping功能
    console.log('\n1. Testing ping...');
    const isAlive = await client.ping();
    console.log(`Server is alive: ${isAlive}`);

    // 测试获取版本
    console.log('\n2. Testing version...');
    try {
      const version = await client.getVersion();
      console.log(`Version: ${version}`);
    } catch (error) {
      console.log(`Version check failed: ${error.message}`);
    }

    // 测试获取项目列表
    console.log('\n3. Testing project listing...');
    try {
      const projects = await client.listProjects();
      console.log(`Projects: ${JSON.stringify(projects, null, 2)}`);
    } catch (error) {
      console.log(`Project listing failed: ${error.message}`);
    }

    // 测试获取索引项目
    console.log('\n4. Testing indexed projects...');
    try {
      const indexedProjects = await client.getIndexedProjects();
      console.log(`Indexed projects: ${JSON.stringify(indexedProjects, null, 2)}`);
    } catch (error) {
      console.log(`Indexed projects check failed: ${error.message}`);
    }

    // 测试获取最后索引时间
    console.log('\n5. Testing last index time...');
    try {
      const lastTime = await client.getLastIndexTime();
      console.log(`Last index time: ${lastTime}`);
    } catch (error) {
      console.log(`Last index time check failed: ${error.message}`);
    }

    console.log('\nAPI tests completed.');
  } catch (error) {
    console.error('Error during API tests:', error);
  }
}

// 运行测试
testAPI().catch(console.error);