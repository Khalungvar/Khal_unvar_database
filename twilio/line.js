// ☎ קו התרומות הטלפוני של קמפיין "אור התורה" — (845) 609-0400.
// רץ ב-Twilio Functions (שירות "orhatorah-line", פונקציה /line, Protected = רק Twilio יכול לקרוא).
// הסדר: פתיחה → סכום + # → <Pay> (ההקראה של הסכום בתוך ההודעה הראשונה; * בכל רגע = שינוי סכום) →
// תודה → הקלטת שם → קבלה במייל? 1/2 → הקלטת אימייל → Gemini (דרך השומר) → הקראה אות-אות → 1 אישור / 2 שוב → סיום.
// הכרטיס נקלט ע"י Twilio (Stripe_Connector) ולא עובר אצלנו. כל תרומה נרשמת בשומר (twDonation) → Donations + WebDonations.
// משתני סביבה (בשירות ב-Twilio, לא כאן): GUARD_URL, LINE_KEY, CONNECTOR (ברירת מחדל Stripe_Connector), CAMPAIGN (orhatorah).

const VOICE = { voice: 'Polly.Matthew-Neural', language: 'en-US' };
const MAX = 50000;

function url(step, q) {
  const p = new URLSearchParams(Object.assign({ step }, q || {}));
  return '/line?' + p.toString();
}
function say(node, text) { node.say(VOICE, text); }
function money(n) { return Number(n).toLocaleString('en-US') + ' dollar' + (Number(n) === 1 ? '' : 's'); }

async function guard(context, body) {
  const r = await fetch(context.GUARD_URL, {
    method: 'POST', headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(Object.assign({ action: 'twDonation', k: context.LINE_KEY, c: context.CAMPAIGN || 'orhatorah' }, body)),
    redirect: 'follow'
  });
  const t = await r.text();
  try { return JSON.parse(t); } catch (e) { return { error: 'bad-reply', raw: t.slice(0, 200) }; }
}
// השומר (Apps Script) איטי (3–15 שניות), ול-Twilio Function יש 10 שניות בלבד —
// לכן לא מחכים לו יותר מ-ms: הבקשה כבר יצאה והשומר ממשיך לבד. כפילות נחסמת בשומר (לפי CallSid).
function guardSoon(context, body, ms) {
  return Promise.race([guard(context, body).catch((e) => ({ error: String(e && e.message) })), new Promise((r) => setTimeout(() => r({ pending: true }), ms))]);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// נתוני התשלום עוברים הלאה בכתובות (a=סכום, c=אישור Stripe, l=4 ספרות, f=המתקשר) — כדי שהשומר יוכל לרשום גם אם הרישום הראשון לא הגיע
function paidQ(event, n) { return { a: n, c: event.PaymentConfirmationCode || event.c || '', l: String(event.PaymentCardNumber || event.l || '').slice(-4), f: event.From || event.f || '' }; }
function paidData(q) { return { amount: parseInt(q.a, 10), conf: q.c || '', last4: q.l || '', from: q.f || '' }; }

function askAmount(tw, text, tries) {
  const g = tw.gather({ input: 'dtmf', finishOnKey: '#', timeout: 10, action: url('amount', { t: tries || 0 }), actionOnEmptyResult: true });
  say(g, text || 'Please enter the amount of your donation, followed by the pound key.');
}

// התשלום: ההודעה הראשונה כוללת את הסכום; כל ההודעות בקול שלנו
function goPay(tw, context, n) {
  const pay = tw.pay({
    paymentConnector: context.CONNECTOR || 'Stripe_Connector',
    chargeAmount: Number(n).toFixed(2), currency: 'usd',
    description: 'Ohr HaTorah donation (phone line)',
    postalCode: true, securityCode: true, timeout: 8, maxAttempts: 3,
    language: 'en-US', action: url('paid', { a: n })
  });
  const P = (attrs, text) => say(pay.prompt(attrs), text);
  P({ for: 'payment-card-number', attempt: '1' }, money(n) + '. To change the amount, press star. Please enter your card number, followed by the pound key.');
  P({ for: 'payment-card-number', errorType: 'timeout' }, 'Please enter your card number, followed by the pound key.');
  P({ for: 'payment-card-number', errorType: 'invalid-card-number' }, 'That card number is not valid. Please enter your card number again, followed by the pound key.');
  P({ for: 'payment-card-number', errorType: 'invalid-card-type' }, 'That card type is not accepted. Please enter a different card number, followed by the pound key.');
  P({ for: 'expiration-date' }, 'Please enter the expiration date: two digits for the month, and two digits for the year.');
  P({ for: 'expiration-date', errorType: 'timeout invalid-date' }, 'That date is not valid. Please enter the expiration date: two digits for the month, and two digits for the year.');
  P({ for: 'security-code' }, 'Please enter the security code on your card, followed by the pound key.');
  P({ for: 'security-code', errorType: 'timeout invalid-security-code' }, 'That code is not valid. Please enter the security code on your card, followed by the pound key.');
  P({ for: 'postal-code' }, 'Please enter the billing zip code, followed by the pound key.');
  P({ for: 'postal-code', errorType: 'timeout invalid-postal-code' }, 'That zip code is not valid. Please enter the billing zip code, followed by the pound key.');
  P({ for: 'payment-processing' }, 'Please wait while we process your payment.');
}

// הקראה אות-אות: "y k l e i n, at, g m a i l, dot, c o m"
function spellEmail(node, email) {
  const s = node.say(VOICE, 'Your email is: ');
  String(email).split(/([@.])/).forEach((part) => {
    if (!part) return;
    if (part === '@') s.addText(' at, ');
    else if (part === '.') s.addText(' dot, ');
    else { s.sayAs({ 'interpret-as': 'spell-out' }, part); s.addText(', '); }
  });
}

function bye(tw) { say(tw, 'Thank you, and may you be blessed. Goodbye.'); tw.hangup(); }

exports.handler = async function (context, event, callback) {
  const tw = new Twilio.twiml.VoiceResponse();
  const step = event.step || '';
  const done = () => callback(null, tw);
  try {
    // ---------- פתיחה ----------
    if (!step) {
      say(tw, 'Ungvar Kollelim, Ohr HaTorah campaign.');
      askAmount(tw);
      return done();
    }

    // ---------- הסכום → ישר לתשלום ----------
    if (step === 'amount') {
      const n = parseInt(String(event.Digits || '').replace(/\D/g, ''), 10);
      const tries = Number(event.t || 0);
      if (!(n >= 1 && n <= MAX)) {
        if (tries >= 2) { say(tw, 'We did not receive a valid amount. Please call again. Goodbye.'); tw.hangup(); return done(); }
        askAmount(tw, (event.Digits ? 'Sorry, that amount is not valid. ' : '') + 'Please enter the amount of your donation, followed by the pound key.', tries + 1);
        return done();
      }
      goPay(tw, context, n);
      return done();
    }

    // ---------- תוצאת התשלום ----------
    if (step === 'paid') {
      const n = parseInt(event.a, 10);
      if (event.Result === 'caller-interrupted-with-star') { askAmount(tw, 'Please enter the new amount, followed by the pound key.'); return done(); }
      if (event.Result !== 'success') {
        console.log('pay failed', event.Result, event.PaymentError || '', event.PayErrorCode || '', event.ConnectorError || '');
        if (event.Result === 'caller-hung-up') return done();
        const g = tw.gather({ input: 'dtmf', numDigits: 1, timeout: 8, action: url('retry', { a: n }), actionOnEmptyResult: true });
        say(g, 'Sorry, the payment did not go through, and your card was not charged. To try again, press 1. To change the amount, press star.');
        bye(tw);
        return done();
      }
      const q = paidQ(event, n);
      // הרישום בשומר יוצא עכשיו ורץ ברקע — לא מחכים לו
      const g0 = await guardSoon(context, { stage: 'paid', call: event.CallSid, from: q.f, amount: n, conf: q.c, last4: q.l }, 600);
      if (!g0.ok) console.log('guard paid', JSON.stringify(g0));
      say(tw, 'Thank you! Your donation of ' + money(n) + ' was received.');
      say(tw, 'After the beep, please say your full name, then press the pound key.');
      tw.record({
        maxLength: 15, timeout: 3, finishOnKey: '#', playBeep: true, trim: 'trim-silence',
        action: url('receipt', q), recordingStatusCallback: url('rec', Object.assign({ call: event.CallSid, kind: 'name' }, q)), recordingStatusCallbackEvent: 'completed'
      });
      tw.redirect(url('receipt', q));
      return done();
    }

    if (step === 'retry') {
      const n = parseInt(event.a, 10);
      if (event.Digits === '1') { goPay(tw, context, n); return done(); }
      if (event.Digits === '*') { askAmount(tw, 'Please enter the new amount, followed by the pound key.'); return done(); }
      bye(tw); return done();
    }

    // ---------- קבלה במייל? ----------
    if (step === 'receipt') {
      const q = paidQ(event, event.a);
      const g = tw.gather({ input: 'dtmf', numDigits: 1, timeout: 6, action: url('receipt2', q), actionOnEmptyResult: true });
      say(g, 'For a receipt by email, press 1. Otherwise, press 2.');
      bye(tw);
      return done();
    }
    if (step === 'receipt2') {
      if (event.Digits !== '1') { bye(tw); return done(); }
      const q = paidQ(event, event.a);
      say(tw, 'After the beep, please say your email address, then press the pound key.');
      tw.record({ maxLength: 30, timeout: 4, finishOnKey: '#', playBeep: true, trim: 'trim-silence', action: url('email', Object.assign({ n: 1 }, q)) });
      bye(tw);
      return done();
    }

    // ---------- ההקלטה של האימייל → השומר (Gemini) ----------
    if (step === 'email') {
      const q = paidQ(event, event.a); const n = Number(event.n || 1);
      if (!event.RecordingUrl) { say(tw, 'We did not hear an email address.'); bye(tw); return done(); }
      const auth = 'Basic ' + Buffer.from(context.ACCOUNT_SID + ':' + context.AUTH_TOKEN).toString('base64');
      let audio = '';
      for (let i = 0; i < 5 && !audio; i++) {
        const r = await fetch(event.RecordingUrl + '.mp3', { headers: { Authorization: auth } });
        if (r.ok) audio = Buffer.from(await r.arrayBuffer()).toString('base64'); else await sleep(600);
      }
      if (!audio) { console.error('email rec fetch failed'); say(tw, 'We will send your receipt by email shortly.'); bye(tw); return done(); }
      await guardSoon(context, { stage: 'email', call: event.CallSid, n, audio, mime: 'audio/mpeg' }, 1500);
      say(tw, 'One moment please.');
      tw.pause({ length: 3 });
      tw.redirect(url('emailchk', Object.assign({ n, k: 0 }, q)));
      return done();
    }
    if (step === 'emailchk') {
      const q = paidQ(event, event.a); const n = Number(event.n || 1); const k = Number(event.k || 0);
      const r = await guardSoon(context, { stage: 'emailget', call: event.CallSid, n }, 7000);
      if (r.ok && r.email) {
        const g = tw.gather({ input: 'dtmf', numDigits: 1, timeout: 6, action: url('emailok', Object.assign({ n, e: r.email }, q)), actionOnEmptyResult: true });
        spellEmail(g, r.email);
        say(g, 'If this is correct, press 1. To try again, press 2.');
        bye(tw);
        return done();
      }
      if (!r.ok && k < 4) { tw.pause({ length: 2 }); tw.redirect(url('emailchk', Object.assign({ n, k: k + 1 }, q))); return done(); }
      // לא הבנו / לא הגיע
      if (n < 2) {
        say(tw, 'Sorry, we could not understand the email address. After the beep, please say it again, slowly, then press the pound key.');
        tw.record({ maxLength: 30, timeout: 4, finishOnKey: '#', playBeep: true, trim: 'trim-silence', action: url('email', Object.assign({ n: n + 1 }, q)) });
        bye(tw);
        return done();
      }
      say(tw, 'We will send your receipt by email shortly.'); bye(tw); return done();
    }
    if (step === 'emailok') {
      const q = paidQ(event, event.a); const n = Number(event.n || 1);
      if (event.Digits === '1') {
        await guardSoon(context, { stage: 'emailok', call: event.CallSid, email: event.e, paid: paidData(q) }, 600);
        say(tw, 'Your receipt will be sent by email.');
        bye(tw);
        return done();
      }
      if (event.Digits === '2' && n < 3) {
        say(tw, 'After the beep, please say your email address again, slowly, then press the pound key.');
        tw.record({ maxLength: 30, timeout: 4, finishOnKey: '#', playBeep: true, trim: 'trim-silence', action: url('email', Object.assign({ n: n + 1 }, q)) });
        bye(tw);
        return done();
      }
      if (event.Digits === '2') { say(tw, 'We will send your receipt by email shortly.'); }
      bye(tw);
      return done();
    }

    // ---------- הקלטת השם מוכנה (Twilio קורא לבד, אין מתקשר) ----------
    if (step === 'rec') {
      if (event.RecordingStatus !== 'completed' || !event.RecordingUrl) return callback(null, {});
      const auth = 'Basic ' + Buffer.from(context.ACCOUNT_SID + ':' + context.AUTH_TOKEN).toString('base64');
      const r = await fetch(event.RecordingUrl + '.mp3', { headers: { Authorization: auth } });
      if (!r.ok) { console.error('rec fetch', r.status); return callback(null, {}); }
      const audio = Buffer.from(await r.arrayBuffer()).toString('base64');
      const res = await guardSoon(context, { stage: 'rec', kind: event.kind || 'name', call: event.call || event.CallSid, audio, mime: 'audio/mpeg', paid: paidData(event) }, 8000);
      console.log('guard rec', JSON.stringify(res));
      return callback(null, {});
    }

    bye(tw);
    return done();
  } catch (e) {
    console.error('line error', e && e.stack || e);
    const t = new Twilio.twiml.VoiceResponse();
    say(t, 'Sorry, something went wrong. Please call again later. Goodbye.');
    t.hangup();
    return callback(null, t);
  }
};
