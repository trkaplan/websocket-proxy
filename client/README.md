# WebSocket Proxy Client

This application is the client component of the WebSocket REST API Proxy system. It runs within a restricted network environment (behind firewalls or VPN) and facilitates communication between external requests and internal REST APIs.

## Quick Start

1. Clone the repository:
   ```bash
   git clone https://github.com/trkaplan/websocket-proxy.git
   cd client
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set the following variables:
   ```
   VERCEL_WSS_URL=wss://your-app.vercel.app
   TARGET_API=http://localhost:8081
   RECONNECT_INTERVAL=5000
   API_KEY=your-secure-api-key
   ```

4. Start the client:
   ```bash
   node client.js
   ```

## Configuration

### Environment Variables
- `VERCEL_WSS_URL`: WebSocket URL of the Vercel application (e.g., wss://your-app.vercel.app)
- `TARGET_API`: Internal REST API URL (e.g., http://localhost:8081)
- `RECONNECT_INTERVAL`: Reconnection interval in milliseconds (default: 5000)
- `API_KEY`: API key for authentication (required)

### API Key Security
The API key is used to authenticate requests between the Vercel server and the client:
- Use a strong, randomly generated API key
- Keep the API key secret and never commit it to version control
- Use the same API key on both the Vercel server and client
- Consider rotating the API key periodically for enhanced security

## Features

- Automatic reconnection on connection loss
- Detailed request/response logging
- Error handling and reporting
- Proxy configuration support
- Health monitoring
- API key authentication

## Dependencies

- ws: WebSocket client
- axios: HTTP client
- node-fetch: Fetch API implementation

## Troubleshooting

1. Connection Issues:
   - Verify your `VERCEL_WSS_URL` is correct
   - Check if your network allows WebSocket connections
   - Ensure the Vercel server is running

2. API Key Issues:
   - Confirm the API key matches between server and client
   - Check if the API key is properly set in the `.env` file

3. Internal API Issues:
   - Verify the `TARGET_API` URL is accessible
   - Check if the internal API is running on the expected port

## Health Check

The client provides a health check endpoint at `/health` that returns the connection status and client information. You can use this to monitor the client's state.

For more detailed information about the system architecture and setup, please refer to the main project documentation. 