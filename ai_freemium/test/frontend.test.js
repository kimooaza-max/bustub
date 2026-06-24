'use strict';
/* اختبار تكامل للواجهة: بنحمّل engine.js + wallet.js + السكريبت الداخلي
   لـ index.html جوّه DOM مزيّف بسيط، وبنشغّل السيناريوهات الأساسية. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function makeEl() {
  const el = {
    _html: '', children: [], dataset: {}, classList: { _s: new Set(),
      add(c){this._s.add(c)}, remove(c){this._s.delete(c)}, toggle(c,v){v?this._s.add(c):this._s.delete(c)},
      contains(c){return this._s.has(c)} },
    style: {}, attrs: {},
    set innerHTML(v){ this._html = v; }, get innerHTML(){ return this._html; },
    set textContent(v){ this._text = v; }, get textContent(){ return this._text; },
    appendChild(c){ this.children.push(c); }, addEventListener(){},
    querySelectorAll(){ return []; }, focus(){},
  };
  return el;
}

function loadApp() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const inline = blocks[blocks.length - 1]; // آخر بلوك = منطق التطبيق

  const els = {};
  const ids = ['balance','diamonds','modeHint','chat','input','overlay','modal','toast',
    'videoBody','videoStateChip','earnings','domains'];
  ids.forEach(id => { els[id] = makeEl(); });

  const store = {};
  const sandbox = {
    console,
    localStorage: { getItem:k=>store[k]??null, setItem:(k,v)=>{store[k]=String(v)}, removeItem:k=>{delete store[k]} },
    document: {
      getElementById: id => els[id] || (els[id] = makeEl()),
      createElement: () => makeEl(),
      querySelectorAll: () => [],
    },
    window: {}, self: {}, setTimeout: ()=>0, clearTimeout: ()=>{}, setInterval: ()=>0, clearInterval: ()=>{},
    Date, Math, JSON, location: { reload(){} }, confirm: ()=>true, alert: ()=>{},
  };
  sandbox.window = sandbox; sandbox.self = sandbox;
  vm.createContext(sandbox);

  // حمّل engine.js + wallet.js في نفس السياق
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','engine.js'),'utf8'), sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','wallet.js'),'utf8'), sandbox);
  vm.runInContext(inline, sandbox);
  return { sandbox, els };
}

test('app initializes without throwing and renders balance', () => {
  const { els } = loadApp();
  assert.strictEqual(els.balance.textContent, '$2.00');
  assert.strictEqual(els.diamonds.textContent, 50);
});

const nodeHtml = n => (n.innerHTML || '') + (n.children || []).map(nodeHtml).join('');
const chatHtml = els => els.chat.children.map(nodeHtml).join('|');

test('free question yields a dumb answer in the chat', () => {
  const { sandbox, els } = loadApp();
  sandbox.doAnswer('1+1');                 // مباشرة (نتخطى الإعلان)
  assert.match(chatHtml(els), /11/);       // الرد الغبي
  assert.match(chatHtml(els), /هات الإجابة الصح/); // زر الترقية
});

test('free tier shows an ad before answering (ad per chat)', () => {
  const { sandbox, els } = loadApp();
  els.input.value = '1+1';
  sandbox.send();
  assert.ok(els.overlay.classList.contains('show')); // ظهر الإعلان
  assert.match(els.modal.innerHTML, /إعلان/);
});

test('topup then smart question deducts balance', () => {
  const { sandbox, els } = loadApp();
  sandbox.topup(5, 0);
  assert.strictEqual(els.balance.textContent, '$7.00');
  sandbox.selectTier('smart');
  sandbox.doAnswer('12*3');
  assert.strictEqual(els.balance.textContent, '$6.90'); // اتخصم 0.10
  assert.match(chatHtml(els), /36/);
});

test('unlocking a domain makes free math correct & free', () => {
  const { sandbox, els } = loadApp();
  sandbox.topup(10, 0);
  sandbox.unlockDomain('math');             // بيخصم سعر الحزمة
  const balAfterUnlock = els.balance.textContent;
  sandbox.selectTier('free');
  sandbox.doAnswer('1+1');
  assert.strictEqual(els.balance.textContent, balAfterUnlock); // السؤال نفسه مجاني
  assert.match(chatHtml(els), /<b>2<\/b>/);
});

test('revenue is tracked and shown on the earnings panel', () => {
  const { sandbox, els } = loadApp();
  sandbox.topup(10, 0);
  sandbox.selectTier('genius');
  sandbox.doAnswer('عاصمة مصر');             // بيخصم 0.30
  assert.match(els.earnings.innerHTML, /\$0\.30[\s\S]*إجمالي الدخل/);
});
