// client.js - Run this in a restricted network environment
require('dotenv').config(); // Load .env file

const WebSocket = require('ws');
const axios = require('axios');
const fetch = require('node-fetch');
const https = require('https');
const http = require('http');
const HttpsProxyAgent = require('https-proxy-agent');
const { getProxyForUrl } = require('proxy-from-env');

// Configuration
const VERCEL_WSS_URL = process.env.VERCEL_WSS_URL;  // Read from .env file
const TARGET_API = process.env.TARGET_API;  // Read from .env file
const API_KEY = process.env.API_KEY; // Read API key from .env file
const RECONNECT_INTERVAL = 5000;  // Reconnect every 5 seconds if disconnected

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

// Function to create WebSocket connection
function connectWebSocket() {
  log.info(`Connecting to ${colors.underscore}${VERCEL_WSS_URL}${colors.reset}...`);

  // Get system proxy for WebSocket connection
  const wsProxy = getSystemProxy(VERCEL_WSS_URL);

  // Create WebSocket connection options, including the API key header
  const wsOptions = {
    headers: {
      'X-API-Key': API_KEY // Send API key during handshake
    }
  };

  // If system proxy is detected, use it for WebSocket
  if (wsProxy) {
    log.system(`Using system proxy for WebSocket: ${wsProxy}`);
    wsOptions.agent = new HttpsProxyAgent(wsProxy);
  }

  // Log options just before connecting for debugging
  log.debug(`WebSocket Options: ${JSON.stringify(wsOptions, null, 2)}`);

  // Create the WebSocket connection
  const ws = new WebSocket(VERCEL_WSS_URL, wsOptions);

  // Handle connection open
  ws.on('open', () => {
    log.success(`Connected to WebSocket server: ${colors.underscore}${VERCEL_WSS_URL}${colors.reset}`);
  });

  // Handle messages from server (restore original logic)
  ws.on('message', async (data) => {
    try {
      const request = JSON.parse(data.toString());
      log.request(`Received request ${colors.bright}${request.requestId}${colors.reset}: ${request.method} ${request.path}`);

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
      // Keep the API key header sent by the server
      // delete headers['x-api-key'];

      // Create fresh agents for each request to ensure proxy settings are current
      const { httpAgent, httpsAgent } = createAgents();

      try {
        log.system(`Forwarding to: ${colors.underscore}${url}${colors.reset}`);
        
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
        
        // Send response back to Vercel
        ws.send(JSON.stringify({
          requestId: request.requestId,
          statusCode: response.status,
          headers: response.headers,
          body: response.data
        }));

      } catch (error) {
        log.error(`Error forwarding request ${request.requestId}: ${error.message}`);

        // Send error response back to Vercel
        ws.send(JSON.stringify({
          requestId: request.requestId,
          statusCode: 500,
          body: {
            error: 'Internal Server Error',
            message: error.message
          }
        }));
      }

    } catch (error) {
      log.error(`Error processing message: ${error.message}`);
    }
  });

  // Handle ping (keep connection alive - restore original logic)
  ws.on('ping', () => {
    ws.pong();
  });

  // Handle errors (restore original logic, keep hint)
  ws.on('error', (error) => {
    log.error(`WebSocket error: ${error.message}`);
    if (error.message.includes('401')) {
      log.warn(`Check if the API key in client/.env matches the one set in server environment variables.`);
    }
    // Note: We don't reconnect on all errors, only on close.
  });

  // Handle disconnection (restore original logic)
  ws.on('close', () => {
    log.warn(`Disconnected from server. Reconnecting in ${RECONNECT_INTERVAL/1000} seconds...`);
    // Clean up resources if needed before reconnecting
    setTimeout(connectWebSocket, RECONNECT_INTERVAL);
  });

  // Return the connection (optional, not strictly needed here)
  // return ws;
}

// Show tunnel client banner
console.log(`
${colors.cyan}${colors.bright}┌─────────────────────────────────────────────────┐
│ ${colors.yellow}🔌 SOCKET TUNNEL CLIENT ${colors.cyan}                        │
│                                                 │
│ ${colors.reset}Advanced WebSocket tunnel for secure API access${colors.cyan} │
└─────────────────────────────────────────────────┘${colors.reset}
`);

// Start the client
log.info(`Starting Socket Tunnel client...`);
log.system(`Tunneling to: ${colors.underscore}${TARGET_API}${colors.reset}`);
log.system(`Server URL: ${colors.underscore}${VERCEL_WSS_URL}${colors.reset}`);
connectWebSocket();