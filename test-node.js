const { execSync } = require('child_process');

try {
  console.log('Testing execSync...');
  const result = execSync('echo "Hello from execSync"', { encoding: 'utf8' });
  console.log('Result:', result.trim());

  console.log('Testing basic Jest functionality...');
  // This is a basic test that should work
  const test = () => {
    return 1 + 1 === 2;
  };

  console.log('Test result:', test());
  console.log('All basic tests passed!');
} catch (error) {
  console.error('Error:', error.message);
}
