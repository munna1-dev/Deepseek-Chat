import type { Env } from '../index.js'
import { corsHeaders, json, sseFrame } from '../lib/http.js'

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

const toGrokMessages = (
  body: Record<string, unknown>
): ChatMessage[] => {
  const result: ChatMessage[] = []

  if (typeof body.system === 'string' && body.system.trim()) {
    result.push({ role: 'system', content: body.system })
  }

  const messages = body.messages
  if (!Array.isArray(messages)) {
    throw new Error('A messages array is required.')
  }

  for (const raw of messages) {
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
      throw new Error('Grok does not support this conversation message type.')
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
        // Historical private reasoning is not replayed as ordinary chat text.
        continue
      } else {
        throw new Error(
          'Grok currently supports text-only conversations. Remove attachments or tool results to use this model.'
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

const errorMessage = (details: string, status: number): string => {
  try {
    const parsed = JSON.parse(details) as {
      error?: { message?: string } | string
    }
    if (typeof parsed.error === 'string') return parsed.error
    if (parsed.error?.message) return parsed.error.message
  } catch {
    // Use the status-based fallback below.
  }
  return `xAI API returned HTTP ${status}.`
}

export const forwardToGrok = async (
  request: Request,
  body: Record<string, unknown>,
  env: Env
): Promise<Response> => {
  if (!env.XAI_API_KEY) {
    return json('Grok server credential is not configured.', 503, env.ALLOWED_ORIGIN)
  }

  let messages: ChatMessage[]
  try {
    messages = toGrokMessages(body)
  } catch (error) {
    return json(
      error instanceof Error ? error.message : 'Unable to convert the conversation for Grok.',
      400,
      env.ALLOWED_ORIGIN
    )
  }

  if (Array.isArray(body.tools) && body.tools.length > 0) {
    return json(
      'Grok tool execution is not enabled in this integration yet. Disable tools or choose Gemini/DeepSeek.',
      400,
      env.ALLOWED_ORIGIN
    )
  }

  try {
    const upstream = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.XAI_API_KEY}`,
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        model: 'grok-4.7',
        messages,
        stream: true,
        stream_options: { include_usage: true },
        max_completion_tokens: 8192,
      }),
      signal: request.signal,
      redirect: 'manual',
    })

    if (!upstream.ok) {
      const details = await upstream.text()
      return json(errorMessage(details, upstream.status), upstream.status, env.ALLOWED_ORIGIN)
    }

    if (!upstream.body) {
      return json('xAI returned an empty streaming response.', 502, env.ALLOWED_ORIGIN)
    }

    const responseHeaders = new Headers(corsHeaders(env.ALLOWED_ORIGIN))
    responseHeaders.set('Content-Type', 'text/event-stream; charset=utf-8')
    responseHeaders.set('Cache-Control', 'no-cache, no-store, no-transform')
    responseHeaders.set('X-Content-Type-Options', 'nosniff')

    const reader = upstream.body.getReader()
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const messageId = crypto.randomUUID()
        let textIndex: number | null = null
        let thinkingIndex: number | null = null
        let nextIndex = 0
        let inputTokens = 0
        let outputTokens = 0
        let stopReason = 'end_turn'
        let finished = false

        const emit = (event: string, payload: unknown) => {
          controller.enqueue(encoder.encode(sseFrame(event, payload)))
        }

        const openText = () => {
          if (textIndex !== null) return
          textIndex = nextIndex++
          emit('content_block_start', {
            type: 'content_block_start',
            index: textIndex,
            content_block: { type: 'text', text: '' },
          })
        }

        const openThinking = () => {
          if (thinkingIndex !== null) return
          thinkingIndex = nextIndex++
          emit('content_block_start', {
            type: 'content_block_start',
            index: thinkingIndex,
            content_block: { type: 'thinking', thinking: '', signature: '' },
          })
        }

        const finish = () => {
          if (finished) return
          finished = true
          if (thinkingIndex !== null) {
            emit('content_block_stop', {
              type: 'content_block_stop',
              index: thinkingIndex,
            })
          }
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

        emit('message_start', {
          type: 'message_start',
          message: {
            id: messageId,
            type: 'message',
            role: 'assistant',
            model: 'grok-4.7',
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

        const processFrame = (frame: string) => {
          const data = frame
            .split('\n')
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trim())
            .join('\n')

          if (!data || data === '[DONE]') return data === '[DONE]'

          let chunk: Record<string, unknown>
          try {
            chunk = JSON.parse(data) as Record<string, unknown>
          } catch {
            return false
          }

          if (chunk.error) {
            const err = chunk.error as { message?: string }
            throw new Error(err.message || 'xAI returned a streaming error.')
          }

          const usage = chunk.usage as {
            prompt_tokens?: number
            completion_tokens?: number
          } | undefined
          if (usage) {
            inputTokens = usage.prompt_tokens ?? inputTokens
            outputTokens = usage.completion_tokens ?? outputTokens
          }

          const choices = Array.isArray(chunk.choices) ? chunk.choices : []
          for (const rawChoice of choices) {
            if (!rawChoice || typeof rawChoice !== 'object') continue
            const choice = rawChoice as Record<string, unknown>
            const delta = (choice.delta && typeof choice.delta === 'object'
              ? choice.delta
              : {}) as Record<string, unknown>

            if (typeof delta.reasoning_content === 'string' && delta.reasoning_content) {
              openThinking()
              emit('content_block_delta', {
                type: 'content_block_delta',
                index: thinkingIndex,
                delta: { type: 'thinking_delta', thinking: delta.reasoning_content },
              })
            }

            if (typeof delta.content === 'string' && delta.content) {
              openText()
              emit('content_block_delta', {
                type: 'content_block_delta',
                index: textIndex,
                delta: { type: 'text_delta', text: delta.content },
              })
            }

            if (choice.finish_reason === 'length') stopReason = 'max_tokens'
          }

          return false
        }

        try {
          let buffer = ''
          while (true) {
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
          finish()
        } catch (error) {
          try {
            emit('error', {
              type: 'error',
              error: {
                type: 'api_error',
                message: error instanceof Error ? error.message : 'Grok streaming failed.',
              },
            })
            if (!finished) controller.close()
          } catch {
            // The client may already have cancelled the stream.
          }
        } finally {
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
  } catch {
    if (request.signal.aborted) {
      return json('Request was cancelled.', 499, env.ALLOWED_ORIGIN)
    }
    return json('Unable to reach the xAI API.', 502, env.ALLOWED_ORIGIN)
  }
}
