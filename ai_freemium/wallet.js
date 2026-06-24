/* ============================================================
   ZakaAI — منطق المحفظة والربح (جانب السيرفر)
   ------------------------------------------------------------
   في تطبيق حقيقي، الخصم والتحقق من الرصيد لازم يحصلوا في السيرفر
   مش في المتصفح (عشان حد ما يغشّش الرصيد من الـconsole). الموديول ده
   بيحط منطق المحفظة في مكان واحد آمن، بيستخدمه server.js.

   بيشتغل في Node (module.exports) وفي المتصفح (window.ZakaWallet).
============================================================ */
(function (root) {
  'use strict';
  const ZakaAI = (typeof require !== 'undefined') ? require('./engine.js') : root.ZakaAI;

  const PRICE = { smart: 0.10, genius: 0.30, videoSub: 10.00 };
  const VIDEO_DAILY_SECONDS = 300;
  const AD_REVENUE = 0.004;

  function newAccount() {
    return {
      balance: 2.00, diamonds: 50,
      videoSub: false, videoSecondsLeft: VIDEO_DAILY_SECONDS, lastDay: today(),
      domains: {}, ledger: [],
      stats: { revenue: 0, adImpressions: 0, adRevenue: 0, questions: 0, videos: 0 },
    };
  }
  function today() { return new Date().toISOString().slice(0, 10); }

  function logTx(a, type, label, amount) {
    a.ledger.unshift({ t: Date.now(), type, label, amount, balance: +a.balance.toFixed(2) });
    if (a.ledger.length > 100) a.ledger.length = 100;
  }
  function refreshIfNewDay(a) {
    if (a.videoSub && a.lastDay !== today()) { a.videoSecondsLeft = VIDEO_DAILY_SECONDS; a.lastDay = today(); }
  }

  // خصم من المستخدم = دخل للموقع. بيرمي خطأ لو الرصيد مش كفاية.
  function charge(a, amount, label) {
    if (a.balance < amount) { const e = new Error('INSUFFICIENT_FUNDS'); e.code = 'INSUFFICIENT_FUNDS'; throw e; }
    a.balance = +(a.balance - amount).toFixed(4);
    a.stats.revenue = +(a.stats.revenue + amount).toFixed(4);
    logTx(a, 'charge', label, -amount);
  }
  function topup(a, dollars, diamonds) {
    a.balance = +(a.balance + dollars).toFixed(4);
    a.diamonds += (diamonds || 0);
    logTx(a, 'topup', `شحن محفظة (+${diamonds || 0}💎)`, dollars);
    return a;
  }
  function recordAd(a) {
    a.stats.adImpressions++;
    a.stats.adRevenue = +(a.stats.adRevenue + AD_REVENUE).toFixed(4);
    a.stats.revenue = +(a.stats.revenue + AD_REVENUE).toFixed(4);
    logTx(a, 'ad', 'ظهور إعلان (نسخة مجانية)', AD_REVENUE);
    return a;
  }
  function unlockDomain(a, id) {
    const d = (ZakaAI.DOMAINS || []).find(x => x.id === id);
    if (!d) { const e = new Error('UNKNOWN_DOMAIN'); e.code = 'UNKNOWN_DOMAIN'; throw e; }
    if (a.domains[id]) return a; // مفتوح بالفعل
    charge(a, d.price, `حزمة ذكاء: ${d.name}`);
    a.domains[id] = true;
    return a;
  }
  function subscribeVideo(a) {
    if (a.videoSub) return a;
    charge(a, PRICE.videoSub, 'اشتراك استوديو الفيديو (شهري)');
    a.videoSub = true; a.videoSecondsLeft = VIDEO_DAILY_SECONDS; a.lastDay = today();
    return a;
  }

  // السؤال: بيطبّق قواعد الطبقات + المجالات + الخصم، ويرجّع الرد + الرصيد الجديد.
  function ask(a, question, tier) {
    refreshIfNewDay(a);
    const unlocked = Object.keys(a.domains).filter(k => a.domains[k]);
    const dom = ZakaAI.detectDomain(question);

    // مجال مفتوح → رد مدرّس مجاني
    if (dom && unlocked.includes(dom)) {
      a.stats.questions++;
      const r = ZakaAI.ask(question, tier, { domains: unlocked });
      return Object.assign(r, { cost: 0, balance: a.balance });
    }
    if (tier === 'free') {
      return Object.assign(ZakaAI.ask(question, 'free'), { cost: 0, balance: a.balance });
    }
    const cost = PRICE[tier] || 0;
    charge(a, cost, `سؤال ${tier}`); // بيرمي لو مش كفاية
    a.stats.questions++;
    return Object.assign(ZakaAI.ask(question, tier), { cost, balance: a.balance });
  }

  const ZakaWallet = {
    PRICE, VIDEO_DAILY_SECONDS, AD_REVENUE,
    newAccount, charge, topup, recordAd, unlockDomain, subscribeVideo, ask, refreshIfNewDay,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = ZakaWallet;
  else root.ZakaWallet = ZakaWallet;
})(typeof self !== 'undefined' ? self : this);
