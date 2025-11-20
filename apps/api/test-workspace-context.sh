#!/bin/bash

# Test script to verify workspace context is loading correctly
# Run this after logging in to get your auth token

echo "🧪 Testing Workspace Context Loading"
echo "====================================="
echo ""

# Check if token is provided
if [ -z "$1" ]; then
    echo "❌ Please provide your auth token as an argument"
    echo "Usage: ./test-workspace-context.sh YOUR_AUTH_TOKEN"
    echo ""
    echo "To get your token:"
    echo "1. Login to the frontend"
    echo "2. Open browser DevTools (F12)"
    echo "3. Go to Application > Cookies"
    echo "4. Copy the 'token' cookie value"
    exit 1
fi

TOKEN="$1"
BASE_URL="http://localhost:5000"

echo "1️⃣  Clearing workspace cache..."
CLEAR_RESULT=$(curl -s -X POST "$BASE_URL/api/debug/clear-cache" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Cookie: token=$TOKEN")
echo "$CLEAR_RESULT" | jq '.' 2>/dev/null || echo "$CLEAR_RESULT"
echo ""

echo "2️⃣  Fetching fresh user info with workspace context..."
USER_INFO=$(curl -s "$BASE_URL/api/debug/user-info" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Cookie: token=$TOKEN")
echo "$USER_INFO" | jq '.' 2>/dev/null || echo "$USER_INFO"
echo ""

echo "3️⃣  Testing diagnostic cases endpoint..."
CASES_RESULT=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  "$BASE_URL/api/diagnostics/cases/all?page=1&limit=5" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Cookie: token=$TOKEN")

HTTP_STATUS=$(echo "$CASES_RESULT" | grep "HTTP_STATUS:" | cut -d':' -f2)
RESPONSE_BODY=$(echo "$CASES_RESULT" | sed '/HTTP_STATUS:/d')

if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ SUCCESS! Status: $HTTP_STATUS"
    echo "$RESPONSE_BODY" | jq '.success' 2>/dev/null || echo "$RESPONSE_BODY"
elif [ "$HTTP_STATUS" = "402" ]; then
    echo "❌ STILL FAILING! Status: $HTTP_STATUS"
    echo "$RESPONSE_BODY" | jq '.' 2>/dev/null || echo "$RESPONSE_BODY"
else
    echo "⚠️  Unexpected status: $HTTP_STATUS"
    echo "$RESPONSE_BODY"
fi

echo ""
echo "====================================="
echo "Test Complete!"
