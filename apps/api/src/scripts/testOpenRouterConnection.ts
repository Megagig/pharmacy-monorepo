import axios from 'axios';
import logger from '../utils/logger';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testOpenRouterConnection() {
    try {
        const apiKey = process.env.OPENROUTER_API_KEY;
        
        console.log('🔍 OpenRouter API Key Test');
        console.log('========================');
        console.log('API Key exists:', !!apiKey);
        console.log('API Key length:', apiKey?.length || 0);
        console.log('API Key prefix:', apiKey?.substring(0, 15) || 'none');
        console.log('API Key suffix:', apiKey?.substring(apiKey.length - 10) || 'none');
        console.log('');

        if (!apiKey) {
            console.log('❌ No API key found in environment variables');
            return;
        }

        // Test 1: Check models endpoint (simpler test)
        console.log('🧪 Test 1: Checking models endpoint...');
        try {
            const modelsResponse = await axios.get('https://openrouter.ai/api/v1/models', {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                timeout: 10000
            });

            console.log('✅ Models endpoint successful');
            console.log('Available models count:', modelsResponse.data.data?.length || 0);
            
            // Check if deepseek model is available
            const deepseekModels = modelsResponse.data.data?.filter((model: any) => 
                model.id.includes('deepseek')
            ) || [];
            console.log('DeepSeek models available:', deepseekModels.length);
            deepseekModels.forEach((model: any) => {
                console.log(`- ${model.id}`);
            });

        } catch (error: any) {
            console.log('❌ Models endpoint failed');
            console.log('Status:', error.response?.status);
            console.log('Status Text:', error.response?.statusText);
            console.log('Error Data:', JSON.stringify(error.response?.data, null, 2));
            console.log('');
        }

        // Test 2: Simple chat completion test
        console.log('🧪 Test 2: Testing chat completion...');
        try {
            const chatResponse = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
                model: 'deepseek/deepseek-chat-v3.1:free',
                messages: [
                    {
                        role: 'user',
                        content: 'Hello, this is a test message. Please respond with "Test successful".'
                    }
                ],
                max_tokens: 50
            }, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:5173',
                    'X-Title': 'PharmacyCopilot SaaS - API Test'
                },
                timeout: 30000
            });

            console.log('✅ Chat completion successful');
            console.log('Response:', chatResponse.data.choices?.[0]?.message?.content);

        } catch (error: any) {
            console.log('❌ Chat completion failed');
            console.log('Status:', error.response?.status);
            console.log('Status Text:', error.response?.statusText);
            console.log('Error Data:', JSON.stringify(error.response?.data, null, 2));
            
            // Additional debugging
            if (error.response?.status === 401) {
                console.log('');
                console.log('🔍 401 Error Analysis:');
                console.log('- This usually means the API key is invalid or expired');
                console.log('- Check if the API key was copied correctly');
                console.log('- Verify the API key is active in your OpenRouter dashboard');
                console.log('- Make sure there are no extra spaces or characters');
            }
        }

        // Test 3: Check account/credits
        console.log('');
        console.log('🧪 Test 3: Checking account status...');
        try {
            const accountResponse = await axios.get('https://openrouter.ai/api/v1/auth/key', {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                timeout: 10000
            });

            console.log('✅ Account check successful');
            console.log('Account data:', JSON.stringify(accountResponse.data, null, 2));

        } catch (error: any) {
            console.log('❌ Account check failed');
            console.log('Status:', error.response?.status);
            console.log('Error Data:', JSON.stringify(error.response?.data, null, 2));
        }

    } catch (error) {
        console.log('❌ Test failed with error:', error);
    }
}

// Run the test
testOpenRouterConnection()
    .then(() => {
        console.log('\n✅ OpenRouter connection test completed');
        process.exit(0);
    })
    .catch((error) => {
        console.log('\n❌ OpenRouter connection test failed:', error);
        process.exit(1);
    });