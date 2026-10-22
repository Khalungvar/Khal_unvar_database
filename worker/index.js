/**
 * מוסדות אונגוואר — Cloudflare Worker ("דער טיר").
 * באקומט פון Telnyx (SMS / טעלעפאנען) און פון Stripe (תשלומים), באשטעטיגט אז עס איז באמת פון זיי,
 * און גיט עס איבער צום "מוח" (Apps Script) מיטן SHARED_SECRET.
 *
 * Settings → Variables and Secrets (אלעס "Secret"):
 *   APPS_SCRIPT_URL        — די /exec אדרעס פונעם SMS Apps Script
 *   SHARED_SECRET          — א לאנגער צופעליגער טעקסט (דער זעלבער אין Apps Script)
 *   TELNYX_PUBLIC_KEY      — פון Telnyx: Account Settings → Keys & Credentials → Public Key
 *   STRIPE_WEBHOOK_SECRET  — whsec_... פון Stripe (Developers → Webhooks)
 */
const enc = new TextEncoder();
const xml = (s) => new Response(s, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
const b64bytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const hex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
const texml = (inner) => `<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`;

async function brain(env, payload) {
  const r = await fetch(env.APPS_SCRIPT_URL, {
    method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ ...payload, secret: env.SHARED_SECRET }),
  });
  const txt = await r.text();
  try { return JSON.parse(txt); } catch { return { error: `brain ${r.status}` }; }
}

/** Telnyx: ed25519 אויף "timestamp|body"; נישט עלטער ווי 5 מינוט */
export async function verifyTelnyx(env, req, body) {
  const sig = req.headers.get('telnyx-signature-ed25519');
  const ts = req.headers.get('telnyx-timestamp');
  if (!sig || !ts || !env.TELNYX_PUBLIC_KEY) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  let key;
  try { key = await crypto.subtle.importKey('raw', b64bytes(env.TELNYX_PUBLIC_KEY), { name: 'Ed25519' }, false, ['verify']); } catch {
    key = await crypto.subtle.importKey('raw', b64bytes(env.TELNYX_PUBLIC_KEY), { name: 'NODE-ED25519', namedCurve: 'NODE-ED25519' }, false, ['verify']);
  }
  return crypto.subtle.verify(key.algorithm.name === 'Ed25519' ? 'Ed25519' : { name: 'NODE-ED25519' }, key, b64bytes(sig), enc.encode(`${ts}|${body}`));
}

/** Stripe: HMAC-SHA256 אויף "t.body" */
export async function verifyStripe(env, req, body) {
  const head = req.headers.get('stripe-signature') || '';
  const parts = Object.fromEntries(head.split(',').map((x) => x.split('=')).filter((x) => x.length === 2));
  const v1s = head.split(',').filter((x) => x.startsWith('v1=')).map((x) => x.slice(3));
  if (!parts.t || !v1s.length || !env.STRIPE_WEBHOOK_SECRET) return false;
  if (Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return false;
  const key = await crypto.subtle.importKey('raw', enc.encode(env.STRIPE_WEBHOOK_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = hex(await crypto.subtle.sign('HMAC', key, enc.encode(`${parts.t}.${body}`)));
  return v1s.includes(mac);
}

async function formOf(req) {
  const ct = req.headers.get('content-type') || '';
  if (ct.includes('application/json')) return req.json();
  if (req.method === 'GET') return Object.fromEntries(new URL(req.url).searchParams);
  return Object.fromEntries(await req.formData());
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const base = `${url.origin}`;

    // ---- SMS פון Telnyx ----
    if (path === '/telnyx/sms' && req.method === 'POST') {
      const body = await req.text();
      if (!(await verifyTelnyx(env, req, body))) return json({ error: 'bad-signature' }, 401);
      const ev = JSON.parse(body).data || {};
      const p = ev.payload || {};
      if (ev.event_type === 'message.received') {
        ctx.waitUntil(brain(env, {
          action: 'sms_in', id: p.id, from: p.from?.phone_number, to: (p.to || [])[0]?.phone_number, text: p.text || '',
          media: (p.media || []).map((m) => ({ url: m.url, content_type: m.content_type })),
        }));
      } else if (/^message\.(sent|finalized|delivered)/.test(ev.event_type || '')) {
        ctx.waitUntil(brain(env, { action: 'sms_status', id: p.id, status: (p.to || [])[0]?.status || ev.event_type, cost: p.cost?.amount }));
      }
      return json({ ok: true }); // גלייך — Telnyx ווארט נישט
    }

    // ---- טעלעפאנען (TeXML) ----
    if (path === '/voice' || path === '/voice/menu' || path === '/voice/recorded') {
      // Telnyx חתמ'ט אויך די TeXML בקשות — נאר א באשטעטיגטע בקשה מעג טוישן א הקלטה
      const raw = await req.clone().text();
      const signed = await verifyTelnyx(env, req, raw).catch(() => false);
      const f = await formOf(req);
      const action = path === '/voice' ? 'call_in' : path === '/voice/menu' ? 'call_menu' : 'call_recorded';
      const r = await brain(env, { action, signed, from: f.From, to: f.To, digits: f.Digits, url: f.RecordingUrl, duration: f.RecordingDuration });
      return xml(r.xml || texml('<Hangup/>'));
    }
    if (path === '/voice/play') {
      const rec = url.searchParams.get('rec') || '';
      return xml(texml(`<Play>${base}/audio/${encodeURIComponent(rec)}</Play>`));
    }

    // ---- די הקלטה אליין (פון דרייב) ----
    if (path.startsWith('/audio/')) {
      const id = decodeURIComponent(path.slice(7));
      const cache = caches.default;
      const key = new Request(`${base}/audio/${encodeURIComponent(id)}`);
      const hit = await cache.match(key);
      if (hit) return hit;
      const r = await brain(env, { action: 'audio', id });
      if (!r.b64) return new Response('not found', { status: 404 });
      const res = new Response(b64bytes(r.b64), { headers: { 'Content-Type': r.mime || 'audio/mpeg', 'Cache-Control': 'public, max-age=86400' } });
      ctx.waitUntil(cache.put(key, res.clone()));
      return res;
    }

    // ---- Stripe ----
    if (path === '/stripe' && req.method === 'POST') {
      const body = await req.text();
      if (!(await verifyStripe(env, req, body))) return json({ error: 'bad-signature' }, 400);
      const ev = JSON.parse(body);
      if (ev.type === 'checkout.session.completed' && ev.data?.object?.payment_status === 'paid') {
        const s = ev.data.object;
        const r = await brain(env, { action: 'stripe_paid', session_id: s.id, email: s.metadata?.email || s.customer_email || s.customer_details?.email, amount_total: s.amount_total, credits: s.metadata?.credits });
        if (r.error) return json(r, 500); // Stripe פרובירט נאכאמאל
      }
      return json({ ok: true });
    }

    return new Response('Mosdos Ungvar · ok', { headers: { 'Content-Type': 'text/plain' } });
  },
};
