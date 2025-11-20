#!/bin/bash

# Redis SSH Tunnel Helper Script
# This creates a secure tunnel to your VPS Redis server

echo "🔐 Starting Redis SSH Tunnel..."
echo ""
echo "This will create a secure connection to your VPS Redis server"
echo "Keep this terminal window open while developing"
echo ""
echo "Press Ctrl+C to stop the tunnel"
echo ""

# Check if SSH key exists
if [ ! -f ~/.ssh/id_rsa ] && [ ! -f ~/.ssh/id_ed25519 ]; then
    echo "⚠️  No SSH key found. You'll need to enter your password."
    echo ""
fi

# Start SSH tunnel
# Format: ssh -L local_port:remote_host:remote_port user@server -N
# -L: Local port forwarding
# -N: Don't execute remote command (just forward ports)
# -v: Verbose (optional, remove if too noisy)

echo "📡 Connecting to 46.202.141.1..."
echo "   Local port 6379 → VPS Redis port 6379"
echo ""

ssh -L 6379:localhost:6379 root@46.202.141.1 -N

# If tunnel closes
echo ""
echo "❌ Tunnel closed"
