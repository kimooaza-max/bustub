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

  /* ---------- حزم الذكاء حسب المجال ----------
     المستخدم بيفتح المجال اللي عايز التطبيق يكون ذكي فيه. أي سؤال في
     مجال مفتوح بيترد عليه بمستوى «مدرّس» مجاناً — حتى في النسخة المجانية. */
  const DOMAINS = [
    { id: 'math',    name: 'الرياضيات', emoji: '➗', price: 2.0,
      keywords: ['+','-','*','/','×','معادلة','جذر','نسبة','مساحة','محيط','احسب','كام','جمع','طرح','ضرب','قسمة'] },
    { id: 'science', name: 'العلوم', emoji: '🔬', price: 2.0,
      keywords: ['نيوتن','جاذبية','ذرة','خلية','طاقة','سرعة','كتلة','كيمياء','فيزياء','أحياء','تفاعل','كوكب'] },
    { id: 'code',    name: 'البرمجة', emoji: '💻', price: 3.0,
      keywords: ['كود','برمجة','function','دالة','بايثون','python','javascript','حلقة','loop','مصفوفة','array','خطأ','bug'] },
    { id: 'lang',    name: 'اللغات', emoji: '🗣️', price: 2.0,
      keywords: ['ترجم','معنى','translate','بالانجليزي','بالعربي','قواعد','grammar','جملة','كلمة'] },
  ];
  function detectDomain(q) {
    const t = q.toLowerCase();
    if (parseMath(q)) return 'math';
    for (const d of DOMAINS) { if (d.keywords.some(k => t.includes(k.toLowerCase()))) return d.id; }
    return null;
  }
  function domainName(id) { const d = DOMAINS.find(x => x.id === id); return d ? `${d.emoji} ${d.name}` : id; }
  function tutorAnswer(q, domainId) {
    const base = geniusAnswer(q); // إجابة صح + شرح
    const note = {
      math: '🧮 نصيحة المدرّس: راجع خطوات الحل بنفسك بعد كده عشان تثبت.',
      science: '🔬 المدرّس: حاول تربط المفهوم ده بمثال من حياتك اليومية.',
      code: '💻 المدرّس: جرّب تكتب الكود بنفسك وتشغّله — التعلّم بالممارسة.',
      lang: '🗣️ المدرّس: استخدم الكلمة في جملة جديدة عشان تفتكرها.',
    }[domainId] || '';
    return `${base}\n\n${note}`;
  }

  /* ---------- الواجهة الموحّدة ----------
     opts.domains = مصفوفة مجالات مفتوحة. لو السؤال في مجال مفتوح،
     بيترد عليه بمستوى مدرّس مجاناً مهما كانت الطبقة. */
  function ask(question, tier, opts) {
    opts = opts || {};
    const unlocked = opts.domains || [];
    const dom = detectDomain(question);
    if (dom && unlocked.includes(dom)) {
      return { tier: 'domain', domain: dom, free: true, html: tutorAnswer(question, dom),
        tag: `📚 حزمة ${domainName(dom)}` };
    }
    switch (tier) {
      case 'smart': return { tier, html: smartAnswer(question) };
      case 'genius': return { tier, html: geniusAnswer(question) };
      default: return { tier: 'free', html: dumbAnswer(question), warning: 'النسخة المجانية — غالباً غلط' };
    }
  }

  const ZakaAI = { ask, dumbAnswer, smartAnswer, geniusAnswer, tutorAnswer,
    parseMath, calc, escapeHtml, KNOWLEDGE, DOMAINS, detectDomain, domainName };

  // يشتغل في المتصفح (window.ZakaAI) وفي Node (module.exports)
  if (typeof module !== 'undefined' && module.exports) module.exports = ZakaAI;
  else root.ZakaAI = ZakaAI;
})(typeof self !== 'undefined' ? self : this);
