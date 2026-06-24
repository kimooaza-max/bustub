'use strict';
const test = require('node:test');
const assert = require('node:assert');
const Wallet = require('../wallet.js');

test('new account has starter balance and clean stats', () => {
  const a = Wallet.newAccount();
  assert.strictEqual(a.balance, 2.00);
  assert.strictEqual(a.stats.revenue, 0);
  assert.deepStrictEqual(a.domains, {});
});

test('smart question charges $0.10 and counts as revenue', () => {
  const a = Wallet.newAccount();
  const r = Wallet.ask(a, '1+1', 'smart');
  assert.strictEqual(r.cost, 0.10);
  assert.strictEqual(+a.balance.toFixed(2), 1.90);
  assert.strictEqual(+a.stats.revenue.toFixed(2), 0.10);
  assert.strictEqual(a.stats.questions, 1);
});

test('free question is dumb and costs nothing', () => {
  const a = Wallet.newAccount();
  const r = Wallet.ask(a, '1+1', 'free');
  assert.strictEqual(r.html, '11');
  assert.strictEqual(r.cost, 0);
  assert.strictEqual(a.balance, 2.00);
});

test('insufficient funds throws INSUFFICIENT_FUNDS', () => {
  const a = Wallet.newAccount();
  a.balance = 0.05;
  assert.throws(() => Wallet.ask(a, '1+1', 'smart'), e => e.code === 'INSUFFICIENT_FUNDS');
});

test('topup increases balance and diamonds, logs a tx', () => {
  const a = Wallet.newAccount();
  Wallet.topup(a, 5, 60);
  assert.strictEqual(a.balance, 7.00);
  assert.strictEqual(a.diamonds, 110);
  assert.strictEqual(a.ledger[0].type, 'topup');
});

test('unlocking math makes free questions tutored & free', () => {
  const a = Wallet.newAccount();
  Wallet.topup(a, 10, 0);
  Wallet.unlockDomain(a, 'math');
  assert.strictEqual(a.domains.math, true);
  const r = Wallet.ask(a, '1+1', 'free'); // النسخة المجانية بس المجال مفتوح
  assert.strictEqual(r.tier, 'domain');
  assert.strictEqual(r.cost, 0);
  assert.match(r.html, /<b>2<\/b>/);
});

test('unknown domain throws', () => {
  const a = Wallet.newAccount();
  Wallet.topup(a, 10, 0);
  assert.throws(() => Wallet.unlockDomain(a, 'nope'), e => e.code === 'UNKNOWN_DOMAIN');
});

test('video subscription costs $10 and grants daily seconds', () => {
  const a = Wallet.newAccount();
  Wallet.topup(a, 10, 0);
  Wallet.subscribeVideo(a);
  assert.strictEqual(a.videoSub, true);
  assert.strictEqual(a.videoSecondsLeft, Wallet.VIDEO_DAILY_SECONDS);
  assert.strictEqual(+a.stats.revenue.toFixed(2), 10.00);
});

test('ad impression adds tiny ad revenue', () => {
  const a = Wallet.newAccount();
  Wallet.recordAd(a);
  assert.strictEqual(a.stats.adImpressions, 1);
  assert.ok(a.stats.adRevenue > 0);
});

test('new day refreshes the daily video budget', () => {
  const a = Wallet.newAccount();
  Wallet.topup(a, 10, 0);
  Wallet.subscribeVideo(a);
  a.videoSecondsLeft = 0;
  a.lastDay = '2000-01-01'; // يوم قديم
  Wallet.refreshIfNewDay(a);
  assert.strictEqual(a.videoSecondsLeft, Wallet.VIDEO_DAILY_SECONDS);
});
