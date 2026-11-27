export const corsHeaders = (origin: string): Record<string, string> => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Accept, Authorization, Content-Type, Anthropic-Beta, X-Requested-With, X-Allow-Paid',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin',
})

export const json = (message: string, status: number, origin: string): Response =>
  new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: {
      ...corsHeaders(origin),
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })

export const sseFrame = (type: string, payload: unknown): string =>
  `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`

export const jsonOk = (body: unknown, origin: string): Response =>
  new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders(origin),
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
