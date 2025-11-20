// Quick test to verify the Warfarin + Aspirin detection logic
import interactionService from './src/modules/drug-info/services/interactionService';

async function testWarfarinAspirinDetection() {
  console.log('🧪 Testing Warfarin + Aspirin Detection Logic');
  console.log('='.repeat(50));
  
  const testRxCUIs = ['855290', '1052678'];
  
  try {
    console.log(`📋 Testing with RxCUIs: ${testRxCUIs.join(', ')}`);
    
    const result = await interactionService.getInteractionsForMultipleDrugs(testRxCUIs);
    
    console.log('✅ Result received:');
    console.log(JSON.stringify(result, null, 2));
    
    // Check if we got the expected Warfarin + Aspirin interaction
    const hasWarfarinAspirinInteraction = result.fullInteractionTypeGroup &&
      result.fullInteractionTypeGroup.some(group => 
        group.fullInteractionType && 
        group.fullInteractionType.length > 0 &&
        group.sourceName === 'Clinical Drug Interaction Database'
      );
    
    if (hasWarfarinAspirinInteraction) {
      console.log('🎉 SUCCESS: Warfarin + Aspirin interaction detected!');
    } else {
      console.log('❌ ISSUE: Warfarin + Aspirin interaction not detected');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testWarfarinAspirinDetection();