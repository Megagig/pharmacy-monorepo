import logger from '../utils/logger';

async function testOpenRouterKey() {
    try {
        const apiKey = process.env.OPENROUTER_API_KEY;
        
        logger.info('OpenRouter API Key Check:', {
            hasKey: !!apiKey,
            keyLength: apiKey?.length || 0,
            keyPrefix: apiKey?.substring(0, 10) || 'none',
            keySuffix: apiKey?.substring(apiKey.length - 4) || 'none',
        });

        if (!apiKey) {
            logger.error('❌ OPENROUTER_API_KEY environment variable is not set');
            return;
        }

        // Test the API key with a simple request
        const response = await fetch('https://openrouter.ai/api/v1/models', {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
        });

        if (response.ok) {
            const data = await response.json() as any;
            logger.info('✅ OpenRouter API key is valid', {
                modelsCount: data.data?.length || 0,
            });
        } else {
            const errorData = await response.text();
            logger.error('❌ OpenRouter API key test failed', {
                status: response.status,
                statusText: response.statusText,
                error: errorData,
            });
        }

    } catch (error) {
        logger.error('❌ OpenRouter API key test error:', error);
    }
}

testOpenRouterKey()
    .then(() => {
        logger.info('✅ OpenRouter key test completed');
        process.exit(0);
    })
    .catch((error) => {
        logger.error('❌ OpenRouter key test failed:', error);
        process.exit(1);
    });