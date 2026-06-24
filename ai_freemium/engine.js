/* ============================================================
   ZakaAI — محرك الذكاء الخاص بالموقع (مش كلود ولا API خارجي)
   ------------------------------------------------------------
   ده "العقل" بتاع التطبيق: منطق مستقل بالكامل بيعيش جوه الكود.
   بيشتغل في المتصفح (standalone) وفي السيرفر (Node) بنفس الملف.

   الفكرة: نفس السؤال بيدّي رد مختلف حسب الطبقة:
     - free   → إجابة غلط بقصد (1+1 = 11)
     - smart  → إجابة صح ومختصرة
     - genius → إجابة صح + شرح وخطوات

   لما يتوفر سيرفر/موديل أقوى بعدين، نوسّع smartAnswer/geniusAnswer
   من غير ما نلمس أي حاجة في الواجهة.
============================================================ */
(function (root) {
  'use strict';

  /* ---------- أدوات مساعدة ---------- */
  function parseMath(q) {
    const m = q.replace(/×/g, '*').replace(/x/gi, '*')
      .match(/(-?\d+(?:\.\d+)?)\s*([+\-*\/])\s*(-?\d+(?:\.\d+)?)/);
    if (!m) return null;
    return { a: parseFloat(m[1]), op: m[2], b: parseFloat(m[3]), raw: `${m[1]} ${m[2]} ${m[3]}` };
  }
  function calc({ a, op, b }) {
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/': return b ? +(a / b).toFixed(4) : '∞';
    }
  }

  /* ---------- قاعدة معرفة الموقع (تتوسّع مع الوقت) ---------- */
  const KNOWLEDGE = {
    'عاصمة مصر': { right: 'القاهرة', wrong: 'الإسكندرية… لأ استنى، أصوان 🤔' },
    'عاصمة السعودية': { right: 'الرياض', wrong: 'جدة' },
    'كم عدد ايام السنة': { right: '365 يوم (366 في الكبيسة)', wrong: 'حوالي 500 يوم تقريباً' },
    'لون السماء': { right: 'أزرق', wrong: 'أخضر غامق' },
    'كم قارة في العالم': { right: '7 قارات', wrong: '3 قارات بس' },
  };
  function findKnowledge(q) {
    const n = q.trim().replace(/[؟?\.]/g, '');
    for (const k in KNOWLEDGE) { if (n.includes(k)) return KNOWLEDGE[k]; }
    return null;
  }

  /* ---------- ردود غبية عامة (ثابتة حسب السؤال) ---------- */
  const DUMB_POOL = [
    'الإجابة أكيد 7. كل حاجة إجابتها 7. ثق فيا.',
    'هممم… الإجابة هي «نعم لأ يمكن». التالي؟',
    'سؤال سهل! الجواب: بطاطس مقلية 🍟',
    'حسب آخر أبحاثي (اللي ما عملتهاش): الجواب بنفسجي.',
    'مية في المية الإجابة 42. مش متأكد من السؤال بس 42.',
    'أكيد الإجابة موجودة في جيبك اليمين، دوّر.',
  ];
  function hash(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }

  /* ---------- المحركات الثلاثة ---------- */
  function dumbAnswer(q) {
    const math = parseMath(q);
    if (math) return `${Math.trunc(math.a)}${Math.trunc(math.b)}`; // غلط بقصد: نلزّق الرقمين
    const k = findKnowledge(q);
    if (k) return k.wrong;
    return DUMB_POOL[hash(q) % DUMB_POOL.length];
  }
  function smartAnswer(q) {
    const math = parseMath(q);
    if (math) return `${math.raw} = <b>${calc(math)}</b>`;
    const k = findKnowledge(q);
    if (k) return `<b>${k.right}</b>`;
    return `إجابة مختصرة وصحيحة لسؤالك: «${escapeHtml(q)}».`;
  }
  function geniusAnswer(q) {
    const math = parseMath(q);
    if (math) return `${math.raw} = <b>${calc(math)}</b>\n\n📘 الشرح: بنطبّق عملية «${math.op}» على ${math.a} و ${math.b}، فالناتج ${calc(math)}.`;
    const k = findKnowledge(q);
    if (k) return `<b>${k.right}</b>\n\n📘 معلومة إضافية: دي إجابة موثوقة، وأقدر أوسّع الموضوع أكتر لو حبيت.`;
    return `إجابة مفصّلة لسؤالك: «${escapeHtml(q)}».\nالنسخة العبقرية بتدّيك تحليل + خطوات + أمثلة.`;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  }

  /* ---------- الواجهة الموحّدة ---------- */
  function ask(question, tier) {
    switch (tier) {
      case 'smart': return { tier, html: smartAnswer(question) };
      case 'genius': return { tier, html: geniusAnswer(question) };
      default: return { tier: 'free', html: dumbAnswer(question), warning: 'النسخة المجانية — غالباً غلط' };
    }
  }

  const ZakaAI = { ask, dumbAnswer, smartAnswer, geniusAnswer, parseMath, calc, escapeHtml, KNOWLEDGE };

  // يشتغل في المتصفح (window.ZakaAI) وفي Node (module.exports)
  if (typeof module !== 'undefined' && module.exports) module.exports = ZakaAI;
  else root.ZakaAI = ZakaAI;
})(typeof self !== 'undefined' ? self : this);
