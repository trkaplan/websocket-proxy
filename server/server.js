// server.js for Vercel Node.js application
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const bodyParser = require('body-parser');

// Read API Key from environment variable
const API_KEY = process.env.API_KEY;

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Setup WebSocket server
const wss = new WebSocket.Server({ server });

// Enable CORS
app.use(cors());

// Parse JSON request bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Store connected clients (remote desktop machines)
const connectedClients = new Map();
let clientIdCounter = 1;

// Handle WebSocket connections from remote desktop machines
wss.on('connection', (ws) => {
  const clientId = clientIdCounter++;
  console.log(`Remote client ${clientId} connected`);
  
  // Store the connection
  connectedClients.set(clientId, {
    ws,
    isAlive: true,
    pendingRequests: new Map()
  });

  // Setup ping/pong to keep connection alive
  ws.on('pong', () => {
    const client = connectedClients.get(clientId);
    if (client) {
      client.isAlive = true;
    }
  });

  // Handle messages from the remote client
  ws.on('message', (message) => {
    try {
      const response = JSON.parse(message.toString());
      
      // Check if this is a response to a pending request
      if (response.requestId && connectedClients.has(clientId)) {
        const client = connectedClients.get(clientId);
        const pendingRequest = client.pendingRequests.get(response.requestId);
        
        if (pendingRequest) {
          // Send response back to the HTTP client
          const { res } = pendingRequest;
          
          res.status(response.statusCode || 200)
             .set(response.headers || {})
             .send(response.body || {});
          
          // Remove pending request
          client.pendingRequests.delete(response.requestId);
        }
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  // Handle disconnection
  ws.on('close', () => {
    console.log(`Remote client ${clientId} disconnected`);
    connectedClients.delete(clientId);
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error(`Error with client ${clientId}:`, error);
    connectedClients.delete(clientId);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  const clientCount = connectedClients.size;
  res.status(200).json({
    status: 'ok',
    connectedClients: clientCount,
    message: clientCount > 0 ? 'Ready to proxy requests' : 'Waiting for remote clients to connect'
  });
});

// Get list of connected clients
app.get('/clients', (req, res) => {
  const clients = Array.from(connectedClients.keys()).map(id => ({
    id,
    pendingRequests: connectedClients.get(id).pendingRequests.size
  }));
  
  res.status(200).json({
    connectedClients: clients
  });
});

// API proxy endpoint
app.all('/api/:clientId/*', async (req, res) => {
  // Extract client ID from URL
  const clientId = parseInt(req.params.clientId, 10);
  
  // --- API Key Check START ---
  if (API_KEY) {
    const providedKey = req.headers['authorization']?.split(' ')[1] || req.headers['x-api-key'];
    if (!providedKey || providedKey !== API_KEY) {
      console.warn(`Unauthorized attempt to access client ${clientId} from ${req.ip}`);
      return res.status(401).json({ error: 'Unauthorized', message: 'Valid API Key required' });
    }
  } else {
    // If API_KEY is not set in environment, log a warning but allow access (consider stricter policy in production)
    console.warn('API_KEY environment variable is not set. Server is running without API key protection.');
  }
  // --- API Key Check END ---

  // Check if client exists
  if (!connectedClients.has(clientId)) {
    return res.status(404).json({
      error: 'Remote client not connected',
      message: 'The specified remote client is not connected to the server'
    });
  }
  
  try {
    const client = connectedClients.get(clientId);
    
    // Generate a unique request ID
    const requestId = Date.now().toString() + Math.random().toString(36).substring(2, 15);
    
    // Extract request path (remove /api/:clientId prefix)
    const path = req.originalUrl.replace(`/api/${clientId}`, '');
    
    // Prepare request to forward
    const requestData = {
      requestId,
      method: req.method,
      path,
      headers: req.headers,
      body: req.body,
      query: req.query
    };
    
    // Store pending request with timeout
    const timeout = setTimeout(() => {
      if (client.pendingRequests.has(requestId)) {
        client.pendingRequests.delete(requestId);
        res.status(504).json({
          error: 'Gateway Timeout',
          message: 'Remote client did not respond in time'
        });
      }
    }, 30000); // 30 second timeout
    
    client.pendingRequests.set(requestId, { res, timeout });
    
    // Send request to remote client
    client.ws.send(JSON.stringify(requestData));
    
  } catch (error) {
    console.error('Error forwarding request:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to forward request to remote client'
    });
  }
});

// Keep connections alive with ping/pong
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
}, 30000);

// Handle server shutdown
server.on('close', () => {
  clearInterval(interval);
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// Export for Vercel
module.exports = app;