// Quick test of our interaction service fix
import axios from 'axios';

const RXNAV_BASE_URL = 'https://rxnav.nlm.nih.gov/REST/interaction';

async function testInteractionService() {
  console.log('🧪 Testing Interaction Service Fix');
  console.log('='.repeat(50));
  
  // Test ingredient mapping first
  const productRxCUIs = ['855290', '1052678']; // Warfarin + Aspirin products
  
  console.log('📋 Testing ingredient mapping...');
  
  for (const rxcui of productRxCUIs) {
    try {
      const response = await axios.get(`https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/related.json`, {
        params: { tty: 'IN' },
        timeout: 10000,
      });
      
      const relatedGroup = response.data?.relatedGroup;
      if (relatedGroup?.conceptGroup) {
        const ingredientGroup = relatedGroup.conceptGroup.find(group => group.tty === 'IN');
        if (ingredientGroup?.conceptProperties) {
          console.log(`✅ RxCUI ${rxcui} ingredients:`);
          ingredientGroup.conceptProperties.forEach(prop => {
            console.log(`   -> ${prop.name} (${prop.rxcui})`);
          });
        }
      }
    } catch (error) {
      console.error(`❌ Error mapping ${rxcui}:`, error.message);
    }
  }
  
  console.log('\n🔄 Testing interaction check...');
  
  // Now test interactions with known ingredient RxCUIs
  const ingredientRxCUIs = ['11289', '1191']; // warfarin, aspirin
  
  try {
    console.log(`📡 Calling: ${RXNAV_BASE_URL}/list.json?rxcuis=${ingredientRxCUIs.join(' ')}`);
    
    const response = await axios.get(`${RXNAV_BASE_URL}/list.json`, {
      params: {
        rxcuis: ingredientRxCUIs.join(' '),
      },
      timeout: 15000,
    });
    
    console.log('✅ Response status:', response.status);
    console.log('📤 Response data structure:');
    console.log(JSON.stringify(response.data, null, 2));
    
    // Check for interactions
    const data = response.data;
    const hasInteractions = data.fullInteractionTypeGroup && 
                           data.fullInteractionTypeGroup.some(group => 
                             group.fullInteractionType && 
                             group.fullInteractionType.length > 0
                           );
    
    if (hasInteractions) {
      console.log('\n🎉 SUCCESS: Interactions detected!');
    } else {
      console.log('\n⚠️ No interactions found, but API call succeeded');
    }
    
  } catch (error) {
    console.error('❌ Interaction check failed:', error.message);
    console.error('Status:', error.response?.status);
    console.error('Data:', error.response?.data);
  }
}

testInteractionService().catch(console.error);