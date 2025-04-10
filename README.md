# WebSocket REST API Proxy

This project is a WebSocket-based proxy solution designed to provide secure external access to REST APIs within restricted network environments (behind firewalls or VPNs).

## Project Structure

```
/websocket-proxy/
├── /server/             # Server to be deployed to Vercel
│   ├── server.js        # Main server code
│   ├── package.json     # Dependencies
│   └── vercel.json      # Vercel configuration
│
├── /client/             # Client to run in restricted network
│   ├── client.js        # Client code
│   ├── package.json     # Dependencies
│   └── README.md        # Client documentation
│
└── README.md            # This file
```

## System Architecture

The system consists of two main components:

1. **Vercel WebSocket Server**
   - Handles API requests from the external world
   - Forwards requests to connected clients via WebSocket
   - Returns client responses as HTTP responses

2. **WebSocket Client**
   - Runs within the restricted network
   - Establishes WebSocket connection with Vercel server
   - Forwards requests to the internal REST API
   - Sends API responses back to the server via WebSocket

## Security

- API key-based authentication
- Secure protocol (WSS) for WebSocket connections
- Encryption for client-server communication
- Rate limiting support

## Installation

1. **Vercel Server Setup**
   - Follow the [Server README](./server/README.md)

2. **Client Setup**
   - Follow the [Client README](./client/README.md)

## Usage

1. Run the client application within the restricted network
2. Send HTTP requests to the Vercel server:
   ```
   https://your-vercel-app.vercel.app/api/1/your-endpoint
   ```
   Where:
   - `1`: Connected client's ID
   - `your-endpoint`: Internal REST API endpoint

## Health Check

- Server status: `GET https://your-vercel-app.vercel.app/health`
- Connected clients: `GET https://your-vercel-app.vercel.app/clients`

## License

This project is licensed under the MIT License. 