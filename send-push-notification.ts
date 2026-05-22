// Supabase Edge Function: send-push-notification
// Deploy this in your Supabase dashboard under Edge Functions
// Name it: send-push-notification

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = 'mailto:hello@golfsoc.ie';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Minimal VAPID signing using Web Crypto
async function signVapid(audience: string, subject: string, publicKey: string, privateKey: string) {
  const header = btoa(JSON.stringify({ typ: 'JWT', alg: 'ES256' })).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  const now = Math.floor(Date.now() / 1000);
  const payload = btoa(JSON.stringify({ aud: audience, exp: now + 12 * 3600, sub: subject })).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  const unsigned = `${header}.${payload}`;

  // Import the private key
  const keyData = Uint8Array.from(atob(privateKey.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, cryptoKey, new TextEncoder().encode(unsigned));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');

  return `${unsigned}.${sigB64}`;
}

async function sendPush(subscription: any, payload: object) {
  const subUrl = new URL(subscription.endpoint);
  const audience = `${subUrl.protocol}//${subUrl.host}`;
  const jwt = await signVapid(audience, VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const body = JSON.stringify(payload);
  const res = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `vapid t=${jwt},k=${VAPID_PUBLIC_KEY}`,
      'Content-Type': 'application/json',
      'TTL': '86400',
    },
    body,
  });

  if (!res.ok && res.status !== 201) {
    const text = await res.text();
    throw new Error(`Push failed ${res.status}: ${text}`);
  }
}

Deno.serve(async (req) => {
  // Allow CORS from your app
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { player_ids, title, body, tag, url } = await req.json();

    if (!player_ids || !player_ids.length) {
      return new Response(JSON.stringify({ error: 'player_ids required' }), { status: 400, headers: corsHeaders });
    }

    // Fetch subscriptions for these players
    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('player_id, subscription')
      .in('player_id', player_ids);

    if (error) throw error;
    if (!subs || !subs.length) {
      return new Response(JSON.stringify({ sent: 0, message: 'No subscriptions found' }), { headers: corsHeaders });
    }

    const payload = { title, body, tag: tag || 'bhgs', url: url || '/brayhead-golf/' };
    const results = await Promise.allSettled(subs.map(s => sendPush(s.subscription, payload)));

    // Remove expired subscriptions (410 Gone)
    const expired = subs.filter((_, i) => {
      const r = results[i];
      return r.status === 'rejected' && r.reason?.message?.includes('410');
    });
    if (expired.length) {
      await supabase.from('push_subscriptions').delete().in('player_id', expired.map(s => s.player_id));
    }

    const sent = results.filter(r => r.status === 'fulfilled').length;
    return new Response(JSON.stringify({ sent, total: subs.length }), { headers: corsHeaders });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
