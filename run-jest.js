const jest = require('jest');

async function runTests() {
  try {
    console.log('Running Jest programmatically...');
    const results = await jest.run(['basic.test.js']);
    console.log('Jest completed successfully');
    console.log('Results:', results);
  } catch (error) {
    console.error('Jest error:', error.message);
    console.error(error.stack);
  }
}

runTests();
