/**
 * Hands the game short-lived logins for Cloudflare's TURN relay. The relay key stays here as a Worker secret,
 * so it never ships in the game's JavaScript. Deploy with `npm run deploy:turn`.
 */

interface Env {
  CLOUDFLARE_TURN_KEY_ID: string;
  CLOUDFLARE_TURN_API_TOKEN: string;
}

/** Only the game's own pages may ask; anything else gets turned away. */
const ALLOWED_ORIGINS = [
  'https://richardyoung.co.za',
  'https://richardyoung00.github.io',
  'http://localhost:5199',
];

/** Longer than any game session, so a relayed connection never loses its login mid-game. */
const LOGIN_SECONDS = 24 * 60 * 60;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin') ?? '';
    if (!ALLOWED_ORIGINS.includes(origin)) return new Response('Forbidden', { status: 403 });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: corsHeaders(origin) });

    const response = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${env.CLOUDFLARE_TURN_KEY_ID}/credentials/generate-ice-servers`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.CLOUDFLARE_TURN_API_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ttl: LOGIN_SECONDS }),
      },
    );
    if (!response.ok) return new Response('Relay unavailable', { status: 502, headers: corsHeaders(origin) });

    return new Response(await response.text(), {
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  },
};

function corsHeaders(origin: string): Record<string, string> {
  return { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' };
}
