/* ============================================================
   ZakaAI — سيرفر جاهز (مستني سيرفر يتوفر)
   ------------------------------------------------------------
   ⚠️ مش لازم يشتغل دلوقتي. الواجهة (../index.html) شغّالة لوحدها
      في المتصفح بدون السيرفر ده. الملف ده "جاهز ومستني" لحد ما
      يتوفر سيرفر نرفعه عليه.

   مفيش أي مكتبات خارجية — Node بس. التشغيل:
        node server/server.js
   وبعدين افتح:  http://localhost:3000

   بيقدّم:
     • الواجهة الثابتة (index.html, engine.js, ...)
     • POST /api/ask   { question, tier }  → رد الـAI الخاص بالموقع
     • GET  /api/health
============================================================ */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const Wallet = require('../wallet.js'); // منطق المحفظة الآمن (بيستخدم engine.js جوّه)
const Brain = require('./brain.js');   // نقطة وصل النموذج اللغوي الحقيقي (اختياري)
const ZakaAI = require('../engine.js'); // للتأمين (escapeHtml)

const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, '..'); // فولدر ai_freemium
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };

// حسابات في الذاكرة لكل جلسة (في الإنتاج: قاعدة بيانات). المفتاح من هيدر x-session.
const accounts = new Map();
function accountFor(req) {
  const id = (req.headers['x-session'] || 'demo').toString().slice(0, 64);
  if (!accounts.has(id)) accounts.set(id, Wallet.newAccount());
  return accounts.get(id);
}

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 1e5) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { reject(new Error('BAD_JSON')); } });
  });
}

async function handleAsk(req, res) {
  let body;
  try { body = await readBody(req); } catch { return sendJson(res, 400, { error: 'JSON غير صالح' }); }
  const question = (body.question || '').toString().slice(0, 2000);
  const tier = ['free', 'smart', 'genius'].includes(body.tier) ? body.tier : 'free';
  if (!question.trim()) return sendJson(res, 400, { error: 'السؤال فاضي' });
  const acc = accountFor(req);
  try {
    const result = Wallet.ask(acc, question, tier); // ← يتحقق من الرصيد ويخصم في السيرفر
    // لو فيه موديل لغوي حقيقي متظبّط، يدّي إجابة ليها علاقة بالسؤال (مش مجاناً/غبي)
    if (Brain.isConfigured() && (tier === 'smart' || tier === 'genius')) {
      const real = await Brain.think(question, tier);
      if (real) { result.html = ZakaAI.escapeHtml(real).replace(/\n/g, '<br>'); result.source = 'model'; }
    }
    sendJson(res, 200, result);
  } catch (e) {
    if (e.code === 'INSUFFICIENT_FUNDS') return sendJson(res, 402, { error: 'الرصيد غير كافٍ', balance: acc.balance });
    sendJson(res, 500, { error: 'خطأ داخلي' });
  }
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); } // منع path traversal
  fs.readFile(filePath, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(buf);
  });
}

async function handleAction(req, res, fn) {
  let body; try { body = await readBody(req); } catch { return sendJson(res, 400, { error: 'JSON غير صالح' }); }
  const acc = accountFor(req);
  try { fn(acc, body); sendJson(res, 200, acc); }
  catch (e) {
    if (e.code === 'INSUFFICIENT_FUNDS') return sendJson(res, 402, { error: 'الرصيد غير كافٍ', balance: acc.balance });
    if (e.code === 'UNKNOWN_DOMAIN') return sendJson(res, 400, { error: 'مجال غير معروف' });
    sendJson(res, 500, { error: 'خطأ داخلي' });
  }
}

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (req.method === 'POST') {
    if (url === '/api/ask') return handleAsk(req, res);
    if (url === '/api/topup') return handleAction(req, res, (a, b) => Wallet.topup(a, +b.dollars || 0, +b.diamonds || 0));
    if (url === '/api/unlock-domain') return handleAction(req, res, (a, b) => Wallet.unlockDomain(a, b.id));
    if (url === '/api/subscribe-video') return handleAction(req, res, (a) => Wallet.subscribeVideo(a));
    if (url === '/api/ad') return handleAction(req, res, (a) => Wallet.recordAd(a));
  }
  if (req.method === 'GET') {
    if (url === '/api/health') return sendJson(res, 200, { ok: true, engine: 'ZakaAI',
      brain: Brain.isConfigured() ? `model:${Brain.MODEL}` : 'offline (rule-engine)' });
    if (url === '/api/account') return sendJson(res, 200, accountFor(req));
    return serveStatic(req, res);
  }
  res.writeHead(405); res.end('Method not allowed');
});

server.listen(PORT, () => {
  console.log(`ZakaAI server جاهز → http://localhost:${PORT}`);
  console.log('جرّب: curl -X POST localhost:' + PORT + '/api/ask -d \'{"question":"1+1","tier":"free"}\'');
});
