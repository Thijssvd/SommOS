describe('Basic Jest Test', () => {
  test('should run a basic test', () => {
    expect(1 + 1).toBe(2);
  });

  test('should handle strings', () => {
    expect('hello').toBe('hello');
  });
});
