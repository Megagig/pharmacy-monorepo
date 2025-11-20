#!/bin/bash

# Quick test script for local Redis connection via SSH tunnel

echo "🧪 Testing Local Redis Connection (via SSH Tunnel)"
echo ""
echo "Prerequisites:"
echo "1. SSH tunnel must be running (./start-redis-tunnel.sh)"
echo "2. Using .env.local with localhost Redis URL"
echo ""

# Check if tunnel is active
if ! nc -z localhost 6379 2>/dev/null; then
    echo "❌ Redis tunnel is not active!"
    echo ""
    echo "Please run in another terminal:"
    echo "   ./start-redis-tunnel.sh"
    echo ""
    exit 1
fi

echo "✅ Redis tunnel is active"
echo ""

# Test with redis-cli if available
if command -v redis-cli &> /dev/null; then
    echo "🔍 Testing with redis-cli..."
    redis-cli -h localhost -p 6379 -a Makingexploit4life@247 ping
    echo ""
fi

# Test with Node.js script
echo "🔍 Testing with Node.js..."
node test-redis-connection.js

echo ""
echo "✅ All tests complete!"
