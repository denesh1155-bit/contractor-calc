// Cloudflare Worker: checks a Google Play subscription purchase and acknowledges it.
// Secrets (wrangler secret put): GOOGLE_SA_JSON — the service-account key JSON with access to the Play Developer API.
// Vars: PACKAGE_NAME — the Android package name, e.g. ge.zghaprebi.app; ALLOWED_ORIGIN — the app's web origin.
// POST /verify {sku, purchaseToken} -> {active, expiry}
const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const enc = s => new TextEncoder().encode(s);

async function accessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(enc(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claim = b64url(enc(JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
  const key = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), c => c.charCodeAt(0)), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = b64url(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc(`${head}.${claim}`)));
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${head}.${claim}.${sig}` });
  return (await r.json()).access_token;
}

export default {
  async fetch(req, env) {
    const cors = { 'access-control-allow-origin': env.ALLOWED_ORIGIN || '*', 'access-control-allow-headers': 'content-type', 'content-type': 'application/json' };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (req.method !== 'POST' || new URL(req.url).pathname !== '/verify') return new Response('{}', { status: 404, headers: cors });
    const { sku, purchaseToken } = await req.json().catch(() => ({}));
    if (!sku || !purchaseToken) return new Response(JSON.stringify({ active: false }), { status: 400, headers: cors });
    const token = await accessToken(JSON.parse(env.GOOGLE_SA_JSON));
    const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${env.PACKAGE_NAME}/purchases`;
    const sub = await (await fetch(`${base}/subscriptionsv2/tokens/${purchaseToken}`, { headers: { authorization: `Bearer ${token}` } })).json();
    const line = (sub.lineItems || []).find(l => l.productId === sku) || (sub.lineItems || [])[0];
    const active = ['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD'].includes(sub.subscriptionState);
    if (active && sub.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING')
      await fetch(`${base}/subscriptions/${sku}/tokens/${purchaseToken}:acknowledge`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: '{}' });
    return new Response(JSON.stringify({ active, expiry: line?.expiryTime || null }), { headers: cors });
  },
};
