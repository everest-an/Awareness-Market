#!/bin/bash

# Start Memory Exchange Go Service

# Load environment variables
export DATABASE_URL="${DATABASE_URL}"
export API_KEY_SECRET="${API_KEY_SECRET:-default_secret_key}"
export PORT="${PORT:-8080}"

# Start the service
echo "Starting Memory Exchange Service on port $PORT..."
./memory-exchange
