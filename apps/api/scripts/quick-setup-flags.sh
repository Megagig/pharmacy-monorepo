#!/bin/bash

# Feature Flags Quick Setup Script
# This script populates all feature flags into the Feature Management UI

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║   🚀 Feature Flags Quick Setup                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Check if we're in the backend directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: This script must be run from the backend directory"
    echo "   Please run: cd backend && ./scripts/quick-setup-flags.sh"
    exit 1
fi

# Check if MONGODB_URI is set
if [ -z "$MONGODB_URI" ]; then
    echo "⚠️  Warning: MONGODB_URI environment variable not set"
    echo "   Loading from .env file..."
    
    if [ -f ".env" ]; then
        export $(grep -v '^#' .env | xargs)
        echo "✅ Environment variables loaded from .env"
    else
        echo "❌ Error: .env file not found"
        echo "   Please create a .env file with MONGODB_URI"
        exit 1
    fi
fi

echo ""
echo "📋 What this script will do:"
echo "   • Connect to MongoDB"
echo "   • Sync 40+ feature flags to database"
echo "   • Make all flags visible in the UI"
echo "   • Update existing flags with latest config"
echo ""
echo "⏱️  This will take approximately 10-15 seconds..."
echo ""

# Ask for confirmation
read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Setup cancelled"
    exit 1
fi

echo ""
echo "🔄 Running feature flags synchronization..."
echo ""

# Run the sync script
npx ts-node scripts/syncAllFeatureFlags.ts

# Check if successful
if [ $? -eq 0 ]; then
    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║   ✅ SUCCESS! Feature flags are now available in UI     ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo ""
    echo "📍 Next Steps:"
    echo ""
    echo "   1. Open your browser and navigate to:"
    echo "      👉 http://localhost:5173/admin/feature-management"
    echo ""
    echo "   2. Refresh the page (Ctrl+R or Cmd+R)"
    echo ""
    echo "   3. You should now see 40+ feature flags!"
    echo ""
    echo "   4. You can now manage all flags from the UI:"
    echo "      • Enable/disable features"
    echo "      • Assign to subscription tiers"
    echo "      • Assign to user roles"
    echo "      • Edit descriptions and metadata"
    echo ""
    echo "💡 Tip: Use the 'Tier Management' tab to bulk-assign features to tiers"
    echo ""
    echo "📚 For more info, see: FEATURE_FLAGS_UI_MANAGEMENT_GUIDE.md"
    echo ""
else
    echo ""
    echo "❌ Setup failed. Please check the error messages above."
    echo ""
    echo "Common issues:"
    echo "   • MongoDB not running: sudo systemctl start mongod"
    echo "   • Wrong MONGODB_URI: check your .env file"
    echo "   • Missing dependencies: npm install"
    echo ""
    exit 1
fi
