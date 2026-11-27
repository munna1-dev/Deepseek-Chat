import type { Env } from '../index.js'
import { corsHeaders, json } from '../lib/http.js'

/** Forward an explicitly consented paid request to DeepSeek. */
export const forwardToDeepSeek = async (
  request: Request,
  body: Record<string, unknown>,
  env: Env
): Promise<Response> => {
  if (!env.DEEPSEEK_API_KEY) {
    return json('DeepSeek server credential is not configured.', 503, env.ALLOWED_ORIGIN)
  }

  const headers = new Headers({
    'Content-Type': 'application/json',
    Accept: request.headers.get('Accept') || 'text/event-stream',
    Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
  })

  try {
    const upstream = await fetch('https://api.deepseek.com/anthropic/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: request.signal,
      redirect: 'manual',
    })

    const responseHeaders = new Headers()
    for (const [key, value] of Object.entries(corsHeaders(env.ALLOWED_ORIGIN))) {
      responseHeaders.set(key, value)
    }

    const contentType = upstream.headers.get('Content-Type')
    if (contentType) responseHeaders.set('Content-Type', contentType)

    responseHeaders.set('Cache-Control', 'no-store')
    responseHeaders.set('X-Content-Type-Options', 'nosniff')

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    })
  } catch {
    if (request.signal.aborted) {
      return json('Request was cancelled.', 499, env.ALLOWED_ORIGIN)
    }
    return json('Unable to reach the DeepSeek API.', 502, env.ALLOWED_ORIGIN)
  }
}
