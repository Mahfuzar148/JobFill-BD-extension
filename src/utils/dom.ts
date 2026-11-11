// JobFill BD - Safe DOM Selector & Utility Functions
// Cross-environment helper resilient to Node.js / JSDOM where CSS.escape may be undefined

export function safeEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  // Fallback CSS escaping for test/headless environments
  return value.replace(/([ #;?%&,.+*~\':"!^$[\]()=>|\/@])/g, '\\$1');
}
