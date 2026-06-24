/* ============================================================
   ZakaAI — «المخ» الحقيقي (نقطة وصل النموذج اللغوي)
   ------------------------------------------------------------
   ⚠️ الحقيقة اللي لازم تكون واضحة:
   الردود اللي «ليها علاقة بالسؤال» لأي سؤال مفتوح مستحيل تتعمل بـ
   JavaScript بسيط. محتاجة «نموذج لغوي» (LLM) — مليارات المعاملات،
   بيتشغّل على سيرفر فيه GPU. الملف ده هو المكان اللي بنوصّل منه
   الموقع بموديل حقيقي، من غير ما نلمس الواجهة.

   عشان يفضل «الـAI بتاع الموقع» (مش كلود/خارجي): وجّهه على موديل
   مفتوح المصدر إنت مستضيفه — أي سيرفر متوافق مع OpenAI API:
     • Ollama        →  http://localhost:11434/v1/chat/completions
     • vLLM / LM Studio / llama.cpp server … إلخ

   الإعداد عن طريق متغيرات البيئة (مفيش مفاتيح في الكود):
     ZAKA_AI_URL    عنوان الموديل (OpenAI-compatible /chat/completions)
     ZAKA_AI_MODEL  اسم الموديل (مثلاً: llama3.1 أو mistral)
     ZAKA_AI_KEY    اختياري (لو السيرفر بيطلب مفتاح)

   لو مفيش إعداد → think() بترجع null، والموقع بيرجع للمحرك الحسابي.
============================================================ */
'use strict';

const URL = process.env.ZAKA_AI_URL || '';
const MODEL = process.env.ZAKA_AI_MODEL || 'llama3.1';
const KEY = process.env.ZAKA_AI_KEY || '';

function isConfigured() { return !!URL; }

const SYSTEM = {
  smart: 'أنت مساعد الموقع. جاوب بالعربي باختصار ودقة على سؤال المستخدم مباشرة.',
  genius: 'أنت مدرّس خبير. جاوب بالعربي بدقة، مع شرح مبسّط وخطوات وأمثلة لما يلزم.',
};

// بترجّع نص الإجابة من الموديل، أو null لو مش متظبّط/حصل خطأ.
async function think(question, tier) {
  if (!isConfigured()) return null;
  try {
    const res = await fetch(URL, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' },
        KEY ? { Authorization: `Bearer ${KEY}` } : {}),
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM[tier] || SYSTEM.smart },
          { role: 'user', content: String(question).slice(0, 4000) },
        ],
        temperature: tier === 'genius' ? 0.7 : 0.3,
        stream: false,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    return (text && text.trim()) ? text.trim() : null;
  } catch {
    return null; // أي مشكلة → رجوع آمن للمحرك المحلي
  }
}

module.exports = { isConfigured, think, MODEL };
