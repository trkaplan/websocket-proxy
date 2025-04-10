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

## Local Testing

To test the entire tunnel system locally before deploying:

1.  **Setup Environment Files:**
    *   Ensure you have a `.env` file in the `server` directory (copy from `server/.env.example` if needed).
        *   Set `API_KEY` (e.g., `your-secure-api-key`).
        *   Set `PORT` (e.g., `3000`).
    *   Ensure you have a `.env` file in the `client` directory (copy from `client/.env.example` if needed).
        *   Set `API_KEY` to match the server's key.
        *   Set `VERCEL_WSS_URL` to your local server (e.g., `ws://localhost:3000/ws`).
        *   Set `TARGET_API` to the local target you want to tunnel to (e.g., `http://localhost:8088`).

2.  **Install Dependencies:**
    *   Run `npm install` in the `server` directory.
    *   Run `npm install` in the `client` directory.

3.  **Start the Local Target Server:**
    A simple test server (`test-server.js`) is included. Run it in a terminal:
    ```bash
    node test-server.js 
    # Expected output: Test server listening on http://localhost:8088
    ```

4.  **Start the Local Tunnel Server:**
    Run the main server in another terminal:
    ```bash
    cd server
    node server.js
    # Expected output: Server listening on port 3000...
    ```

5.  **Start the Tunnel Client:**
    Run the client in a third terminal:
    ```bash
    cd client
    node client.js
    # Expected output: ... Connected to WebSocket server: ws://localhost:3000/ws
    ```
    *   Note the Client ID assigned by the server in its logs (e.g., `Remote client 1 connected...`).

6.  **Test with `curl`:**
    Send a request to the local tunnel server's API endpoint, replacing `<CLIENT_ID>` with the ID from the server logs:
    ```bash
    # Replace <CLIENT_ID> with the actual ID (e.g., 1, 4, etc.)
    # Replace <YOUR_API_KEY> with the key from server/.env
    curl -X GET "http://localhost:3000/api/<CLIENT_ID>/users/1" -H "X-API-Key: <YOUR_API_KEY>"
    ```
    *   You should receive the response from the `test-server.js`: `{"id":1,"name":"Test User","message":"Response from localhost:8088"}`.

This confirms the tunnel is working locally.

## License

This project is licensed under the MIT License. 