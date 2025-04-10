#!/bin/bash

# Variables from server/.env.example
ENV_VARS=(
  "PORT"
  "NODE_ENV"
  "PING_INTERVAL"
  "PONG_TIMEOUT"
  "API_KEY"
  "RATE_LIMIT_WINDOW"
  "RATE_LIMIT_MAX_REQUESTS"
  "LOG_LEVEL"
)

# Default values (you can modify these)
DEFAULT_VALUES=(
  "3000"
  "production"
  "30000"
  "10000"
  "generate-a-secure-api-key"
  "60000"
  "100"
  "info"
)

echo "Adding environment variables to Vercel project for PRODUCTION environment..."
echo "Press Enter to accept the default value or type a new value."

for i in "${!ENV_VARS[@]}"; do
  VAR=${ENV_VARS[$i]}
  DEFAULT=${DEFAULT_VALUES[$i]}
  
  echo ""
  echo "Variable: $VAR"
  echo "Default value: $DEFAULT"
  read -p "Enter value (or press Enter for default): " VALUE
  
  # Use default if no value provided
  VALUE=${VALUE:-$DEFAULT}
  
  # Add to Vercel for production environment
  echo "Adding $VAR with value: $VALUE for production"
  echo $VALUE | vercel env add $VAR production
done

echo ""
echo "Environment variables have been added to your Vercel project for PRODUCTION!"
echo "Run 'vercel env ls' to verify the variables." 