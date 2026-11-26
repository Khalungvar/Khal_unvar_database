// ☎ קו התרומות הטלפוני של קמפיין "אור התורה" — (845) 609-0400.
// רץ ב-Twilio Functions (שירות "orhatorah-line", פונקציה /line, Protected = רק Twilio יכול לקרוא).
// הקו באנגלית: סכום → אישור → <Pay> (Stripe_Connector, הכרטיס נקלט ע"י Twilio ולא עובר אצלנו) →
// הקלטת שם + אימייל לקבלה → תודה. כל תרומה נרשמת בשומר (twDonation) → Donations + WebDonations.
// משתני סביבה (בשירות ב-Twilio, לא כאן): GUARD_URL, LINE_KEY, CONNECTOR (ברירת מחדל Stripe_Connector), CAMPAIGN (orhatorah).
// ההקלטה נשלחת לשומר מ-recordingStatusCallback (step=rec), השומר שומר בדרייב ו-Gemini מתמלל.

const VOICE = { voice: 'Polly.Joanna-Neural', language: 'en-US' };
const MAX = 50000;

function url(step, q) {
  const p = new URLSearchParams(Object.assign({ step }, q || {}));
  return '/line?' + p.toString();
}
function say(node, text) { node.say(VOICE, text); }
function money(n) {
  const d = Math.floor(n), c = Math.round((n - d) * 100);
  return d.toLocaleString('en-US') + ' dollar' + (d === 1 ? '' : 's') + (c ? ' and ' + c + ' cents' : '');
}

async function guard(context, body) {
  const r = await fetch(context.GUARD_URL, {
    method: 'POST', headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(Object.assign({ action: 'twDonation', k: context.LINE_KEY, c: context.CAMPAIGN || 'orhatorah' }, body)),
    redirect: 'follow'
  });
  const t = await r.text();
  try { return JSON.parse(t); } catch (e) { return { error: 'bad-reply', raw: t.slice(0, 200) }; }
}

// השומר (Apps Script) לפעמים איטי (3–15 שניות), ול-Twilio Function יש 10 שניות בלבד —
// לכן לא מחכים לו יותר מ-ms: הבקשה כבר נשלחה והשומר ממשיך לבד. כפילות נחסמת בשומר (לפי CallSid).
function guardSoon(context, body, ms) {
  return Promise.race([guard(context, body).catch((e) => ({ error: String(e && e.message) })), new Promise((r) => setTimeout(() => r({ pending: true }), ms))]);
}
function paidBody(event, n) {
  return { stage: 'paid', call: event.CallSid, from: event.From, amount: n, conf: event.PaymentConfirmationCode || '', last4: event.PaymentCardNumber || '' };
}

function askAmount(tw) {
  const g = tw.gather({ input: 'dtmf', finishOnKey: '#', timeout: 10, action: url('amount'), actionOnEmptyResult: true });
  say(g, 'Please enter the amount of your donation in whole dollars, followed by the pound key.');
}

exports.handler = async function (context, event, callback) {
  const tw = new Twilio.twiml.VoiceResponse();
  const step = event.step || '';
  const done = () => callback(null, tw);
  try {
    // ---------- שלב 0: ברוכים הבאים ----------
    if (!step) {
      say(tw, 'Thank you for calling the Ohr HaTorah campaign of Kollel Ungvar. Your donation supports the Torah learning of our Kollel.');
      askAmount(tw);
      return done();
    }

    // ---------- שלב 1: הסכום ----------
    if (step === 'amount') {
      const n = parseInt(String(event.Digits || '').replace(/\D/g, ''), 10);
      const tries = Number(event.t || 0);
      if (!(n >= 1 && n <= MAX)) {
        if (tries >= 2) { say(tw, 'We did not receive a valid amount. Please call again. Goodbye.'); tw.hangup(); return done(); }
        say(tw, event.Digits ? 'Sorry, that amount is not valid.' : 'We did not receive an amount.');
        const g = tw.gather({ input: 'dtmf', finishOnKey: '#', timeout: 10, action: url('amount', { t: tries + 1 }), actionOnEmptyResult: true });
        say(g, 'Please enter the amount of your donation in whole dollars, followed by the pound key.');
        return done();
      }
      const g = tw.gather({ input: 'dtmf', numDigits: 1, timeout: 8, action: url('confirm', { a: n }), actionOnEmptyResult: true });
      say(g, 'You entered ' + money(n) + '. To confirm, press 1. To change the amount, press 2.');
      return done();
    }

    // ---------- שלב 2: אישור → תשלום ----------
    if (step === 'confirm') {
      const n = parseInt(event.a, 10);
      if (event.Digits === '2' || !(n >= 1 && n <= MAX)) { askAmount(tw); return done(); }
      if (event.Digits !== '1') {
        const tries = Number(event.t || 0);
        if (tries >= 2) { say(tw, 'Goodbye.'); tw.hangup(); return done(); }
        const g = tw.gather({ input: 'dtmf', numDigits: 1, timeout: 8, action: url('confirm', { a: n, t: tries + 1 }), actionOnEmptyResult: true });
        say(g, 'To donate ' + money(n) + ', press 1. To change the amount, press 2.');
        return done();
      }
      say(tw, 'Please have your credit card ready.');
      tw.pay({
        paymentConnector: context.CONNECTOR || 'Stripe_Connector',
        chargeAmount: n.toFixed(2), currency: 'usd',
        description: 'Ohr HaTorah donation (phone line)',
        postalCode: true, securityCode: true, timeout: 8, maxAttempts: 2,
        language: 'en-US', action: url('paid', { a: n })
      });
      return done();
    }

    // ---------- שלב 3: תוצאת התשלום ----------
    if (step === 'paid') {
      const n = parseInt(event.a, 10);
      if (event.Result !== 'success') {
        console.log('pay failed', event.Result, event.PaymentError || '', event.PayErrorCode || '', event.ConnectorError || '');
        const g = tw.gather({ input: 'dtmf', numDigits: 1, timeout: 8, action: url('confirm', { a: n, t: 2 }), actionOnEmptyResult: true });
        say(g, 'Sorry, the payment did not go through, and your card was not charged. To try again, press 1. To change the amount, press 2.');
        return done();
      }
      const g0 = await guardSoon(context, paidBody(event, n), 3500);
      if (!g0.ok) console.log('guard paid', JSON.stringify(g0));
      say(tw, 'Thank you! Your donation of ' + money(n) + ' was received successfully.');
      say(tw, 'After the beep, please say your full name. If you would like a receipt by email, please also say your email address, slowly. Then press the pound key.');
      tw.record({
        maxLength: 40, timeout: 5, finishOnKey: '#', playBeep: true, trim: 'trim-silence',
        action: url('bye'), recordingStatusCallback: url('rec', { call: event.CallSid, a: n, c: event.PaymentConfirmationCode || '', l: String(event.PaymentCardNumber || '').slice(-4), f: event.From || '' }), recordingStatusCallbackEvent: 'completed'
      });
      say(tw, 'Thank you and may you be blessed. Goodbye.');
      tw.hangup();
      return done();
    }

    // ---------- שלב 4: סוף ----------
    if (step === 'bye') {
      say(tw, 'Thank you! Your donation will help support Torah learning. May you be blessed with all good things. Goodbye.');
      tw.hangup();
      return done();
    }

    // ---------- הקלטה מוכנה (Twilio קורא לבד, אין מתקשר) ----------
    if (step === 'rec') {
      if (event.RecordingStatus !== 'completed' || !event.RecordingUrl) return callback(null, {});
      const auth = 'Basic ' + Buffer.from(context.ACCOUNT_SID + ':' + context.AUTH_TOKEN).toString('base64');
      const r = await fetch(event.RecordingUrl + '.mp3', { headers: { Authorization: auth } });
      if (!r.ok) { console.error('rec fetch', r.status); return callback(null, {}); }
      const audio = Buffer.from(await r.arrayBuffer()).toString('base64');
      const call = event.call || event.CallSid;
      const res = await guardSoon(context, { stage: 'rec', call, audio, mime: 'audio/mpeg', paid: { amount: parseInt(event.a, 10), conf: event.c || '', last4: event.l || '', from: event.f || '' } }, 8000);
      console.log('guard rec', JSON.stringify(res));
      return callback(null, {});
    }

    say(tw, 'Goodbye.'); tw.hangup();
    return done();
  } catch (e) {
    console.error('line error', e && e.stack || e);
    const t = new Twilio.twiml.VoiceResponse();
    say(t, 'Sorry, something went wrong. Please call again later. Goodbye.');
    t.hangup();
    return callback(null, t);
  }
};
