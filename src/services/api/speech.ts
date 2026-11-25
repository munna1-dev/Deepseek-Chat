import { ApiError, API_ORIGIN, request } from './client.js'

/**
 * Speech recognition through the Gemini-backed Worker.
 * Audio is uploaded as WAV and the endpoint returns the transcription.
 */
const TOOLS_BASE_URL = `${API_ORIGIN}/v1/tools`

// Retained for compatibility with saved settings and device read-aloud.
export type TtsVoice = 'stella' | 'tide'

/** Speech recognition: mono 16-bit PCM WAV, up to 120 seconds and 8 MiB. */
export const transcribe = async (
  _apiKey: string,
  audio: Blob,
  signal?: AbortSignal
): Promise<string> => {
  const form = new FormData()
  form.append('file', audio, 'recording.wav')

  const response = await request(`${TOOLS_BASE_URL}/asr`, {
    method: 'POST',
    headers: {},
    body: form,
    signal,
  })

  const raw = await response.text()
  let body: unknown

  try {
    body = JSON.parse(raw)
  } catch {
    throw new ApiError('protocol', raw)
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    !('text' in body) ||
    typeof body.text !== 'string'
  ) {
    throw new ApiError('protocol', raw)
  }

  return body.text
}
