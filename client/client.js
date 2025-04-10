// client.js - Run this on your Remote Desktop machine
const WebSocket = require('ws');
const axios = require('axios');
const fetch = require('node-fetch');
const https = require('https');
const http = require('http');

// Configuration
const VERCEL_WSS_URL = 'wss://your-vercel-app.vercel.app';  // Replace with your Vercel app URL
const TARGET_API = 'http://localhost:8081';  // Your internal REST API
const RECONNECT_INTERVAL = 5000;  // Reconnect every 5 seconds if disconnected

// Proxy configuration (if needed)
// const PROXY_HOST = 'your-corporate-proxy.com';
// const PROXY_PORT = 8080;
// const PROXY_USER = 'username';
// const PROXY_PASS = 'password';

// Create HTTP/HTTPS agent for internal requests with proxy if needed
const httpAgent = new http.Agent({
  keepAlive: true,
  // You can add proxy settings here if needed
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  rejectUnauthorized: false,  // Set to true in production
  // You can add proxy settings here if needed
});

// Function to create WebSocket connection
function connectWebSocket() {
  console.log(`Connecting to ${VERCEL_WSS_URL}...`);
  
  // Create WebSocket connection to Vercel
  // If proxy is needed, you might need a WebSocket client with proxy support
  const ws = new WebSocket(VERCEL_WSS_URL, {
    // For proxy support:
    // agent: new HttpsProxyAgent(`http://${PROXY_USER}:${PROXY_PASS}@${PROXY_HOST}:${PROXY_PORT}`)
  });
  
  // Handle connection open
  ws.on('open', () => {
    console.log('Connected to Vercel server!');
  });
  
  // Handle messages from server
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
          validateStatus: () => true,  // Don't throw on error status codes
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
  
  // Handle ping (keep connection alive)
  ws.on('ping', () => {
    ws.pong();
  });
  
  // Handle errors
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
  
  // Handle disconnection
  ws.on('close', () => {
    console.log('Disconnected from server. Reconnecting...');
    setTimeout(connectWebSocket, RECONNECT_INTERVAL);
  });
  
  // Return the connection
  return ws;
}

// Start the client
console.log('Starting WebSocket client to connect to Vercel...');
connectWebSocket();