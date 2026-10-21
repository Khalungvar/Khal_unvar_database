/**
 * קהל אונגוואר — הילף-AI (Google Apps Script).
 *
 * וואס עס טוט: באקומט א שאלה פונעם אתר, קוקט אז דער פרעגער איז א מנהל/גבאי (לויט Settings אינעם שיט),
 * לייענט דעם פירער (help/guide.md + guide.en.md) פונעם אתר, און פרעגט Gemini — וואס ענטפערט נאר לויט דעם פירער.
 *
 * דער שליסל (API key) איז נישט דא! ער שטייט נאר אין: Project Settings ← Script Properties ← GEMINI_API_KEY.
 * (נישט געמוזט: GEMINI_MODEL — דיפאלט gemini-flash-latest; DAILY_LIMIT — דיפאלט 40 שאלות א טאג פער מענטש;
 *  MAX_TOKENS — די לענג פונעם ענטפער, דיפאלט 4096. די נייע מאדעלן "טראכטן" אויך מיט די טאקענס — דערפאר גרויס.)
 */

const SITE = 'https://app.ungvar.org/';
const SHEET_ID = '16gyhQ4W7p2DHjPMtdXldFynG1KUzDypGvTvYlS7cnJY';

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents || '{}');
    const question = String(req.question || '').trim().slice(0, 800);
    if (!question) return out({ error: 'empty' });

    // 1) ווער פרעגט? (דער Google טאקען פונעם אתר → אימעיל → צי ער איז אין Settings)
    const email = whoIs(req.token);
    if (!email || !allowed(email)) return out({ error: 'not-allowed' });

    // 2) נישט מער ווי X שאלות א טאג פער מענטש (כדי נישט אויסצונוצן דעם חינם-לימיט)
    const props = PropertiesService.getScriptProperties();
    const limit = Number(props.getProperty('DAILY_LIMIT') || 40);
    const day = Utilities.formatDate(new Date(), 'America/New_York', 'yyyy-MM-dd');
    const cache = CacheService.getScriptCache();
    const k = 'n:' + day + ':' + email;
    const n = Number(cache.get(k) || 0);
    if (n >= limit) return out({ error: 'daily-limit' });
    cache.put(k, String(n + 1), 21600);

    // 3) דער פירער
    const guide = guideText();

    // 4) Gemini
    const key = props.getProperty('GEMINI_API_KEY');
    if (!key) return out({ error: 'no-key' });
    const model = props.getProperty('GEMINI_MODEL') || 'gemini-flash-latest';
    const system = [
      'You are the help assistant of the "Khal Ungvar" community database website, used by gabbaim.',
      'Answer ONLY from the guide below. If the guide does not cover it, say you do not know and suggest asking an admin (in Personal area → messages).',
      'Answer in the language of the question: Yiddish (Hebrew letters) if the question is in Yiddish or Hebrew, English if in English.',
      'Be short and practical: numbered steps, with the exact button names in **bold** as written in the guide (in the matching language).',
      'Never invent buttons or features. Do not ask for or repeat personal data.',
      '',
      '=== GUIDE ===',
      guide,
    ].join('\n');
    const res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-goog-api-key': key },
      muteHttpExceptions: true,
      payload: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: question }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: Number(props.getProperty('MAX_TOKENS') || 4096) },
      }),
    });
    if (res.getResponseCode() !== 200) return out({ error: 'ai-' + res.getResponseCode(), detail: res.getContentText().slice(0, 300) });
    const data = JSON.parse(res.getContentText());
    const parts = (((data.candidates || [])[0] || {}).content || {}).parts || [];
    const answer = parts.map(function (p) { return p.text || ''; }).join('').trim();
    return out(answer ? { answer: answer } : { error: 'empty-answer' });
  } catch (err) {
    return out({ error: String(err).slice(0, 200) });
  }
}

/** א פראבע פונעם עדיטאר: Run ← testAsk (קוקט צי דער שליסל און דער פירער ארבעטן) */
function testAsk() {
  const props = PropertiesService.getScriptProperties();
  Logger.log('key set: ' + Boolean(props.getProperty('GEMINI_API_KEY')));
  Logger.log('guide chars: ' + guideText().length);
  Logger.log('allowed (8510089): ' + allowed('8510089@gmail.com'));
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function whoIs(token) {
  if (!token) return '';
  const cache = CacheService.getScriptCache();
  const hit = cache.get('t:' + token.slice(-24));
  if (hit) return hit;
  const r = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(token), { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return '';
  const email = String(JSON.parse(r.getContentText()).email || '').toLowerCase();
  if (email) cache.put('t:' + token.slice(-24), email, 1800);
  return email;
}

function allowed(email) {
  const cache = CacheService.getScriptCache();
  let list = cache.get('allowed');
  if (!list) {
    const rows = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Settings').getDataRange().getValues();
    const head = rows[0].map(String);
    const cols = ['admin_email', 'gabbai_email', 'owner_email'].map(function (h) { return head.indexOf(h); }).filter(function (i) { return i >= 0; });
    const emails = [];
    rows.slice(1).forEach(function (r) { cols.forEach(function (i) { const v = String(r[i] || '').trim().toLowerCase(); if (v) emails.push(v); }); });
    list = emails.join(',');
    cache.put('allowed', list, 600);
  }
  return list.split(',').indexOf(email) >= 0;
}

function guideText() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('guide');
  if (hit) return hit;
  const get = function (f) { return UrlFetchApp.fetch(SITE + 'help/' + f + '?t=' + Date.now(), { muteHttpExceptions: true }).getContentText(); };
  const text = ('--- YIDDISH GUIDE ---\n' + get('guide.md') + '\n\n--- ENGLISH GUIDE ---\n' + get('guide.en.md'))
    .replace(/<!--[\s\S]*?-->/g, '');
  try { cache.put('guide', text, 1800); } catch (e) { /* צו גרויס פאר קעש — נישט קיין פראבלעם */ }
  return text;
}
