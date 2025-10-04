const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const consoleMessages = [];
  const errors = [];
  
  page.on('console', msg => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text(),
      location: msg.location()
    });
  });
  
  page.on('pageerror', error => {
    errors.push({
      message: error.message,
      stack: error.stack
    });
  });
  
  try {
    console.log('Loading page...');
    await page.goto('http://localhost:3000/', { 
      waitUntil: 'networkidle',
      timeout: 15000 
    });
    console.log('Page loaded successfully!');
  } catch (error) {
    console.error('Page load failed:', error.message);
  }
  
  console.log('\n=== CONSOLE MESSAGES ===');
  consoleMessages.forEach(msg => {
    if (msg.type === 'error' || msg.type === 'warning') {
      console.log(`[${msg.type.toUpperCase()}] ${msg.text}`);
      if (msg.location?.url) {
        console.log(`  at ${msg.location.url}:${msg.location.lineNumber}`);
      }
    }
  });
  
  console.log('\n=== PAGE ERRORS ===');
  errors.forEach(err => {
    console.log(`ERROR: ${err.message}`);
    if (err.stack) {
      console.log(err.stack);
    }
  });
  
  // Check if page is still on loading screen
  const loadingScreenVisible = await page.locator('#loading-screen').isVisible();
  const appHidden = await page.locator('#app').getAttribute('class');
  const authScreenHidden = await page.locator('#auth-screen').getAttribute('class');
  
  console.log('\n=== PAGE STATE ===');
  console.log(`Loading screen visible: ${loadingScreenVisible}`);
  console.log(`App classes: ${appHidden}`);
  console.log(`Auth screen classes: ${authScreenHidden}`);
  
  await browser.close();
})();
