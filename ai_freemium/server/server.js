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
const ZakaAI = require('../engine.js'); // نفس عقل الموقع المستخدم في المتصفح

const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, '..'); // فولدر ai_freemium
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };

// أسعار الطبقات (نفس اللي في الواجهة) — مرجع واحد للحقيقة
const PRICE = { smart: 0.10, genius: 0.30 };

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function handleAsk(req, res) {
  let data = '';
  req.on('data', c => { data += c; if (data.length > 1e5) req.destroy(); });
  req.on('end', () => {
    let body = {};
    try { body = JSON.parse(data || '{}'); } catch { return sendJson(res, 400, { error: 'JSON غير صالح' }); }
    const question = (body.question || '').toString().slice(0, 2000);
    const tier = ['free', 'smart', 'genius'].includes(body.tier) ? body.tier : 'free';
    if (!question.trim()) return sendJson(res, 400, { error: 'السؤال فاضي' });

    const result = ZakaAI.ask(question, tier);       // ← عقل الموقع
    result.cost = PRICE[tier] || 0;                  // الواجهة بتخصم من المحفظة
    sendJson(res, 200, result);
  });
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

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/ask') return handleAsk(req, res);
  if (req.method === 'GET' && req.url === '/api/health') return sendJson(res, 200, { ok: true, engine: 'ZakaAI' });
  if (req.method === 'GET') return serveStatic(req, res);
  res.writeHead(405); res.end('Method not allowed');
});

server.listen(PORT, () => {
  console.log(`ZakaAI server جاهز → http://localhost:${PORT}`);
  console.log('جرّب: curl -X POST localhost:' + PORT + '/api/ask -d \'{"question":"1+1","tier":"free"}\'');
});
