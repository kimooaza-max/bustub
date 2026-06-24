'use strict';
const test = require('node:test');
const assert = require('node:assert');
const AI = require('../engine.js');

test('free tier is wrong on purpose: 1+1 -> 11', () => {
  assert.strictEqual(AI.ask('1+1', 'free').html, '11');
  assert.strictEqual(AI.ask('12*3', 'free').html, '123'); // بيلزّق الرقمين
});

test('smart tier computes math correctly', () => {
  assert.match(AI.ask('1+1', 'smart').html, /=\s*<b>2<\/b>/);
  assert.match(AI.ask('12*3', 'smart').html, /=\s*<b>36<\/b>/);
  assert.match(AI.ask('10-4', 'smart').html, /=\s*<b>6<\/b>/);
});

test('genius tier adds an explanation', () => {
  const r = AI.ask('2+2', 'genius').html;
  assert.match(r, /<b>4<\/b>/);
  assert.match(r, /الشرح/);
});

test('knowledge base: free is wrong, smart is right', () => {
  assert.doesNotMatch(AI.ask('عاصمة مصر', 'free').html, /القاهرة/);
  assert.match(AI.ask('عاصمة مصر', 'smart').html, /القاهرة/);
});

test('domain detection', () => {
  assert.strictEqual(AI.detectDomain('1+1'), 'math');
  assert.strictEqual(AI.detectDomain('اشرح قانون نيوتن'), 'science');
  assert.strictEqual(AI.detectDomain('اكتب كود بايثون'), 'code');
  assert.strictEqual(AI.detectDomain('ترجم كلمة'), 'lang');
  assert.strictEqual(AI.detectDomain('السلام عليكم'), null);
});

test('unlocked domain answers smart for free, even on free tier', () => {
  const locked = AI.ask('1+1', 'free', { domains: [] });
  assert.strictEqual(locked.html, '11');
  const unlocked = AI.ask('1+1', 'free', { domains: ['math'] });
  assert.strictEqual(unlocked.tier, 'domain');
  assert.strictEqual(unlocked.free, true);
  assert.match(unlocked.html, /<b>2<\/b>/);
});

test('html is escaped (no injection)', () => {
  const r = AI.ask('<script>x</script>', 'smart').html;
  assert.doesNotMatch(r, /<script>/);
});

test('every domain has id, name, price and keywords', () => {
  for (const d of AI.DOMAINS) {
    assert.ok(d.id && d.name && typeof d.price === 'number' && Array.isArray(d.keywords));
  }
});
