// server.js for Vercel Node.js application
require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');

// Environment variables with default values
const {
  PORT = 3000,
  NODE_ENV = 'development',
  WS_PATH = '/ws',
  PING_INTERVAL = 30000,
  PONG_TIMEOUT = 10000,
  API_KEY,
  RATE_LIMIT_WINDOW = 60000,
  RATE_LIMIT_MAX_REQUESTS = 100,
  LOG_LEVEL = 'info'
} = process.env;

// Configure logging levels and functions
const logLevels = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};
const currentLogLevel = logLevels[LOG_LEVEL] || logLevels.info;

const log = (level, message, ...args) => {
  if (logLevels[level] >= currentLogLevel) {
    console[level](message, ...args);
  }
};

// Initialize Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Middleware to validate API key
const checkApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    log('debug', `Checking API Key. Provided: ${apiKey ? 'Yes' : 'No'}`);
    if (!API_KEY) {
      log('warn', 'API_KEY is not set in the environment. Allowing request without check.');
      return next(); // Allow if server has no key configured (development/testing)
    }
    if (!apiKey || apiKey !== API_KEY) {
        log('warn', `Unauthorized access attempt. Provided Key: ${apiKey}`);
        return res.status(401).json({ error: 'Unauthorized', message: 'Invalid API Key' });
    }
    log('debug', 'API Key validated successfully.');
    next();
};

// Function to verify WebSocket client during handshake
const verifyClient = (info, done) => {
  const apiKey = info.req.headers['x-api-key'];
  log('debug', `Verifying WebSocket connection. Provided API Key: ${apiKey ? 'Yes' : 'No'}`);
  if (!API_KEY) {
      log('warn', 'API_KEY is not set in the environment. Allowing WS connection without check.');
      return done(true); // Allow if server has no key configured
  }
  if (apiKey && apiKey === API_KEY) {
    log('debug', 'WebSocket API Key validated successfully.');
    done(true); // API key is valid
  } else {
    log('warn', `WebSocket connection rejected. Invalid API Key provided: ${apiKey}`);
    done(false, 401, 'Unauthorized: Invalid API Key'); // Reject connection
  }
};

// Setup WebSocket server with custom path and client verification
const wss = new WebSocket.Server({ 
  server,
  path: WS_PATH,
  verifyClient: verifyClient // Add verification hook
});

// Enable CORS for cross-origin requests
app.use(cors());

// Parse JSON and URL-encoded request bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Setup rate limiting middleware
const limiter = rateLimit({
  windowMs: parseInt(RATE_LIMIT_WINDOW),
  max: parseInt(RATE_LIMIT_MAX_REQUESTS),
  message: { error: 'Too many requests, please try again later.' }
});
app.use(limiter);

// Store connected WebSocket clients
const connectedClients = new Map();
let clientIdCounter = 1;

// Handle WebSocket connections
wss.on('connection', (ws, req) => {
  const clientId = clientIdCounter++;
  // Extract client IP from headers if possible (useful for logging)
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  log('info', `Remote client ${clientId} connected from ${clientIp}`);
  
  // Store client connection with metadata
  connectedClients.set(clientId, {
    ws,
    isAlive: true,
    pendingRequests: new Map()
  });

  // Setup ping/pong heartbeat
  ws.on('pong', () => {
    const client = connectedClients.get(clientId);
    if (client) {
      client.isAlive = true;
    }
  });

  // Handle incoming messages from clients
  ws.on('message', (message) => {
    try {
      const response = JSON.parse(message.toString());
      
      // Process response for pending requests
      if (response.requestId && connectedClients.has(clientId)) {
        const client = connectedClients.get(clientId);
        const pendingRequest = client.pendingRequests.get(response.requestId);
        
        if (pendingRequest) {
          // Send response back to HTTP client
          const { res } = pendingRequest;
          
          res.status(response.statusCode || 200)
             .set(response.headers || {})
             .send(response.body || {});
          
          // Clean up pending request
          client.pendingRequests.delete(response.requestId);
        }
      }
    } catch (error) {
      log('error', 'Error processing message:', error);
    }
  });

  // Handle client disconnection
  ws.on('close', () => {
    log('info', `Remote client ${clientId} disconnected`);
    connectedClients.delete(clientId);
  });

  // Handle WebSocket errors
  ws.on('error', (error) => {
    log('error', `Error with client ${clientId}:`, error);
    connectedClients.delete(clientId);
  });
});

// Health check endpoint
app.get('/health', checkApiKey, (req, res) => {
  const clientCount = connectedClients.size;
  res.status(200).json({
    status: 'ok',
    environment: NODE_ENV,
    connectedClients: clientCount,
    message: clientCount > 0 ? 'Ready to proxy requests' : 'Waiting for remote clients to connect'
  });
});

// List connected clients endpoint
app.get('/clients', checkApiKey, (req, res) => {
  const clients = Array.from(connectedClients.keys()).map(id => ({
    id,
    pendingRequests: connectedClients.get(id).pendingRequests.size
  }));
  
  res.status(200).json({
    connectedClients: clients
  });
});

// API proxy endpoint for forwarding requests
app.all('/api/:clientId/*', checkApiKey, async (req, res) => {
  // Extract client ID from URL
  const clientId = parseInt(req.params.clientId, 10);
  
  // Validate client connection
  if (!connectedClients.has(clientId)) {
    return res.status(404).json({
      error: 'Remote client not connected',
      message: 'The specified remote client is not connected to the server'
    });
  }
  
  try {
    const client = connectedClients.get(clientId);
    
    // Generate unique request ID
    const requestId = Date.now().toString() + Math.random().toString(36).substring(2, 15);
    
    // Extract target path
    const path = req.originalUrl.replace(`/api/${clientId}`, '');
    
    // Prepare request data
    const requestData = {
      requestId,
      method: req.method,
      path,
      headers: req.headers,
      body: req.body,
      query: req.query
    };
    
    // Set request timeout
    const timeout = setTimeout(() => {
      if (client.pendingRequests.has(requestId)) {
        client.pendingRequests.delete(requestId);
        res.status(504).json({
          error: 'Gateway Timeout',
          message: 'Remote client did not respond in time'
        });
      }
    }, parseInt(PONG_TIMEOUT));
    
    // Store pending request
    client.pendingRequests.set(requestId, { res, timeout });
    
    // Forward request to client
    client.ws.send(JSON.stringify(requestData));
    
  } catch (error) {
    log('error', 'Error forwarding request:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to forward request to remote client'
    });
  }
});

// Keep WebSocket connections alive
const interval = setInterval(() => {
  connectedClients.forEach((client, id) => {
    if (client.isAlive === false) {
      client.ws.terminate();
      connectedClients.delete(id);
      return;
    }
    
    client.isAlive = false;
    client.ws.ping();
  });
}, parseInt(PING_INTERVAL));

// Clean up on server shutdown
server.on('close', () => {
  clearInterval(interval);
});

// Start the server
server.listen(PORT, () => {
  log('info', `Server listening on port ${PORT} in ${NODE_ENV} mode`);
});

// Export for Vercel
module.exports = app;