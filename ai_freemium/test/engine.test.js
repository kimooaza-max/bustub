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

test('real arithmetic: multi-term, precedence, parentheses, powers, sqrt', () => {
  assert.strictEqual(AI.evalMath(AI.mathExpr('2+3*4')), 14);   // ترتيب العمليات
  assert.strictEqual(AI.evalMath(AI.mathExpr('(2+3)*4')), 20); // أقواس
  assert.strictEqual(AI.evalMath(AI.mathExpr('2^10')), 1024);  // أس
  assert.strictEqual(AI.evalMath(AI.mathExpr('100/8')), 12.5);
  assert.strictEqual(AI.evalMath(AI.mathExpr('جذر 144')), 12); // جذر بالعربي
  assert.strictEqual(AI.evalMath(AI.mathExpr('sqrt(81)+1')), 10);
});

test('smart computes complex expressions (not memorized)', () => {
  assert.match(AI.ask('2+3*4', 'smart').html, /<b>14<\/b>/);
  assert.match(AI.ask('(10-2)^2', 'smart').html, /<b>64<\/b>/);
});

test('percentages are computed', () => {
  assert.match(AI.ask('20% من 150', 'smart').html, /<b>30<\/b>/);
  assert.match(AI.ask('كام نسبة 30 من 60', 'smart').html, /<b>50%<\/b>/);
});

test('honest fallback instead of making up an answer', () => {
  const r = AI.ask('ايه رأيك في الحب', 'smart').html;
  assert.match(r, /مش هألّف|الموديل الكامل/); // بيقول مش عارف، مش بيألّف
});

test('expanded knowledge base answers more topics', () => {
  assert.match(AI.ask('عاصمة اليابان', 'smart').html, /طوكيو/);
  assert.match(AI.ask('اكبر كوكب', 'smart').html, /المشتري/);
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
