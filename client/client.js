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

// Get system proxy settings
const getSystemProxy = (url) => {
  try {
    // Try to get proxy from environment variables
    const proxyUrl = getProxyForUrl(url);
    console.log(`System proxy detected: ${proxyUrl || 'None'}`);
    return proxyUrl;
  } catch (error) {
    console.error('Error detecting system proxy:', error.message);
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
    console.log(`Using system proxy for internal requests: ${targetProxy}`);
    httpsAgent = new HttpsProxyAgent(targetProxy);
  }
  
  return { httpAgent, httpsAgent };
};

// Function to create WebSocket connection
function connectWebSocket() {
  console.log(`Connecting to ${VERCEL_WSS_URL}...`);

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
    console.log(`Using system proxy for WebSocket: ${wsProxy}`);
    wsOptions.agent = new HttpsProxyAgent(wsProxy);
  }

  // Create the WebSocket connection
  const ws = new WebSocket(VERCEL_WSS_URL, wsOptions);

  // Handle connection open
  ws.on('open', () => {
    console.log('Connected to Vercel server!');
  });

  // Handle messages from server (restore original logic)
  ws.on('message', async (data) => {
    try {
      const request = JSON.parse(data.toString());
      console.log(`Received request ${request.requestId}: ${request.method} ${request.path}`);

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

        // Send response back to Vercel
        ws.send(JSON.stringify({
          requestId: request.requestId,
          statusCode: response.status,
          headers: response.headers,
          body: response.data
        }));

      } catch (error) {
        console.error(`Error forwarding request ${request.requestId}:`, error.message);

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
      console.error('Error processing message:', error);
    }
  });

  // Handle ping (keep connection alive - restore original logic)
  ws.on('ping', () => {
    ws.pong();
  });

  // Handle errors (restore original logic, keep hint)
  ws.on('error', (error) => {
    console.error('\x1b[31m%s\x1b[0m', 'WebSocket error: ' + error.message); // Red color for error
    if (error.message.includes('401')) {
      console.log('\x1b[33m%s\x1b[0m', 'Hint: Check if the API key in client/.env matches the one set in Vercel environment variables.'); // Yellow color for hint
    }
    // Note: We don't reconnect on all errors, only on close.
  });

  // Handle disconnection (restore original logic)
  ws.on('close', () => {
    console.log('\x1b[33m%s\x1b[0m', 'Disconnected from server. Reconnecting...'); // Yellow color for warning
    // Clean up resources if needed before reconnecting
    setTimeout(connectWebSocket, RECONNECT_INTERVAL);
  });

  // Return the connection (optional, not strictly needed here)
  // return ws;
}

// Start the client
console.log('\x1b[36m%s\x1b[0m', 'Starting WebSocket client to connect to Vercel...'); // Cyan color for info
connectWebSocket();