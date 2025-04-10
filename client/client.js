// client.js - Run this in a restricted network environment
require('dotenv').config({ path: __dirname + '/.env.local' }); // Load .env.local file from client directory

console.log('API_SERVER_URL:', process.env.API_SERVER_URL);
console.log('TARGET_API:', process.env.TARGET_API);

const axios = require('axios');
const fetch = require('node-fetch');
const https = require('https');
const http = require('http');
const HttpsProxyAgent = require('https-proxy-agent');
const { getProxyForUrl } = require('proxy-from-env');

// Configuration
const SERVER_URL = process.env.API_SERVER_URL;
const TARGET_API = process.env.TARGET_API;  // Read from .env file
const API_KEY = process.env.API_KEY; // Read API key from .env file
const RECONNECT_INTERVAL = 5000;  // Reconnect every 5 seconds if disconnected
const HEARTBEAT_INTERVAL = 25000; // Heartbeat every 25 seconds
const POLL_INTERVAL = 1000; // If polling fails, wait 1 second before retrying

// Console Colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',
  
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m'
};

// Fancy Logger
const log = {
  info: (message) => console.log(`${colors.cyan}${colors.bright}ℹ INFO${colors.reset} ${message}`),
  success: (message) => console.log(`${colors.green}${colors.bright}✓ SUCCESS${colors.reset} ${message}`),
  warn: (message) => console.log(`${colors.yellow}${colors.bright}⚠ WARNING${colors.reset} ${message}`),
  error: (message) => console.log(`${colors.red}${colors.bright}✗ ERROR${colors.reset} ${message}`),
  debug: (message) => console.log(`${colors.magenta}${colors.bright}⚙ DEBUG${colors.reset} ${message}`),
  system: (message) => console.log(`${colors.blue}${colors.bright}⚡ SYSTEM${colors.reset} ${message}`),
  request: (message) => console.log(`${colors.cyan}${colors.bright}← REQUEST${colors.reset} ${message}`),
  response: (message) => console.log(`${colors.green}${colors.bright}→ RESPONSE${colors.reset} ${message}`),
};

// Get system proxy settings
const getSystemProxy = (url) => {
  try {
    // Try to get proxy from environment variables
    const proxyUrl = getProxyForUrl(url);
    if (proxyUrl) {
      log.system(`System proxy detected: ${proxyUrl}`);
    }
    return proxyUrl;
  } catch (error) {
    log.error(`Error detecting system proxy: ${error.message}`);
    return null;
  }
};

// Create HTTP/HTTPS agent for internal requests with system proxy if available
const createAgents = () => {
  const targetProxy = getSystemProxy(TARGET_API);
  
  const httpAgent = new http.Agent({
    keepAlive: true,
  });
  
  let httpsAgent = new https.Agent({
    keepAlive: true,
    rejectUnauthorized: false,  // Set to true in production
  });
  
  // If system proxy is detected, use it
  if (targetProxy) {
    log.system(`Using system proxy for internal requests: ${targetProxy}`);
    httpsAgent = new HttpsProxyAgent(targetProxy);
  }
  
  return { httpAgent, httpsAgent };
};

// Create axios instance with default headers and options
const createAxiosInstance = () => {
  // Get proxy information for the server URL
  const serverProxy = getSystemProxy(SERVER_URL);
  const { httpAgent, httpsAgent } = createAgents();
  
  // Configure axios instance
  const axiosConfig = {
    headers: {
      'X-API-Key': API_KEY,
      'User-Agent': 'Socket-Tunnel-Client/1.0'
    },
    timeout: 35000, // 35 second timeout
    httpAgent, 
    httpsAgent
  };
  
  // If server needs proxy, add proxy agent
  if (serverProxy) {
    log.system(`Using system proxy for server requests: ${serverProxy}`);
    axiosConfig.httpsAgent = new HttpsProxyAgent(serverProxy);
  }
  
  return axios.create(axiosConfig);
};

// Main client class
class LongPollingClient {
  constructor() {
    this.clientId = null;
    this.isConnected = false;
    this.isRegistering = false;
    this.isPolling = false;
    this.heartbeatInterval = null;
    this.api = createAxiosInstance();
  }
  
  // Register with the server and get a clientId
  async register() {
    if (this.isRegistering) return;
    this.isRegistering = true;
    
    try {
      log.info(`Registering with server: ${colors.underscore}${SERVER_URL}${colors.reset}`);
      
      const response = await this.api.post(`${SERVER_URL}/register`);
      
      if (response.status === 200 && response.data.clientId) {
        this.clientId = response.data.clientId;
        this.isConnected = true;
        log.success(`Registered with server. Client ID: ${colors.bright}${this.clientId}${colors.reset}`);
        
        // Start polling and heartbeat
        this.startHeartbeat();
        this.startPolling();
      } else {
        throw new Error(`Unexpected response: ${response.status} ${JSON.stringify(response.data)}`);
      }
    } catch (error) {
      log.error(`Registration failed: ${error.message}`);
      setTimeout(() => {
        this.isRegistering = false;
        this.register();
      }, RECONNECT_INTERVAL);
    }
  }
  
  // Send heartbeat to the server
  async sendHeartbeat() {
    if (!this.isConnected || !this.clientId) return;
    
    try {
      await this.api.post(`${SERVER_URL}/heartbeat/${this.clientId}`);
      log.debug(`Heartbeat sent to server`);
    } catch (error) {
      log.warn(`Heartbeat failed: ${error.message}`);
      this.handleDisconnect();
    }
  }
  
  // Start heartbeat interval
  startHeartbeat() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = setInterval(() => this.sendHeartbeat(), HEARTBEAT_INTERVAL);
  }
  
  // Start polling for requests
  async startPolling() {
    if (this.isPolling) return;
    
    try {
      this.isPolling = true;
      
      // Continuous polling loop
      while (this.isConnected && this.clientId) {
        try {
          const response = await this.api.get(`${SERVER_URL}/poll/${this.clientId}`);
          
          // 204 No Content - no request to wait for, poll again
          if (response.status === 204) {
            continue;
          }
          
          // Request received, process it
          if (response.status === 200 && response.data) {
            await this.handleRequest(response.data);
          }
        } catch (error) {
          // Non-critical polling errors - retry
          if (error.response && error.response.status === 404) {
            // Client ID is no longer valid, re-register
            log.warn(`Client ID ${this.clientId} is no longer valid. Re-registering...`);
            this.handleDisconnect();
            break;
          } else if (!this.isConnected) {
            // Client connection lost - exit loop
            break;
          } else {
            // Other temporary errors - wait a while and retry
            log.error(`Polling error: ${error.message}. Retrying in ${POLL_INTERVAL}ms...`);
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
          }
        }
      }
    } finally {
      this.isPolling = false;
    }
  }
  
  // Handle incoming request from server
  async handleRequest(request) {
    log.request(`Received request ${colors.bright}${request.requestId}${colors.reset}: ${request.method} ${request.path}`);
    
    try {
      // Build full URL for internal API
      let url = `${TARGET_API}${request.path}`;
      
      // Add query parameters if present
      if (request.query && Object.keys(request.query).length > 0) {
        const queryParams = new URLSearchParams(request.query).toString();
        url += `?${queryParams}`;
      }
      
      // Prepare headers (filter out headers that should not be forwarded)
      const headers = { ...request.headers };
      delete headers.host;
      delete headers['content-length'];
      
      log.system(`Forwarding to: ${colors.underscore}${url}${colors.reset}`);
      
      // Create fresh agents for each request to ensure proxy settings are current
      const { httpAgent, httpsAgent } = createAgents();
      
      // Forward request to internal API
      const response = await axios({
        method: request.method,
        url: url,
        headers: headers,
        data: request.body,
        timeout: 25000,
        httpAgent,
        httpsAgent,
        validateStatus: () => true, // Don't throw on error status codes
      });
      
      log.response(`Response for ${colors.bright}${request.requestId}${colors.reset}: Status ${response.status}`);
      
      // Send response back to server
      await this.api.post(`${SERVER_URL}/response/${this.clientId}`, {
        requestId: request.requestId,
        statusCode: response.status,
        headers: response.headers,
        body: response.data
      });
    } catch (error) {
      log.error(`Error handling request ${request.requestId}: ${error.message}`);
      
      // Send error response back to server
      try {
        await this.api.post(`${SERVER_URL}/response/${this.clientId}`, {
          requestId: request.requestId,
          statusCode: 500,
          body: {
            error: 'Internal Server Error',
            message: error.message
          }
        });
      } catch (responseError) {
        log.error(`Failed to send error response: ${responseError.message}`);
      }
    }
  }
  
  // Handle disconnect/reconnect
  handleDisconnect() {
    log.warn(`Disconnected from server. Reconnecting in ${RECONNECT_INTERVAL/1000} seconds...`);
    
    // Clear existing stuff
    this.isConnected = false;
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    // Try to reconnect after delay
    setTimeout(() => {
      this.clientId = null;
      this.isRegistering = false;
      this.register();
    }, RECONNECT_INTERVAL);
  }
  
  // Start the client
  start() {
    this.register();
  }
}

// Show tunnel client banner
console.log(`
${colors.cyan}${colors.bright}┌─────────────────────────────────────────────────┐
│ ${colors.yellow}🔌 SOCKET TUNNEL CLIENT ${colors.cyan}                        │
│                                                 │
│ ${colors.reset}Advanced HTTP tunnel for secure API access${colors.cyan}       │
└─────────────────────────────────────────────────┘${colors.reset}
`);

// Start the client
log.info(`Starting Socket Tunnel client...`);
log.system(`Tunneling to: ${colors.underscore}${TARGET_API}${colors.reset}`);
log.system(`Server URL: ${colors.underscore}${SERVER_URL}${colors.reset}`);

const client = new LongPollingClient();
client.start();