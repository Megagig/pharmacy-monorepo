#!/bin/bash

# Update backend/.env with Upstash Redis URL
# This script helps you configure Upstash Redis locally

UPSTASH_URL='rediss://default:AUurAAIncDIzMWUwMTFiZDNjZmU0ODNiOWZjYmYxYTEzNjJkMzZiNHAyMTkzNzE@boss-octopus-19371.upstash.io:6379'

echo "🔧 Configuring Upstash Redis..."
echo ""

cd "$(dirname "$0")"

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    touch .env
fi

# Check if REDIS_URL already exists
if grep -q "^REDIS_URL=" .env; then
    echo "✏️  Updating existing REDIS_URL..."
    # Use sed to replace the line (works on both macOS and Linux)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s|^REDIS_URL=.*|REDIS_URL=\"${UPSTASH_URL}\"|" .env
    else
        # Linux
        sed -i "s|^REDIS_URL=.*|REDIS_URL=\"${UPSTASH_URL}\"|" .env
    fi
else
    echo "➕ Adding REDIS_URL to .env..."
    echo "" >> .env
    echo "# Upstash Redis Configuration" >> .env
    echo "REDIS_URL=\"${UPSTASH_URL}\"" >> .env
fi

echo "✅ REDIS_URL configured in .env"
echo ""
echo "📋 Current REDIS_URL:"
grep "^REDIS_URL=" .env
echo ""
echo "🧪 Running connection test..."
echo ""

# Export the variable for the test script
export REDIS_URL="${UPSTASH_URL}"

# Run the test script
node test-upstash-redis.js
