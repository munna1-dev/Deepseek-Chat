interface Env {
  DEEPSEEK_API_KEY: string
  ALLOWED_ORIGIN: string
}

const UPSTREAM = 'https://api.deepseek.com'

const corsHeaders = (origin: string) => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Accept, Content-Type, Anthropic-Beta, X-Requested-With',
  'Access-Control-Max-Age': '86400',
  'Vary': 'Origin',
})

function json(message: string, status: number, origin: string) {
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: {
      ...corsHeaders(origin),
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}

function allowedRoute(path: string, method: string) {
  if (path === '/models') return method === 'GET'
  if (path === '/anthropic/v1/messages') return method === 'POST'
  if (path === '/anthropic/v1/files') return method === 'POST'
  if (/^\/anthropic\/v1\/files\/[^/]+$/.test(path)) return method === 'DELETE'
  if (path === '/v1/tools/asr' || path === '/v1/tools/tts') {
    return method === 'POST'
  }
  return false
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const origin = request.headers.get('Origin') || ''

    if (origin && origin !== env.ALLOWED_ORIGIN) {
      return json('Origin not allowed', 403, env.ALLOWED_ORIGIN)
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(env.ALLOWED_ORIGIN),
      })
    }

    if (!env.DEEPSEEK_API_KEY) {
      return json('Server API credential is not configured', 503, env.ALLOWED_ORIGIN)
    }

    if (!allowedRoute(url.pathname, request.method)) {
      return json('Endpoint or method not allowed', 404, env.ALLOWED_ORIGIN)
    }

    const headers = new Headers(request.headers)

    // Never trust or forward credentials supplied by the browser.
    headers.delete('Authorization')
    headers.delete('x-api-key')
    headers.delete('Host')
    headers.delete('Cookie')

    headers.set('Authorization', `Bearer ${env.DEEPSEEK_API_KEY}`)
    headers.set('x-api-key', env.DEEPSEEK_API_KEY)

    const upstreamUrl = `${UPSTREAM}${url.pathname}${url.search}`

    try {
      const upstream = await fetch(upstreamUrl, {
        method: request.method,
        headers,
        body: request.method === 'GET' || request.method === 'DELETE'
          ? undefined
          : request.body,
        redirect: 'manual',
      })

      const responseHeaders = new Headers(upstream.headers)
      for (const [key, value] of Object.entries(corsHeaders(env.ALLOWED_ORIGIN))) {
        responseHeaders.set(key, value)
      }
      responseHeaders.set('Cache-Control', 'no-store')

      // Preserve the upstream stream for SSE and audio responses.
      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: responseHeaders,
      })
    } catch {
      return json('Unable to reach the DeepSeek API', 502, env.ALLOWED_ORIGIN)
    }
  },
}
