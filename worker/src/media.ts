import { json, jsonOk } from './lib/http.js'

interface MediaEnv {
  SUPABASE_URL?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  FAL_KEY?: string
  ALLOWED_ORIGIN: string
}

interface MediaRequestData {
  fal_status_url?: string
  fal_response_url?: string
  storage_path?: string
}

interface MediaRow {
  id: string
  user_id: string
  kind: 'image' | 'audio' | 'video'
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'
  prompt: string | null
  model: string | null
  request: MediaRequestData
  progress: number
  status_message: string | null
  output_urls: string[]
  error: string | null
  created_at: string
  updated_at: string
}

const MODEL_ID = 'fal-ai/flux/schnell'
const BUCKET = 'media-generated'
const MAX_IMAGE_BYTES = 20 * 1024 * 1024

const columns =
  'id,user_id,kind,status,prompt,model,request,progress,status_message,output_urls,error,created_at,updated_at'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const databaseRequest = async (
  env: MediaEnv,
  path: string,
  init: RequestInit = {}
): Promise<Response> => {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Media database credentials are not configured.')
  }

  return fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })
}

const updateJob = async (
  env: MediaEnv,
  id: string,
  userId: string,
  patch: Record<string, unknown>
): Promise<void> => {
  const params = new URLSearchParams({
    id: `eq.${id}`,
    user_id: `eq.${userId}`,
  })

  const response = await databaseRequest(env, `media_jobs?${params}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      ...patch,
      updated_at: new Date().toISOString(),
    }),
  })

  if (!response.ok) throw new Error('Unable to update media job.')
}

const safeFalUrl = (value: unknown): string | null => {
  if (typeof value !== 'string') return null

  try {
    const url = new URL(value)
    if (
      url.protocol !== 'https:' ||
      !(url.hostname === 'fal.run' || url.hostname.endsWith('.fal.run'))
    ) return null

    return url.toString()
  } catch {
    return null
  }
}

const falRequest = async (
  env: MediaEnv,
  url: string,
  init: RequestInit = {}
): Promise<Response> => {
  if (!env.FAL_KEY) throw new Error('fal.ai provider key is not configured.')

  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Key ${env.FAL_KEY}`,
      ...init.headers,
    },
  })
}

const signedImageUrl = async (
  env: MediaEnv,
  path: string
): Promise<string | undefined> => {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return undefined

  const encodedPath = path.split('/').map(encodeURIComponent).join('/')
  const response = await fetch(
    `${env.SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/sign/${BUCKET}/${encodedPath}`,
    {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiresIn: 3600 }),
    }
  )

  if (!response.ok) throw new Error('Unable to create private image URL.')

  const data = await response.json() as {
    signedURL?: string
    signedUrl?: string
  }

  const signed = data.signedURL || data.signedUrl
  if (!signed) throw new Error('Storage did not return a signed image URL.')

  if (/^https:\/\//i.test(signed)) return signed

  return `${env.SUPABASE_URL.replace(/\/$/, '')}/storage/v1${signed.startsWith('/') ? '' : '/'}${signed}`
}

const toJob = async (env: MediaEnv, row: MediaRow) => {
  const path = row.request?.storage_path
  const outputUrl = row.status === 'succeeded' && path
    ? await signedImageUrl(env, path)
    : undefined

  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    prompt: row.prompt ?? undefined,
    progress: row.progress,
    status_message: row.status_message ?? undefined,
    output_url: outputUrl,
    output_urls: outputUrl ? [outputUrl] : [],
    error: row.error ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

const refreshFalJob = async (
  env: MediaEnv,
  row: MediaRow
): Promise<void> => {
  if (
    !env.FAL_KEY ||
    !row.request?.fal_status_url ||
    !row.request?.fal_response_url ||
    !['queued', 'running'].includes(row.status)
  ) return

  const statusUrl = safeFalUrl(row.request.fal_status_url)
  const responseUrl = safeFalUrl(row.request.fal_response_url)
  if (!statusUrl || !responseUrl) {
    await updateJob(env, row.id, row.user_id, {
      status: 'failed',
      error: 'The image provider returned an invalid job URL.',
      status_message: 'Generation failed.',
    })
    return
  }

  const statusResponse = await falRequest(env, statusUrl)
  if (!statusResponse.ok) return

  const statusData = await statusResponse.json() as {
    status?: string
  }

  if (statusData.status === 'IN_QUEUE') {
    await updateJob(env, row.id, row.user_id, {
      status: 'queued',
      progress: 10,
      status_message: 'Waiting for image provider.',
    })
    return
  }

  if (statusData.status === 'IN_PROGRESS') {
    await updateJob(env, row.id, row.user_id, {
      status: 'running',
      progress: 55,
      status_message: 'Generating your image.',
    })
    return
  }

  if (statusData.status !== 'COMPLETED') return

  const resultResponse = await falRequest(env, responseUrl)
  if (!resultResponse.ok) throw new Error('Unable to retrieve generated image.')

  const result = await resultResponse.json() as {
    images?: Array<{ url?: string; content_type?: string }>
  }

  const imageUrl = result.images?.[0]?.url
  if (typeof imageUrl !== 'string') {
    throw new Error('The image provider returned no image.')
  }

  const parsedImageUrl = new URL(imageUrl)
  if (
    parsedImageUrl.protocol !== 'https:' ||
    !(parsedImageUrl.hostname === 'fal.media' ||
      parsedImageUrl.hostname.endsWith('.fal.media'))
  ) {
    throw new Error('The image provider returned an untrusted image URL.')
  }

  const imageResponse = await fetch(parsedImageUrl.toString())
  if (!imageResponse.ok) throw new Error('Unable to download generated image.')

  const contentType = (imageResponse.headers.get('Content-Type') || '')
    .split(';')[0].trim().toLowerCase()

  const extensions: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
  }

  const extension = extensions[contentType]
  if (!extension) throw new Error('The generated image format is not supported.')

  const declaredSize = Number(imageResponse.headers.get('Content-Length') || 0)
  if (declaredSize > MAX_IMAGE_BYTES) {
    throw new Error('The generated image exceeds the 20 MB limit.')
  }

  const bytes = await imageResponse.arrayBuffer()
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new Error('The generated image exceeds the 20 MB limit.')
  }

  const storagePath = `${row.user_id}/${row.id}.${extension}`
  const encodedPath = storagePath.split('/').map(encodeURIComponent).join('/')

  const uploadResponse = await fetch(
    `${env.SUPABASE_URL!.replace(/\/$/, '')}/storage/v1/object/${BUCKET}/${encodedPath}`,
    {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY!}`,
        'Content-Type': contentType,
        'x-upsert': 'true',
      },
      body: bytes,
    }
  )

  if (!uploadResponse.ok) {
    throw new Error('Unable to save generated image to private storage.')
  }

  await updateJob(env, row.id, row.user_id, {
    status: 'succeeded',
    progress: 100,
    status_message: 'Image generated successfully.',
    request: {
      ...row.request,
      storage_path: storagePath,
    },
    output_urls: [],
    error: null,
  })
}

const getRows = async (
  env: MediaEnv,
  params: URLSearchParams
): Promise<MediaRow[]> => {
  const response = await databaseRequest(env, `media_jobs?${params}`)

  if (!response.ok) throw new Error('Unable to load media jobs.')

  return await response.json() as MediaRow[]
}

export const handleMediaRequest = async (
  request: Request,
  env: MediaEnv,
  userId: string,
  url: URL
): Promise<Response> => {
  const origin = env.ALLOWED_ORIGIN
  const path = url.pathname

  try {
    if (path === '/media/v1/models' && request.method === 'GET') {
      const models = env.FAL_KEY
        ? [{
            id: MODEL_ID,
            name: 'FLUX.1 [schnell] via fal.ai',
            kind: 'image',
            loaded: true,
            available: true,
            description: 'Fast AI image generation. Hosted inference powered by fal.ai.',
          }]
        : []

      return jsonOk({ models }, origin)
    }

    if (path === '/media/v1/images' && request.method === 'POST') {
      if (!env.FAL_KEY) {
        return json('Image generation provider is not configured.', 503, origin)
      }

      let body: Record<string, unknown>
      try {
        body = await request.json() as Record<string, unknown>
      } catch {
        return json('Invalid JSON request body.', 400, origin)
      }

      const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
      if (!prompt || prompt.length > 4000) {
        return json('Enter an image prompt of up to 4,000 characters.', 400, origin)
      }

      if (body.model && body.model !== MODEL_ID) {
        return json('The selected image model is not supported.', 400, origin)
      }

      const width = Number(body.width) || 1024
      const height = Number(body.height) || 1024
      if (
        !Number.isFinite(width) || !Number.isFinite(height) ||
        width < 256 || height < 256 || width > 1536 || height > 1536
      ) {
        return json('Image dimensions must be between 256 and 1536 pixels.', 400, origin)
      }

      const imageSize = width > height * 1.15
        ? 'landscape_4_3'
        : height > width * 1.15
          ? 'portrait_4_3'
          : 'square_hd'

      const steps = Math.min(4, Math.max(1, Math.round(Number(body.steps) || 4)))

      const insertResponse = await databaseRequest(
        env,
        'media_jobs?select=' + encodeURIComponent(columns),
        {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({
            user_id: userId,
            kind: 'image',
            status: 'queued',
            prompt,
            model: MODEL_ID,
            request: {
              width,
              height,
              steps,
              provider: 'fal.ai',
            },
            progress: 0,
            status_message: 'Submitting image generation.',
            output_urls: [],
          }),
        }
      )

      if (!insertResponse.ok) {
        return json('Unable to create image generation job.', 502, origin)
      }

      const inserted = await insertResponse.json() as MediaRow[]
      const row = inserted[0]
      if (!row) return json('Unable to create image generation job.', 502, origin)

      try {
        const falResponse = await falRequest(
          env,
          `https://queue.fal.run/${MODEL_ID}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt,
              image_size: imageSize,
              num_inference_steps: steps,
              num_images: 1,
              output_format: 'png',
            }),
          }
        )

        if (!falResponse.ok) {
          await updateJob(env, row.id, userId, {
            status: 'failed',
            error: 'The image provider rejected the generation request.',
            status_message: 'Generation could not be started.',
          })
          return json('The image provider could not start generation. Please try again.', 502, origin)
        }

        const queued = await falResponse.json() as Record<string, unknown>
        const statusUrl = safeFalUrl(queued.status_url)
        const responseUrl = safeFalUrl(queued.response_url)

        if (
          typeof queued.request_id !== 'string' ||
          !statusUrl || !responseUrl
        ) {
          throw new Error('The image provider returned an invalid queue response.')
        }

        await updateJob(env, row.id, userId, {
          status: 'queued',
          progress: 5,
          status_message: 'Waiting for image provider.',
          request: {
            ...row.request,
            provider: 'fal.ai',
            fal_request_id: queued.request_id,
            fal_status_url: statusUrl,
            fal_response_url: responseUrl,
          },
        })

        const refreshed = await getRows(env, new URLSearchParams({
          select: columns,
          id: `eq.${row.id}`,
          user_id: `eq.${userId}`,
          limit: '1',
        }))

        return jsonOk({
          job: refreshed[0] ? await toJob(env, refreshed[0]) : await toJob(env, row),
        }, origin)
      } catch {
        await updateJob(env, row.id, userId, {
          status: 'failed',
          error: 'Unable to submit the image to the provider.',
          status_message: 'Generation failed.',
        })
        return json('Unable to submit image generation. Please try again.', 502, origin)
      }
    }

    if (path === '/media/v1/jobs' && request.method === 'GET') {
      const limit = Math.min(
        100,
        Math.max(1, Number.parseInt(url.searchParams.get('limit') || '30', 10) || 30)
      )
      const offset = Math.max(
        0,
        Number.parseInt(url.searchParams.get('offset') || '0', 10) || 0
      )

      const params = new URLSearchParams({
        select: columns,
        user_id: `eq.${userId}`,
        order: 'created_at.desc',
        limit: String(limit),
        offset: String(offset),
      })

      let rows = await getRows(env, params)

      for (const row of rows.filter(
        (item) => item.kind === 'image' && ['queued', 'running'].includes(item.status)
      ).slice(0, 5)) {
        try {
          await refreshFalJob(env, row)
        } catch {
          await updateJob(env, row.id, userId, {
            status: 'failed',
            error: 'Image processing failed. Please try again.',
            status_message: 'Generation failed.',
          })
        }
      }

      rows = await getRows(env, params)

      return jsonOk({
        jobs: await Promise.all(rows.map((row) => toJob(env, row))),
        total: rows.length,
      }, origin)
    }

    const jobMatch = path.match(/^\/media\/v1\/jobs\/([0-9a-f-]{36})$/i)

    if (jobMatch && request.method === 'GET') {
      const rows = await getRows(env, new URLSearchParams({
        select: columns,
        id: `eq.${jobMatch[1]}`,
        user_id: `eq.${userId}`,
        limit: '1',
      }))

      if (!rows.length) return json('Media job not found.', 404, origin)

      const row = rows[0]
      if (row.kind === 'image' && ['queued', 'running'].includes(row.status)) {
        await refreshFalJob(env, row)
      }

      const updated = await getRows(env, new URLSearchParams({
        select: columns,
        id: `eq.${jobMatch[1]}`,
        user_id: `eq.${userId}`,
        limit: '1',
      }))

      return jsonOk({ job: await toJob(env, updated[0] || row) }, origin)
    }

    if (jobMatch && request.method === 'DELETE') {
      const rows = await getRows(env, new URLSearchParams({
        select: columns,
        id: `eq.${jobMatch[1]}`,
        user_id: `eq.${userId}`,
        limit: '1',
      }))

      if (!rows.length) return json('Media job not found.', 404, origin)

      const storagePath = rows[0].request?.storage_path
      if (storagePath && env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
        const encodedPath = storagePath.split('/').map(encodeURIComponent).join('/')
        await fetch(
          `${env.SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/${BUCKET}/${encodedPath}`,
          {
            method: 'DELETE',
            headers: {
              apikey: env.SUPABASE_SERVICE_ROLE_KEY,
              Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            },
          }
        )
      }

      const params = new URLSearchParams({
        id: `eq.${jobMatch[1]}`,
        user_id: `eq.${userId}`,
      })

      const response = await databaseRequest(env, `media_jobs?${params}`, {
        method: 'DELETE',
        headers: { Prefer: 'return=minimal' },
      })

      if (!response.ok) return json('Unable to delete this media job.', 502, origin)

      return jsonOk({ success: true }, origin)
    }

    if (
      request.method === 'POST' &&
      [
        '/media/v1/audio/tts',
        '/media/v1/audio/music',
        '/media/v1/videos',
      ].includes(path)
    ) {
      return json(
        'This media generation provider is not connected yet.',
        503,
        origin
      )
    }

    return json('Media endpoint or method not allowed.', 404, origin)
  } catch (error) {
    if (request.signal.aborted) {
      return json('Request was cancelled.', 499, origin)
    }

    return json(
      error instanceof Error && error.message.includes('credentials')
        ? error.message
        : 'Media service temporarily unavailable.',
      503,
      origin
    )
  }
}
