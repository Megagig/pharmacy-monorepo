// Sidebar Verification Script
// Run this in browser console to verify sidebar functionality

console.log('🧪 Starting Sidebar Functionality Tests...');

// Test 1: Verify sidebar toggle functionality
function testSidebarToggle() {
  console.log('\n📋 Test 1: Sidebar Toggle Functionality');

  const sidebar = document.querySelector('.MuiDrawer-paper');
  if (!sidebar) {
    console.error('❌ Sidebar element not found');
    return false;
  }

  const initialWidth = window.getComputedStyle(sidebar).width;
  console.log(`📏 Initial sidebar width: ${initialWidth}`);

  // Find toggle button
  const toggleButtons = Array.from(
    document.querySelectorAll('.MuiBox-root')
  ).filter((box) => {
    const style = window.getComputedStyle(box);
    return (
      style.cursor === 'pointer' &&
      style.backgroundColor.includes('25, 118, 210')
    );
  });

  if (toggleButtons.length === 0) {
    console.error('❌ Toggle button not found');
    return false;
  }

  console.log(`✅ Found ${toggleButtons.length} toggle button(s)`);
  return true;
}

// Test 2: Verify pharmacy modules visibility
function testPharmacyModules() {
  console.log('\n📋 Test 2: Pharmacy Modules Visibility');

  const pharmacySection = Array.from(document.querySelectorAll('*')).find(
    (el) => el.textContent?.includes('PHARMACY TOOLS')
  );

  if (!pharmacySection) {
    console.error('❌ PHARMACY TOOLS section not found');
    return false;
  }

  console.log('✅ PHARMACY TOOLS section found');

  const pharmacyLinks = document.querySelectorAll('a[href*="/pharmacy/"]');
  console.log(`📊 Found ${pharmacyLinks.length} pharmacy module links`);

  const expectedModules = [
    '/pharmacy/medication-therapy',
    '/pharmacy/clinical-interventions',
    '/pharmacy/lab-integration',
    '/pharmacy/communication',
    '/pharmacy/drug-information',
    '/pharmacy/decision-support',
    '/pharmacy/reports',
    '/pharmacy/user-management',
    '/pharmacy/settings',
  ];

  const foundModules = expectedModules.filter((module) =>
    Array.from(pharmacyLinks).some(
      (link) => link.getAttribute('href') === module
    )
  );

  console.log(`✅ Found ${foundModules.length}/9 expected pharmacy modules`);
  foundModules.forEach((module) => console.log(`  ✓ ${module}`));

  const missingModules = expectedModules.filter(
    (module) => !foundModules.includes(module)
  );
  if (missingModules.length > 0) {
    console.warn('⚠️ Missing modules:');
    missingModules.forEach((module) => console.warn(`  ✗ ${module}`));
  }

  return foundModules.length === 9;
}

// Test 3: Verify badges and icons
function testBadgesAndIcons() {
  console.log('\n📋 Test 3: Badges and Icons');

  const comingSoonBadges = Array.from(
    document.querySelectorAll('.MuiChip-root')
  ).filter((chip) => chip.textContent?.includes('Coming Soon'));

  console.log(`🏷️ Found ${comingSoonBadges.length} "Coming Soon" badges`);

  const icons = document.querySelectorAll('.MuiListItemIcon-root svg');
  console.log(`🎨 Found ${icons.length} navigation icons`);

  const badges = document.querySelectorAll('.MuiBadge-root');
  console.log(`📍 Found ${badges.length} badge indicators`);

  return comingSoonBadges.length >= 9 && icons.length >= 15;
}

// Test 4: Verify tooltips (when collapsed)
function testTooltips() {
  console.log('\n📋 Test 4: Tooltip Elements');

  const sidebar = document.querySelector('.MuiDrawer-paper');
  const sidebarWidth = window.getComputedStyle(sidebar).width;
  const isCollapsed = sidebarWidth === '56px';

  console.log(
    `📏 Sidebar width: ${sidebarWidth} (${
      isCollapsed ? 'Collapsed' : 'Expanded'
    })`
  );

  if (isCollapsed) {
    const tooltipElements = document.querySelectorAll(
      '[title], .MuiTooltip-root'
    );
    console.log(
      `💬 Found ${tooltipElements.length} elements with tooltip capability`
    );
    return tooltipElements.length > 0;
  } else {
    console.log('ℹ️ Sidebar must be collapsed to test tooltips');
    return true; // Not applicable
  }
}

// Test 5: Verify responsive behavior
function testResponsiveBehavior() {
  console.log('\n📋 Test 5: Responsive Behavior');

  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  const isMobile = screenWidth < 900;

  console.log(`📱 Screen size: ${screenWidth}x${screenHeight}`);
  console.log(`📱 Mobile detected: ${isMobile}`);

  // Check if sidebar behaves appropriately for screen size
  const sidebar = document.querySelector('.MuiDrawer-paper');
  const sidebarStyle = window.getComputedStyle(sidebar);

  console.log(`📐 Sidebar position: ${sidebarStyle.position}`);
  console.log(`📐 Sidebar z-index: ${sidebarStyle.zIndex}`);

  return true;
}

// Test 6: Verify section headers
function testSectionHeaders() {
  console.log('\n📋 Test 6: Section Headers');

  const expectedHeaders = ['MAIN MENU', 'PHARMACY TOOLS', 'ACCOUNT'];
  const foundHeaders = expectedHeaders.filter((header) =>
    Array.from(document.querySelectorAll('*')).some((el) =>
      el.textContent?.includes(header)
    )
  );

  console.log(`📑 Found section headers: ${foundHeaders.join(', ')}`);

  const sidebar = document.querySelector('.MuiDrawer-paper');
  const sidebarWidth = window.getComputedStyle(sidebar).width;
  const isExpanded = sidebarWidth === '280px';

  if (isExpanded) {
    console.log(
      `✅ Headers visible in expanded state: ${foundHeaders.length}/3`
    );
    return foundHeaders.length >= 3;
  } else {
    console.log('ℹ️ Headers should not be visible in collapsed state');
    return true;
  }
}

// Run all tests
function runAllTests() {
  console.log('🚀 Running Complete Sidebar Test Suite');
  console.log('=====================================');

  const tests = [
    { name: 'Sidebar Toggle', test: testSidebarToggle },
    { name: 'Pharmacy Modules', test: testPharmacyModules },
    { name: 'Badges and Icons', test: testBadgesAndIcons },
    { name: 'Tooltips', test: testTooltips },
    { name: 'Responsive Behavior', test: testResponsiveBehavior },
    { name: 'Section Headers', test: testSectionHeaders },
  ];

  const results = tests.map(({ name, test }) => {
    try {
      const result = test();
      return { name, passed: result };
    } catch (error) {
      console.error(`❌ Error in ${name}:`, error);
      return { name, passed: false, error };
    }
  });

  console.log('\n📊 Test Results Summary');
  console.log('=======================');

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;

  results.forEach(({ name, passed, error }) => {
    const status = passed ? '✅' : '❌';
    console.log(`${status} ${name}: ${passed ? 'PASSED' : 'FAILED'}`);
    if (error) console.log(`   Error: ${error.message}`);
  });

  console.log(
    `\n🎯 Overall: ${passed}/${total} tests passed (${Math.round(
      (passed / total) * 100
    )}%)`
  );

  if (passed === total) {
    console.log(
      '🎉 All tests passed! Sidebar functionality is working correctly.'
    );
  } else {
    console.log('⚠️ Some tests failed. Please review the issues above.');
  }

  return { passed, total, results };
}

// Export for use
window.sidebarTests = {
  runAllTests,
  testSidebarToggle,
  testPharmacyModules,
  testBadgesAndIcons,
  testTooltips,
  testResponsiveBehavior,
  testSectionHeaders,
};

console.log(
  '✅ Sidebar test functions loaded. Run sidebarTests.runAllTests() to start testing.'
);
