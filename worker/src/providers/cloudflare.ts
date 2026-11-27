import type { Env } from '../index.js'
import { corsHeaders, json, sseFrame } from '../lib/http.js'

type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

const MODEL = '@cf/openai/gpt-oss-20b'

const toMessages = (body: Record<string, unknown>): ChatMessage[] => {
  const result: ChatMessage[] = []

  if (typeof body.system === 'string' && body.system.trim()) {
    result.push({ role: 'system', content: body.system })
  }

  if (!Array.isArray(body.messages)) {
    throw new Error('A messages array is required.')
  }

  for (const raw of body.messages) {
    if (!raw || typeof raw !== 'object') {
      throw new Error('The conversation contains an invalid message.')
    }

    const message = raw as Record<string, unknown>
    const role = message.role

    if (role === 'latest_reminder') {
      if (typeof message.content === 'string' && message.content.trim()) {
        result.push({ role: 'system', content: message.content })
      }
      continue
    }

    if (role !== 'user' && role !== 'assistant') {
      throw new Error('This message type is not supported by Cloudflare AI.')
    }

    if (typeof message.content === 'string') {
      result.push({ role, content: message.content })
      continue
    }

    if (!Array.isArray(message.content)) {
      throw new Error('A conversation message has an unsupported content format.')
    }

    let text = ''
    for (const rawBlock of message.content) {
      if (!rawBlock || typeof rawBlock !== 'object') {
        throw new Error('A conversation message contains an invalid content block.')
      }

      const block = rawBlock as Record<string, unknown>

      if (block.type === 'text' && typeof block.text === 'string') {
        text += block.text
      } else if (role === 'assistant' && block.type === 'thinking') {
        // Do not replay historical private reasoning as ordinary text.
        continue
      } else {
        throw new Error(
          'Cloudflare AI currently supports text-only conversations. Remove attachments or tool results to use this model.'
        )
      }
    }

    if (text) result.push({ role, content: text })
  }

  if (!result.some((message) => message.role === 'user')) {
    throw new Error('No supported user text was provided.')
  }

  return result
}

export const forwardToCloudflare = async (
  request: Request,
  body: Record<string, unknown>,
  env: Env
): Promise<Response> => {
  if (!env.AI) {
    return json('Cloudflare Workers AI binding is not configured.', 503, env.ALLOWED_ORIGIN)
  }

  if (Array.isArray(body.tools) && body.tools.length > 0) {
    return json(
      'Cloudflare AI tool execution is not enabled in this integration. Disable tools or choose Gemini/DeepSeek.',
      400,
      env.ALLOWED_ORIGIN
    )
  }

  let messages: ChatMessage[]
  try {
    messages = toMessages(body)
  } catch (error) {
    return json(
      error instanceof Error ? error.message : 'Unable to convert the conversation for Cloudflare AI.',
      400,
      env.ALLOWED_ORIGIN
    )
  }

  try {
    const upstream = await env.AI.run(MODEL, {
      messages,
      stream: true,
      max_tokens: 8192,
    })

    if (!upstream || typeof upstream.getReader !== 'function') {
      return json('Cloudflare AI returned an invalid streaming response.', 502, env.ALLOWED_ORIGIN)
    }

    const responseHeaders = new Headers(corsHeaders(env.ALLOWED_ORIGIN))
    responseHeaders.set('Content-Type', 'text/event-stream; charset=utf-8')
    responseHeaders.set('Cache-Control', 'no-cache, no-store, no-transform')
    responseHeaders.set('X-Content-Type-Options', 'nosniff')

    const reader = upstream.getReader()
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const messageId = crypto.randomUUID()
        let textIndex: number | null = null
        let inputTokens = 0
        let outputTokens = 0
        let stopReason = 'end_turn'
        let finished = false

        const emit = (event: string, payload: unknown) => {
          controller.enqueue(encoder.encode(sseFrame(event, payload)))
        }

        const openText = () => {
          if (textIndex !== null) return
          textIndex = 0
          emit('content_block_start', {
            type: 'content_block_start',
            index: textIndex,
            content_block: { type: 'text', text: '' },
          })
        }

        const finish = () => {
          if (finished) return
          finished = true

          if (textIndex !== null) {
            emit('content_block_stop', {
              type: 'content_block_stop',
              index: textIndex,
            })
          }

          emit('message_delta', {
            type: 'message_delta',
            delta: { stop_reason: stopReason, stop_sequence: null },
            usage: {
              input_tokens: inputTokens,
              cache_creation_input_tokens: 0,
              cache_read_input_tokens: 0,
              output_tokens: outputTokens,
            },
          })
          emit('message_stop', { type: 'message_stop' })
          controller.close()
        }

        const processFrame = (frame: string): boolean => {
          const data = frame
            .split('\n')
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trim())
            .join('\n')

          if (!data) return false
          if (data === '[DONE]') return true

          let chunk: Record<string, unknown>
          try {
            chunk = JSON.parse(data) as Record<string, unknown>
          } catch {
            return false
          }

          if (chunk.error) {
            const error = chunk.error as { message?: string } | string
            throw new Error(
              typeof error === 'string'
                ? error
                : error.message || 'Cloudflare AI returned a streaming error.'
            )
          }

          const usage = chunk.usage as {
            prompt_tokens?: number
            completion_tokens?: number
            input_tokens?: number
            output_tokens?: number
          } | undefined

          if (usage) {
            inputTokens = usage.prompt_tokens ?? usage.input_tokens ?? inputTokens
            outputTokens = usage.completion_tokens ?? usage.output_tokens ?? outputTokens
          }

          const choices = Array.isArray(chunk.choices) ? chunk.choices : []
          for (const rawChoice of choices) {
            if (!rawChoice || typeof rawChoice !== 'object') continue

            const choice = rawChoice as Record<string, unknown>
            const delta = (
              choice.delta && typeof choice.delta === 'object'
                ? choice.delta
                : {}
            ) as Record<string, unknown>

            if (typeof delta.content === 'string' && delta.content) {
              openText()
              emit('content_block_delta', {
                type: 'content_block_delta',
                index: textIndex,
                delta: { type: 'text_delta', text: delta.content },
              })
            }

            if (choice.finish_reason === 'length') {
              stopReason = 'max_tokens'
            }
          }

          return false
        }

        emit('message_start', {
          type: 'message_start',
          message: {
            id: messageId,
            type: 'message',
            role: 'assistant',
            model: MODEL,
            content: [],
            stop_reason: null,
            stop_sequence: null,
            usage: {
              input_tokens: 0,
              cache_creation_input_tokens: 0,
              cache_read_input_tokens: 0,
              output_tokens: 0,
            },
          },
        })

        const onAbort = () => {
          void reader.cancel()
        }
        request.signal.addEventListener('abort', onAbort, { once: true })

        try {
          let buffer = ''

          while (true) {
            if (request.signal.aborted) break

            const { value, done } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            buffer = buffer.replace(/\r\n/g, '\n')

            let boundary = buffer.indexOf('\n\n')
            while (boundary !== -1) {
              const frame = buffer.slice(0, boundary)
              buffer = buffer.slice(boundary + 2)

              if (processFrame(frame)) {
                await reader.cancel()
                finish()
                return
              }

              boundary = buffer.indexOf('\n\n')
            }
          }

          buffer += decoder.decode()
          if (buffer.trim()) processFrame(buffer)

          if (request.signal.aborted) {
            try {
              controller.close()
            } catch {
              // The client may already have cancelled.
            }
            return
          }

          finish()
        } catch (error) {
          try {
            emit('error', {
              type: 'error',
              error: {
                type: 'api_error',
                message: error instanceof Error
                  ? error.message
                  : 'Cloudflare AI streaming failed.',
              },
            })
            if (!finished) controller.close()
          } catch {
            // The client may already have cancelled the stream.
          }
        } finally {
          request.signal.removeEventListener('abort', onAbort)
          reader.releaseLock()
        }
      },
      cancel() {
        void reader.cancel()
      },
    })

    return new Response(stream, {
      status: 200,
      headers: responseHeaders,
    })
  } catch (error) {
    if (request.signal.aborted) {
      return json('Request was cancelled.', 499, env.ALLOWED_ORIGIN)
    }

    return json(
      error instanceof Error ? error.message : 'Unable to run Cloudflare Workers AI.',
      502,
      env.ALLOWED_ORIGIN
    )
  }
}
