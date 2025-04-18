# Socket Tunnel Server

This is the server component of the Socket Tunnel system. It runs on Vercel and handles external HTTP requests, forwarding them to connected clients using long polling.

## Quick Start

1. Clone the repository:
   ```bash
   git clone https://github.com/trkaplan/websocket-proxy.git
   cd server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and configure the following variables:
   ```
   # Server Configuration
   PORT=3000
   NODE_ENV=development

   # Long Polling Configuration
   PING_INTERVAL=30000
   PONG_TIMEOUT=10000

   # Security
   API_KEY=your-secure-api-key
   RATE_LIMIT_WINDOW=60000
   RATE_LIMIT_MAX_REQUESTS=100

   # Logging
   LOG_LEVEL=info
   ```

4. Start the server:
   ```bash
   npm start
   ```

## Configuration

### Environment Variables

#### Server Configuration
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (development/production)

#### Long Polling Configuration
- `PING_INTERVAL`: Ping interval in milliseconds (default: 30000)
- `PONG_TIMEOUT`: Pong timeout in milliseconds (default: 10000)

#### Security
- `API_KEY`: API key for client authentication (must match client's API key)
- `RATE_LIMIT_WINDOW`: Rate limit window in milliseconds (default: 60000)
- `RATE_LIMIT_MAX_REQUESTS`: Maximum requests per window (default: 100)

#### Logging
- `LOG_LEVEL`: Logging level (debug/info/warn/error)

## Features

- Long polling implementation
- HTTP request forwarding
- Client connection management
- API key authentication
- Rate limiting
- Health check endpoints
- Detailed logging

## Dependencies

- express: Web framework
- cors: CORS middleware
- body-parser: Request body parsing
- dotenv: Environment variables

## API Endpoints

- `GET /health`: Server health check
- `GET /clients`: List connected clients
- `POST /register`: Register a new client
- `POST /heartbeat/:clientId`: Client heartbeat
- `GET /poll/:clientId`: Long polling endpoint
- `POST /response/:clientId`: Client response endpoint
- `POST /api/:clientId/*`: Forward request to specific client

## Testing

To test the server and client setup, you can use the following curl command to send a request to the `users/1` endpoint through the client:

```bash
curl http://localhost:3000/api/3/users/1
```

Replace `3` with the actual client ID if it differs.

## Deployment

This server is designed to be deployed on Vercel. Follow these steps:

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Configure environment variables in Vercel dashboard
4. Deploy!

For more detailed information about the system architecture and setup, please refer to the main project documentation. 