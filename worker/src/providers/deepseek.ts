import type { Env } from '../index.js'
import { corsHeaders, json } from '../lib/http.js'

export const forwardToDeepSeek = async (
  request: Request,
  body: Record<string, unknown>,
  env: Env
): Promise<Response> => {
  if (!env.DEEPSEEK_API_KEY) {
    return json('DeepSeek server credential is not configured.', 503, env.ALLOWED_ORIGIN)
  }

  const headers = new Headers(request.headers)
  headers.delete('Authorization')
  headers.delete('x-api-key')
  headers.delete('Host')
  headers.delete('Cookie')
  headers.delete('x-allow-paid') // don't forward the internal opt-in marker upstream
  headers.delete('anthropic-beta') // strip browser beta flags; deepseek handles parsing natively
  headers.set('Authorization', `Bearer ${env.DEEPSEEK_API_KEY}`)
  headers.set('x-api-key', env.DEEPSEEK_API_KEY)
  headers.set('Content-Type', 'application/json')

  try {
    const upstream = await fetch('https://api.deepseek.com/anthropic/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: request.signal,
      redirect: 'manual',
    })

    const responseHeaders = new Headers(upstream.headers)
    for (const [key, value] of Object.entries(corsHeaders(env.ALLOWED_ORIGIN))) {
      responseHeaders.set(key, value)
    }
    responseHeaders.set('Cache-Control', 'no-store')

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    })
  } catch (error) {
    if (request.signal.aborted) return json('Request was cancelled.', 499, env.ALLOWED_ORIGIN)
    return json('Unable to reach the DeepSeek API.', 502, env.ALLOWED_ORIGIN)
  }
}
