#!/bin/bash

# Replace all method checks at the beginning of functions
sed -i 's/if (!this\.redis || !this\.isConnected) {/if (!isRedisAvailable()) {\n            return false;\n        }\n\n        const redis = await getRedisClient();\n        if (!redis) {/g' RedisCacheService.ts

# Replace simple !this.redis checks  
sed -i 's/if (!this\.redis) {/if (!isRedisAvailable()) {\n            return false;\n        }\n\n        const redis = await getRedisClient();\n        if (!redis) {/g' RedisCacheService.ts

# Remove this.isConnected = false lines (no longer needed)
sed -i '/this\.isConnected = false;/d' RedisCacheService.ts

echo "Replacements complete"
