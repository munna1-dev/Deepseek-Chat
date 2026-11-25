import type { Env } from '../index.js'
import { corsHeaders, json, sseFrame } from '../lib/http.js'

const FILE_API = 'https://generativelanguage.googleapis.com'

type GeminiPart = {
  text?: string
  thought?: boolean
  fileData?: { mimeType: string; fileUri: string }
}

type GeminiChunk = {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] }
    finishReason?: string
  }>
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
  }
}

const safeFileName = (value: string): string =>
  value.replace(/[\\/\r\n"]/g, '_').slice(0, 180) || 'attachment'

const validGeminiFileId = (value: string): boolean =>
  /^files\/[A-Za-z0-9_-]+$/.test(value)

const getActiveGeminiFile = async (
  fileId: string,
  env: Env
): Promise<{ uri: string; mimeType: string; state: string }> => {
  if (!validGeminiFileId(fileId)) {
    throw new Error(`invalid file_id: ${fileId}`)
  }
  const response = await fetch(`${FILE_API}/v1beta/${fileId}`, {
    headers: { 'x-goog-api-key': env.GEMINI_API_KEY! },
  })
  if (!response.ok) {
    throw new Error(
      `invalid file_id: ${fileId}. Gemini file lookup returned HTTP ${response.status}. Please re-upload this attachment.`
    )
  }
  const file = (await response.json()) as {
    uri?: string
    mimeType?: string
    state?: string
  }
  if (file.state !== 'ACTIVE' || !file.uri || !file.mimeType) {
    throw new Error(
      file.state === 'PROCESSING'
        ? `Gemini attachment ${fileId} is still processing. Please retry shortly.`
        : `invalid file_id: ${fileId}. Gemini attachment is not active. Please re-upload it.`
    )
  }
  return { uri: file.uri, mimeType: file.mimeType, state: file.state }
}

export const convertMessages = async (messages: unknown[], env: Env) => {
  const contents: Array<{
    role: 'user' | 'model'
    parts: Array<{ text?: string; fileData?: { mimeType: string; fileUri: string } }>
  }> = []

  for (const raw of messages) {
    if (!raw || typeof raw !== 'object') continue
    const message = raw as Record<string, unknown>

    if (message.role === 'latest_reminder') {
      const reminder = typeof message.content === 'string' ? message.content : ''
      if (reminder) contents.push({ role: 'user', parts: [{ text: `Context update:\n${reminder}` }] })
      continue
    }

    if (message.role !== 'user' && message.role !== 'assistant') continue

    const parts: Array<{ text?: string; fileData?: { mimeType: string; fileUri: string } }> = []
    const rawContent = message.content

    if (typeof rawContent === 'string') {
      if (rawContent.trim()) parts.push({ text: rawContent })
    } else if (Array.isArray(rawContent)) {
      for (const block of rawContent) {
        if (!block || typeof block !== 'object') continue
        const item = block as Record<string, unknown>

        if (item.type === 'text' && typeof item.text === 'string') {
          if (item.text) parts.push({ text: item.text })
          continue
        }
        if (item.type === 'image' || item.type === 'document') {
          const source =
            item.source && typeof item.source === 'object'
              ? (item.source as Record<string, unknown>)
              : {}
          const fileId = typeof source.file_id === 'string' ? source.file_id : ''
          if (source.type !== 'file' || !fileId) {
            throw new Error('This attachment format is not supported. Please remove it and upload it again.')
          }
          const file = await getActiveGeminiFile(fileId, env)
          parts.push({ fileData: { mimeType: file.mimeType, fileUri: file.uri } })
        }
      }
    }

    if (parts.length) {
      contents.push({ role: message.role === 'assistant' ? 'model' : 'user', parts })
    }
  }

  return contents
}

export const uploadGeminiFile = async (file: File, env: Env): Promise<Response> => {
  if (!env.GEMINI_API_KEY) return json('Gemini server credential is not configured.', 503, env.ALLOWED_ORIGIN)
  if (!file.size || file.size > 64 * 1024 * 1024) {
    return json('Attachment must be between 1 byte and 64 MiB.', 413, env.ALLOWED_ORIGIN)
  }

  const name = safeFileName(file.name)
  const ext = name.split('.').pop()?.toLowerCase() || ''
  const office = new Set(['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'])
  if (office.has(ext)) {
    return json(
      'Gemini Files does not accept this Office document format directly. Export it as PDF or plain text and upload again.',
      415,
      env.ALLOWED_ORIGIN
    )
  }

  const textExt = new Set([
    'txt', 'md', 'csv', 'json', 'xml', 'html', 'css', 'js', 'jsx', 'ts', 'tsx',
    'py', 'java', 'c', 'h', 'cpp', 'go', 'rs', 'php', 'rb', 'sh', 'sql',
    'yaml', 'yml', 'toml', 'log',
  ])
  const rawMimeType = (file.type || '').toLowerCase()
  const mimeType =
    textExt.has(ext) && (!rawMimeType || rawMimeType === 'application/octet-stream')
      ? 'text/plain'
      : rawMimeType
  const supported =
    mimeType.startsWith('image/') ||
    mimeType.startsWith('audio/') ||
    mimeType.startsWith('video/') ||
    mimeType === 'application/pdf' ||
    mimeType.startsWith('text/')
  if (!supported) {
    return json(
      'Unsupported attachment type for Gemini. Upload an image, PDF, audio, video, or plain-text/code file.',
      415,
      env.ALLOWED_ORIGIN
    )
  }

  const start = await fetch(`${FILE_API}/upload/v1beta/files`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': env.GEMINI_API_KEY,
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(file.size),
      'X-Goog-Upload-Header-Content-Type': mimeType,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: name } }),
  })
  if (!start.ok) {
    const detail = await start.text()
    return json(
      `Gemini upload initialization failed (HTTP ${start.status}): ${detail.slice(0, 700)}`,
      start.status,
      env.ALLOWED_ORIGIN
    )
  }
  const uploadUrl = start.headers.get('x-goog-upload-url')
  if (!uploadUrl) return json('Gemini did not return a resumable upload URL.', 502, env.ALLOWED_ORIGIN)

  const uploaded = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'x-goog-api-key': env.GEMINI_API_KEY,
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
      'Content-Type': mimeType,
    },
    body: await file.arrayBuffer(),
  })
  if (!uploaded.ok) {
    const detail = await uploaded.text()
    return json(
      `Gemini file upload failed (HTTP ${uploaded.status}): ${detail.slice(0, 700)}`,
      uploaded.status,
      env.ALLOWED_ORIGIN
    )
  }
  const result = (await uploaded.json()) as {
    file?: { name?: string; mimeType?: string; sizeBytes?: string | number; createTime?: string; displayName?: string }
  }
  const saved = result.file
  if (!saved?.name || !validGeminiFileId(saved.name)) {
    return json('Gemini upload completed but returned an invalid file reference.', 502, env.ALLOWED_ORIGIN)
  }
  return new Response(
    JSON.stringify({
      id: saved.name,
      type: 'file',
      size_bytes: Number(saved.sizeBytes ?? file.size),
      created_at: saved.createTime ?? new Date().toISOString(),
      filename: saved.displayName ?? name,
      mime_type: saved.mimeType ?? mimeType,
    }),
    {
      status: 200,
      headers: { ...corsHeaders(env.ALLOWED_ORIGIN), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    }
  )
}

export const deleteGeminiFile = async (fileId: string, env: Env): Promise<Response> => {
  if (!validGeminiFileId(fileId)) return json('Invalid Gemini file ID.', 400, env.ALLOWED_ORIGIN)
  const response = await fetch(`${FILE_API}/v1beta/${fileId}`, {
    method: 'DELETE',
    headers: { 'x-goog-api-key': env.GEMINI_API_KEY! },
  })
  if (!response.ok && response.status !== 404) {
    return json(`Gemini file deletion failed (HTTP ${response.status}).`, response.status, env.ALLOWED_ORIGIN)
  }
  return new Response(null, { status: 204, headers: corsHeaders(env.ALLOWED_ORIGIN) })
}

const readGeminiEvents = async function* (body: ReadableStream<Uint8Array>) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const data = trimmed.slice(5).trim()
        if (!data || data === '[DONE]') continue
        try {
          yield JSON.parse(data) as GeminiChunk
        } catch {
          /* ignore malformed frame */
        }
      }
    }
    buffer += decoder.decode()
    const finalLine = buffer.trim()
    if (finalLine.startsWith('data:')) {
      const data = finalLine.slice(5).trim()
      if (data && data !== '[DONE]') {
        try {
          yield JSON.parse(data) as GeminiChunk
        } catch {
          /* ignore */
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

export const streamGeminiAsAnthropic = (
  upstream: ReadableStream<Uint8Array>,
  model: string,
  origin: string
): Response => {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let index = -1
      let currentType: 'text' | 'thinking' | null = null
      let inputTokens = 0
      let outputTokens = 0
      let finishReason = 'STOP'

      const emit = (type: string, payload: unknown) => {
        controller.enqueue(encoder.encode(sseFrame(type, payload)))
      }
      const closeBlock = () => {
        if (index >= 0) emit('content_block_stop', { type: 'content_block_stop', index })
        currentType = null
      }
      const openBlock = (type: 'text' | 'thinking') => {
        closeBlock()
        index++
        currentType = type
        emit('content_block_start', {
          type: 'content_block_start',
          index,
          content_block:
            type === 'text'
              ? { type: 'text', text: '' }
              : { type: 'thinking', thinking: '', signature: '' },
        })
      }

      try {
        emit('message_start', {
          type: 'message_start',
          message: {
            id: crypto.randomUUID().replace(/-/g, ''),
            model,
            usage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
          },
        })

        for await (const chunk of readGeminiEvents(upstream)) {
          const candidate = chunk.candidates?.[0]
          if (candidate?.finishReason) finishReason = candidate.finishReason
          if (chunk.usageMetadata) {
            inputTokens = chunk.usageMetadata.promptTokenCount ?? inputTokens
            outputTokens = chunk.usageMetadata.candidatesTokenCount ?? outputTokens
          }
          for (const part of candidate?.content?.parts ?? []) {
            if (typeof part.text !== 'string' || !part.text) continue
            const type = part.thought ? 'thinking' : 'text'
            if (currentType !== type) openBlock(type)
            emit('content_block_delta', {
              type: 'content_block_delta',
              index,
              delta:
                type === 'thinking'
                  ? { type: 'thinking_delta', thinking: part.text }
                  : { type: 'text_delta', text: part.text },
            })
          }
        }

        closeBlock()
        emit('message_delta', {
          type: 'message_delta',
          delta: {
            stop_reason: finishReason === 'MAX_TOKENS' ? 'max_tokens' : 'end_turn',
            stop_sequence: null,
          },
          usage: { input_tokens: inputTokens, output_tokens: outputTokens, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
        })
        emit('message_stop', { type: 'message_stop' })
        controller.close()
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Gemini stream failed'
        try {
          emit('error', { error: { message } })
          controller.close()
        } catch {
          /* client gone */
        }
      }
    },
    cancel() {
      /* request signal cancels upstream */
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      ...corsHeaders(origin),
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

export const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

/** Base64 of a Uint8Array, ES5-safe (no spread of typed arrays). */
export const base64FromBytes = (bytes: Uint8Array): string => {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const slice = bytes.subarray(offset, offset + chunkSize)
    for (let i = 0; i < slice.length; i++) binary += String.fromCharCode(slice[i])
  }
  return btoa(binary)
}

