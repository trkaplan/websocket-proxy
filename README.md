# Socket Tunnel

This project is a tunnel solution designed to provide secure external access to REST APIs within restricted network environments (behind firewalls or VPNs).

## Project Structure

```
/socket-tunnel/
├── /server/             # Server to be deployed to Vercel
│   ├── server.js        # Main server code
│   ├── package.json     # Dependencies
│   └── .env.example     # Example environment configuration
│
├── /client/             # Client to run in restricted network
│   ├── client.js        # Client code
│   ├── package.json     # Dependencies
│   └── .env.example     # Example environment configuration
│
├── test-server.js       # Test server for local testing
└── README.md            # This file
```

## System Architecture

The system consists of two main components:

1. **Tunnel Server (Vercel)**
   - Handles API requests from the external world
   - Forwards requests to connected clients via Long Polling
   - Returns client responses as HTTP responses

2. **Tunnel Client**
   - Runs within the restricted network
   - Establishes connection with the server through HTTP Long Polling
   - Forwards requests to the internal REST API
   - Sends API responses back to the server

## Security

- API key-based authentication
- Secure protocol (HTTPS) for all communications
- Rate limiting support

## Installation

1. **Server Setup**
   - Clone this repository
   - Deploy the server to Vercel:
     ```bash
     cd server
     vercel
     ```
   - Configure the environment variables

2. **Client Setup**
   - Clone this repository on the machine with access to your internal API
   - Configure the client environment:
     ```bash
     cd client
     cp .env.example .env
     # Edit .env with your settings
     npm install
     ```

## Usage

1. Run the client application within the restricted network:
   ```bash
   node client/client.js
   ```

2. Send HTTP requests to the Vercel server:
   ```
   https://your-tunnel-server.vercel.app/api/1/your-endpoint
   ```
   Where:
   - `1`: Connected client's ID
   - `your-endpoint`: Internal REST API endpoint

## Health Check

- Server status: `GET https://your-tunnel-server.vercel.app/health`
- Connected clients: `GET https://your-tunnel-server.vercel.app/clients`

## Local Testing

To test the entire tunnel system locally before deploying:

1.  **Setup Environment Files:**
    *   Ensure you have a `.env` file in the `server` directory (copy from `server/.env.example` if needed).
        *   Set `API_KEY` (e.g., `your-secure-api-key`).
        *   Set `PORT` (e.g., `3000`).
    *   Ensure you have a `.env` file in the `client` directory (copy from `client/.env.example` if needed).
        *   Set `API_KEY` to match the server's key.
        *   Set `API_SERVER_URL` to your local server (e.g., `http://localhost:3000`).
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
    # Expected output: ... Registered with server. Client ID: 1
    ```
    *   Note the Client ID assigned by the server.

6.  **Test with `curl`:**
    Send a request to the local tunnel server's API endpoint, replacing `<CLIENT_ID>` with the ID from step 5:
    ```bash
    # Replace <CLIENT_ID> with the actual ID (e.g., 1, 4, etc.)
    # Replace <YOUR_API_KEY> with the key from server/.env
    curl -X GET "http://localhost:3000/api/<CLIENT_ID>/users/1" -H "X-API-Key: <YOUR_API_KEY>"
    ```
    *   You should receive the response from the `test-server.js`: `{"id":1,"name":"Test User","message":"Response from localhost:8088"}`.

This confirms the tunnel is working locally.

## License

This project is licensed under the MIT License. 