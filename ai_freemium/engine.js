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

  function escapeHtml(s) {
    return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  }

  /* ---------- معالج حسابي حقيقي (بيحسب، مش بيحفظ) ----------
     بيفهم أي تعبير: + - * / ^ % وأقواس وجذر، مش بس عمليتين. */
  function parseMath(q) { // (للكشف البسيط والرد الغبي)
    const m = q.replace(/×/g, '*').replace(/x/gi, '*')
      .match(/(-?\d+(?:\.\d+)?)\s*([+\-*\/])\s*(-?\d+(?:\.\d+)?)/);
    if (!m) return null;
    return { a: parseFloat(m[1]), op: m[2], b: parseFloat(m[3]), raw: `${m[1]} ${m[2]} ${m[3]}` };
  }
  function calc({ a, op, b }) {
    switch (op) { case '+': return a + b; case '-': return a - b;
      case '*': return a * b; case '/': return b ? +(a / b).toFixed(4) : '∞'; }
  }
  // بيرجّع نص التعبير الرياضي لو السؤال حسابي، وإلا null
  function mathExpr(q) {
    let s = String(q)
      .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))   // أرقام عربية → لاتينية
      .replace(/×/g, '*').replace(/÷/g, '/').replace(/[xX]/g, '*')
      .replace(/جذر/g, 'sqrt').replace(/أس/g, '^');
    const cleaned = s.replace(/sqrt|[^0-9+\-*/().^%\s]/gi, m => m.toLowerCase() === 'sqrt' ? 'sqrt' : ' ')
      .replace(/\s+/g, ' ').trim();
    if (!/\d/.test(cleaned)) return null;             // لازم رقم
    if (!/[+\-*/^%]|sqrt/.test(cleaned)) return null; // ولازم عملية
    return cleaned;
  }
  // معالج بسيط بالنزول التكراري (آمن — مفيش eval)
  function evalMath(expr) {
    if (expr == null) return null;
    const toks = (expr.match(/\d+\.?\d*|sqrt|[+\-*/^%()]/gi) || []);
    let i = 0;
    const peek = () => toks[i], next = () => toks[i++];
    function parseExpr() { let v = parseTerm();
      while (peek() === '+' || peek() === '-') { const op = next(); const r = parseTerm(); v = op === '+' ? v + r : v - r; }
      return v; }
    function parseTerm() { let v = parsePow();
      while (peek() === '*' || peek() === '/' || peek() === '%') { const op = next(); const r = parsePow();
        v = op === '*' ? v * r : op === '/' ? v / r : v % r; }
      return v; }
    function parsePow() { let v = parseUnary();
      if (peek() === '^') { next(); v = Math.pow(v, parsePow()); } return v; }
    function parseUnary() { if (peek() === '-') { next(); return -parseUnary(); } if (peek() === '+') { next(); return parseUnary(); } return parseAtom(); }
    function parseAtom() {
      const t = peek();
      if (t === '(') { next(); const v = parseExpr(); if (peek() === ')') next(); return v; }
      if (t && t.toLowerCase() === 'sqrt') { next(); if (peek() === '(') { next(); const v = parseExpr(); if (peek() === ')') next(); return Math.sqrt(v); } return Math.sqrt(parseAtom()); }
      if (t != null && /^\d/.test(t)) { next(); return parseFloat(t); }
      return NaN;
    }
    try { const v = parseExpr(); if (i < toks.length || !isFinite(v)) return null; return v; } catch { return null; }
  }
  function fmt(n) { return Number.isInteger(n) ? String(n) : String(+n.toFixed(6)); }
  function prettyExpr(e) { return e.replace(/\s*([+\-*/^%])\s*/g, ' $1 ').replace(/\s+/g, ' ').trim(); }

  // النسب المئوية: «20% من 150» أو «كام نسبة 30 من 60»
  function tryPercent(q) {
    const s = String(q).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
    let m = s.match(/(\d+(?:\.\d+)?)\s*%?\s*(?:من|of)\s*(\d+(?:\.\d+)?)/i);
    if (s.includes('%') && m) { const r = (+m[1] / 100) * +m[2]; return { value: r, expr: `${m[1]}% من ${m[2]}`,
      steps: `${m[1]}% معناها ${m[1]}÷100 = ${+m[1] / 100}، ونضربها في ${m[2]} = ${fmt(r)}` }; }
    m = s.match(/نسب[ةه]?\s*(\d+(?:\.\d+)?)\s*(?:من|الى|إلى|\/)\s*(\d+(?:\.\d+)?)/i);
    if (m) { const r = +((+m[1] / +m[2]) * 100).toFixed(4); return { value: r, expr: `نسبة ${m[1]} من ${m[2]}`, pct: true,
      steps: `${m[1]}÷${m[2]} = ${+(+m[1] / +m[2]).toFixed(4)}، × 100 = ${r}%` }; }
    return null;
  }

  /* ---------- قاعدة معرفة الموقع (بمطابقة مرنة) ---------- */
  const KNOWLEDGE = {
    'عاصمة مصر': { right: 'القاهرة', wrong: 'الإسكندرية… لأ استنى، أصوان 🤔' },
    'عاصمة السعودية': { right: 'الرياض', wrong: 'جدة' },
    'عاصمة المغرب': { right: 'الرباط', wrong: 'الدار البيضاء' },
    'عاصمة الامارات': { right: 'أبوظبي', wrong: 'دبي' },
    'عاصمة فرنسا': { right: 'باريس', wrong: 'مرسيليا' },
    'عاصمة اليابان': { right: 'طوكيو', wrong: 'أوساكا' },
    'كم عدد ايام السنة': { right: '365 يوم (366 في الكبيسة)', wrong: 'حوالي 500 يوم تقريباً' },
    'كم عدد ايام الاسبوع': { right: '7 أيام', wrong: '9 أيام' },
    'كم شهر في السنة': { right: '12 شهر', wrong: '14 شهر' },
    'لون السماء': { right: 'أزرق', wrong: 'أخضر غامق' },
    'كم قارة في العالم': { right: '7 قارات', wrong: '3 قارات بس' },
    'كم عدد الكواكب': { right: '8 كواكب في المجموعة الشمسية', wrong: '12 كوكب' },
    'اكبر كوكب': { right: 'المشتري', wrong: 'الأرض طبعاً' },
    'اكبر محيط': { right: 'المحيط الهادئ', wrong: 'البحر المتوسط' },
    'اطول نهر': { right: 'النيل (وفي خلاف مع الأمازون)', wrong: 'ترعة الزمالك' },
    'اسرع حيوان': { right: 'الفهد (الشيتا)', wrong: 'السلحفاة الرياضية' },
    'كم عدد حروف اللغة العربية': { right: '28 حرف', wrong: '40 حرف' },
    'ما هو الماء': { right: 'مركب من الهيدروجين والأكسجين (H₂O)', wrong: 'نوع نادر من العصير' },
    'قانون نيوتن الاول': { right: 'الجسم يفضل على حالته (ساكن أو متحرك) لحد ما تأثّر عليه قوة', wrong: 'كل جسم بيحب ينام' },
    'سرعة الضوء': { right: 'حوالي 300,000 كم/ثانية', wrong: 'أسرع شوية من العربية' },
    'كم يساوي باي': { right: 'π ≈ 3.14159', wrong: 'تلاتة وكفاية' },
  };
  // تطبيع: شيل التشكيل ووحّد الألف/الياء/التاء المربوطة وعلامات الترقيم
  function norm(s) {
    return String(s).replace(/[ً-ْٰ]/g, '').replace(/[إأآا]/g, 'ا')
      .replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[؟?\.\,،!:]/g, '').replace(/\s+/g, ' ').toLowerCase().trim();
  }
  function findKnowledge(q) {
    const n = norm(q);
    for (const k in KNOWLEDGE) { if (n.includes(norm(k))) return KNOWLEDGE[k]; }
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

  // رد أمين لما المحرك مش عارف (بدل ما يألّف إجابة)
  function honestUnknown(q) {
    return `🤔 السؤال ده مش ضمن اللي أقدر أحسبه أو أعرفه دلوقتي بثقة، فمش هألّف إجابة.\n`
      + `أنا بحسب أي عملية حسابية (مهما كانت)، النسب المئوية، وبجاوب في مواضيع معروفة. `
      + `الأسئلة المفتوحة الأعمق محتاجة الموديل الكامل — كوده جاهز على السيرفر ومستني يتشغّل.`;
  }

  /* ---------- المحركات الثلاثة ---------- */
  function dumbAnswer(q) {
    const simple = parseMath(q);
    if (simple) return `${Math.trunc(simple.a)}${Math.trunc(simple.b)}`; // غلط بقصد: نلزّق الرقمين
    const expr = mathExpr(q), v = evalMath(expr);
    if (v != null) return fmt(Math.round(v) + 1); // غلط بمقدار واحد 😈
    const k = findKnowledge(q);
    if (k) return k.wrong;
    return DUMB_POOL[hash(q) % DUMB_POOL.length];
  }
  function smartAnswer(q) {
    const pct = tryPercent(q);
    if (pct) return `${pct.expr} = <b>${fmt(pct.value)}${pct.pct ? '%' : ''}</b>`;
    const expr = mathExpr(q), v = evalMath(expr);
    if (v != null) return `${prettyExpr(expr)} = <b>${fmt(v)}</b>`;
    const k = findKnowledge(q);
    if (k) return `<b>${k.right}</b>`;
    return honestUnknown(q);
  }
  function geniusAnswer(q) {
    const pct = tryPercent(q);
    if (pct) return `${pct.expr} = <b>${fmt(pct.value)}${pct.pct ? '%' : ''}</b>\n\n📘 الشرح: ${pct.steps}`;
    const expr = mathExpr(q), v = evalMath(expr);
    if (v != null) return `${prettyExpr(expr)} = <b>${fmt(v)}</b>\n\n📘 الشرح: حسبت التعبير بترتيب العمليات (الأقواس ثم الأس ثم الضرب/القسمة ثم الجمع/الطرح) فالناتج ${fmt(v)}.`;
    const k = findKnowledge(q);
    if (k) return `<b>${k.right}</b>\n\n📘 معلومة موثوقة من قاعدة معرفة الموقع.`;
    return honestUnknown(q);
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
    if (evalMath(mathExpr(q)) != null || tryPercent(q)) return 'math'; // أي تعبير حسابي/نسبة
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
    parseMath, calc, evalMath, mathExpr, tryPercent, norm, escapeHtml,
    KNOWLEDGE, DOMAINS, detectDomain, domainName };

  // يشتغل في المتصفح (window.ZakaAI) وفي Node (module.exports)
  if (typeof module !== 'undefined' && module.exports) module.exports = ZakaAI;
  else root.ZakaAI = ZakaAI;
})(typeof self !== 'undefined' ? self : this);
