// server.js for Vercel Node.js application
require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');

// Environment variables with default values
const {
  PORT = 3000,
  NODE_ENV = 'development',
  PING_INTERVAL = 30000,
  PONG_TIMEOUT = 10000,
  API_KEY,
  RATE_LIMIT_WINDOW = 60000,
  RATE_LIMIT_MAX_REQUESTS = 100,
  LOG_LEVEL = 'info'
} = process.env;

// --- DEBUG LOGGING: Log the API Key the server has loaded --- 
console.log(`[DEBUG] Server loaded API_KEY: ${API_KEY ? ('******' + API_KEY.slice(-4)) : 'Not Set'}`);
// --- END DEBUG LOGGING --- 

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

// Middleware to validate API key
const checkApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    log('debug', `Checking API Key. Provided: ${apiKey ? 'Yes' : 'No'}`);
    if (!apiKey || apiKey !== API_KEY) {
        log('warn', `Unauthorized access attempt. Provided Key: ${apiKey}`);
        return res.status(401).json({ error: 'Unauthorized', message: 'Invalid API Key' });
    }
    log('debug', 'API Key validated successfully.');
    next();
};

// Queue for storing pending requests per client
const connectedClients = new Map();
let clientIdCounter = 1;

// Long Polling Client Registration Endpoint
app.post('/register', checkApiKey, (req, res) => {
  const clientId = clientIdCounter++;
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  
  log('info', `Remote client ${clientId} registered from ${clientIp}`);
  
  connectedClients.set(clientId, {
    pendingRequests: new Map(),
    pendingPolls: [],   // Array for clients waiting on long polling
    isAlive: true,
    lastSeen: Date.now()
  });
  
  res.status(200).json({
    status: 'ok',
    clientId,
    message: 'Client registered successfully'
  });
});

// Long Polling Client Heartbeat
app.post('/heartbeat/:clientId', checkApiKey, (req, res) => {
  const clientId = parseInt(req.params.clientId, 10);
  
  if (!connectedClients.has(clientId)) {
    return res.status(404).json({
      error: 'Client not found',
      message: 'The specified client is not registered'
    });
  }
  
  const client = connectedClients.get(clientId);
  client.isAlive = true;
  client.lastSeen = Date.now();
  
  res.status(200).json({
    status: 'ok',
    message: 'Heartbeat received'
  });
});

// Long Polling Endpoint - For client to wait for requests
app.get('/poll/:clientId', checkApiKey, (req, res) => {
  const clientId = parseInt(req.params.clientId, 10);
  
  if (!connectedClients.has(clientId)) {
    return res.status(404).json({
      error: 'Client not found',
      message: 'The specified client is not registered'
    });
  }
  
  const client = connectedClients.get(clientId);
  client.isAlive = true;
  client.lastSeen = Date.now();
  
  // Check if client has a pending request
  if (client.pendingRequests.size > 0) {
    // Get the first pending request
    const [requestId, requestData] = Array.from(client.pendingRequests.entries())[0];
    client.pendingRequests.delete(requestId);
    
    log('info', `Sending pending request ${requestId} to client ${clientId}`);
    return res.status(200).json(requestData);
  }
  
  // If no pending request, use long polling
  const timeoutDuration = parseInt(PONG_TIMEOUT);
  const pollTimeout = setTimeout(() => {
    // On timeout, remove client from poll list and send empty response
    client.pendingPolls = client.pendingPolls.filter(poll => poll !== res);
    res.status(204).end(); // No Content - signal to client that there's "nothing to wait for"
  }, timeoutDuration);
  
  // Add client to polling array
  client.pendingPolls.push(res);
  
  // Clean up when request is closed or cancelled
  req.on('close', () => {
    clearTimeout(pollTimeout);
    client.pendingPolls = client.pendingPolls.filter(poll => poll !== res);
  });
});

// Endpoint for responses from client
app.post('/response/:clientId', checkApiKey, (req, res) => {
  const clientId = parseInt(req.params.clientId, 10);
  const { requestId, statusCode, headers, body } = req.body;
  
  if (!connectedClients.has(clientId)) {
    return res.status(404).json({
      error: 'Client not found',
      message: 'The specified client is not registered'
    });
  }
  
  const client = connectedClients.get(clientId);
  const pendingRequest = client.pendingRequests.get(requestId);
  
  if (pendingRequest && pendingRequest.res) {
    // Send HTTP response to client
    const response = pendingRequest.res;
    
    response.status(statusCode || 200)
     .set(headers || {})
     .send(body || {});
    
    // Clean up the pending request
    clearTimeout(pendingRequest.timeout);
    client.pendingRequests.delete(requestId);
  }
  
  res.status(200).json({
    status: 'ok',
    message: 'Response processed'
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
    pendingRequests: connectedClients.get(id).pendingRequests.size,
    lastSeen: new Date(connectedClients.get(id).lastSeen).toISOString()
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
    
    // If client has a pending poll request, send this request there
    if (client.pendingPolls.length > 0) {
      const pollRes = client.pendingPolls.shift();
      log('info', `Sending request ${requestId} to waiting poll for client ${clientId}`);
      pollRes.status(200).json(requestData);
    }
    
  } catch (error) {
    log('error', 'Error forwarding request:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to forward request to remote client'
    });
  }
});

// Inactive client cleanup
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  const maxAge = parseInt(PING_INTERVAL) * 2; // 2x the ping interval
  
  connectedClients.forEach((client, id) => {
    if (now - client.lastSeen > maxAge) {
      log('info', `Cleaning up inactive client ${id}`);
      
      // Clean up all pending requests
      client.pendingRequests.forEach(request => {
        if (request.timeout) clearTimeout(request.timeout);
        if (request.res) {
          request.res.status(504).json({
            error: 'Gateway Timeout',
            message: 'Remote client disconnected'
          });
        }
      });
      
      // Clean up pending poll requests
      client.pendingPolls.forEach(pollRes => {
        pollRes.status(410).json({
          error: 'Gone',
          message: 'Client disconnected'
        });
      });
      
      connectedClients.delete(id);
    }
  });
}, parseInt(PING_INTERVAL));

// Clean up on server shutdown
server.on('close', () => {
  clearInterval(cleanupInterval);
});

// Start the server
server.listen(PORT, () => {
  log('info', `Server listening on port ${PORT} in ${NODE_ENV} mode`);
});

// Export for Vercel
module.exports = app;

app.set('trust proxy', true);