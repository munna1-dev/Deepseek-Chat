import { useState } from 'react'
import styles from './ApiDevelopment.module.css'

const WORKER = 'https://YOUR-WORKER-BASE-URL'

const chatCurl = `curl -N \\
  -X POST "${WORKER}/anthropic/v1/messages" \\
  -H "Content-Type: application/json" \\
  -H "Accept: text/event-stream" \\
  -d '{
    "model": "gemini-flash-lite-latest",
    "system": "You are a helpful assistant.",
    "messages": [
      {
        "role": "user",
        "content": "Explain how an API works."
      }
    ],
    "thinking": { "type": "disabled" },
    "tools": [],
    "safety_check": { "level": "high" },
    "stream": true
  }'`

const chatJs = `const response = await fetch(
  "${WORKER}/anthropic/v1/messages",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "text/event-stream"
    },
    body: JSON.stringify({
      model: "gemini-flash-lite-latest",
      system: "You are a helpful assistant.",
      messages: [
        {
          role: "user",
          content: "Hello! Explain APIs simply."
        }
      ],
      thinking: { type: "disabled" },
      tools: [],
      safety_check: { level: "high" },
      stream: true
    })
  }
);

if (!response.ok) {
  throw new Error(await response.text());
}

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { value, done } = await reader.read();
  if (done) break;

  // Parse the server-sent events in each chunk.
  console.log(decoder.decode(value, { stream: true }));
}`

const imageCurl = `curl -X POST "${WORKER}/v1/tools/image" \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "A futuristic city at sunset, cinematic lighting"
  }'`

const imageJs = `const response = await fetch(
  "${WORKER}/v1/tools/image",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      prompt: "A futuristic city at sunset"
    })
  }
);

const result = await response.json();

if (!response.ok) {
  throw new Error(result.error || "Image generation failed");
}

// The API returns base64 image data.
const imageUrl =
  \`data:\${result.mimeType};base64,\${result.image}\`;

document.querySelector("#result").src = imageUrl;`

const providersCurl = `curl "${WORKER}/v1/providers"`

const modelsCurl = `curl "${WORKER}/models"`

const snippets: Record<string, string> = {
  chatCurl,
  chatJs,
  imageCurl,
  imageJs,
  providersCurl,
  modelsCurl,
}

const CodeSample = ({
  title,
  code,
  id,
  copied,
  onCopy,
}: {
  title: string
  code: string
  id: string
  copied: string
  onCopy: (id: string, code: string) => void
}) => (
  <div className={styles.sample}>
    <div className={styles.sampleHeader}>
      <span>{title}</span>
      <button type="button" onClick={() => onCopy(id, code)}>
        {copied === id ? 'Copied' : 'Copy code'}
      </button>
    </div>
    <pre><code>{code}</code></pre>
  </div>
)

export const ApiDevelopment = () => {
  const [copied, setCopied] = useState('')

  const copyCode = async (id: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(id)
    } catch {
      setCopied('')
    }
  }

  return (
    <section className={styles.container}>
      <details className={styles.details}>
        <summary className={styles.summary}>
          <span className={styles.summaryIcon}>{"</>"}</span>
          <span className={styles.summaryText}>
            <strong>API Development &amp; Usage</strong>
            <small>Integrate chat, models and image generation</small>
          </span>
          <span className={styles.expand}>Explore guide ↓</span>
        </summary>

        <div className={styles.content}>
          <div className={styles.intro}>
            <span className={styles.eyebrow}>DEVELOPER DOCUMENTATION</span>
            <h2>Build with DeepSeek AI</h2>
            <p>
              Connect your applications to the AI services powering this
              workspace. Use the HTTP endpoints below to send messages,
              discover models and generate images.
            </p>
          </div>

          <div className={styles.notice}>
            <strong>Before you begin</strong>
            <p>
              Replace <code>YOUR-WORKER-BASE-URL</code> in the examples with
              your deployed Worker URL. Do not include a trailing slash.
              The examples use the current Worker API.
            </p>
          </div>

          <section className={styles.section}>
            <h3>01 · API integration</h3>
            <p>
              The service exposes HTTP endpoints and returns JSON or
              server-sent events (SSE). Send requests over HTTPS and set
              the appropriate content type. Use the provider catalogue
              to discover this application's configured models.
            </p>
            <div className={styles.endpoint}>
              <span>CHAT COMPLETIONS</span>
              <code>POST /anthropic/v1/messages</code>
            </div>
            <div className={styles.endpoint}>
              <span>APPLICATION PROVIDER CATALOGUE</span>
              <code>GET /v1/providers</code>
            </div>
            <div className={styles.endpoint}>
              <span>LIVE GEMINI MODEL DISCOVERY</span>
              <code>GET /models</code>
            </div>
            <div className={styles.endpoint}>
              <span>IMAGE GENERATION</span>
              <code>POST /v1/tools/image</code>
            </div>
            <div className={styles.endpoint}>
              <span>FILE UPLOAD</span>
              <code>POST /anthropic/v1/files</code>
            </div>
            <div className={styles.endpoint}>
              <span>FILE DELETE</span>
              <code>DELETE /anthropic/v1/files/{"{file_id}"}</code>
            </div>
          </section>

          <section className={styles.section}>
            <h3>02 · Authentication</h3>
            <p>
              The current Worker uses server-side provider credentials.
              Its browser client does not require a personal API key, and
              the frontend API-key parameter is not forwarded to the
              providers.
            </p>
            <div className={styles.security}>
              <strong>Important security limitation</strong>
              <p>
                The Worker currently does not implement per-user API-key
                authentication. Its allowed-origin check is a browser CORS
                restriction, not access control. Do not treat this endpoint
                as a secured public API or distribute its URL as a private
                credential.
              </p>
            </div>
          </section>

          <section className={styles.section}>
            <h3>03 · Chat API</h3>
            <p>
              Send a Messages API-compatible JSON body. The chat endpoint
              streams events using SSE. Use <code>curl -N</code> to observe
              the stream without buffering.
            </p>
            <CodeSample
              title="cURL · Streaming chat"
              code={snippets.chatCurl}
              id="chatCurl"
              copied={copied}
              onCopy={copyCode}
            />
            <CodeSample
              title="JavaScript · Fetch"
              code={snippets.chatJs}
              id="chatJs"
              copied={copied}
              onCopy={copyCode}
            />
            <p className={styles.hint}>
              The response is an SSE stream containing events such as
              message_start, content_block_delta, message_delta and
              message_stop. Parse each complete event rather than treating
              each network chunk as a complete event.
            </p>
          </section>

          <section className={styles.section}>
            <h3>04 · Image generation</h3>
            <p>
              Submit a text prompt to the image endpoint. A successful
              response contains a base64-encoded image and its MIME type.
            </p>
            <div className={styles.endpoint}>
              <span>DEFAULT IMAGE MODEL</span>
              <code>black-forest-labs/FLUX.1-schnell</code>
            </div>
            <CodeSample
              title="cURL · Generate image"
              code={snippets.imageCurl}
              id="imageCurl"
              copied={copied}
              onCopy={copyCode}
            />
            <CodeSample
              title="JavaScript · Display result"
              code={snippets.imageJs}
              id="imageJs"
              copied={copied}
              onCopy={copyCode}
            />
            <p className={styles.hint}>
              Image generation requires the server-side Worker secret
              HF_TOKEN. Prompts must be non-empty and no longer than
              4,000 characters. The returned image payload is limited
              to 15 MiB. The endpoint responds with JSON containing
              base64 image data and its MIME type, not a raw PNG file.
            </p>
          </section>

          <section className={styles.section}>
            <h3>05 · Supported models</h3>
            <div className={styles.modelList}>
              <div className={styles.model}>
                <div>
                  <strong>Gemini Flash Lite</strong>
                  <code>gemini-flash-lite-latest</code>
                </div>
                <span className={styles.free}>Free tier</span>
              </div>
              <div className={styles.model}>
                <div>
                  <strong>Gemini 2.5 Flash</strong>
                  <code>gemini-2.5-flash</code>
                </div>
                <span className={styles.free}>Free tier</span>
              </div>
              <div className={styles.model}>
                <div>
                  <strong>DeepSeek Flash</strong>
                  <code>deepseek-flash</code>
                </div>
                <span className={styles.paid}>Paid · Opt-in</span>
              </div>
              <div className={styles.model}>
                <div>
                  <strong>DeepSeek V4 Pro</strong>
                  <code>deepseek-v4-pro</code>
                </div>
                <span className={styles.paid}>Paid · Opt-in</span>
              </div>
            </div>
            <p className={styles.hint}>
              The free/paid labels reflect this application's model
              registry, not a guarantee of provider pricing or unlimited
              usage. Provider quotas and billing may apply.
            </p>
            <p>
              Paid models require the <code>x-allow-paid: 1</code> request
              header. This is an explicit usage opt-in only; it is not
              authentication or payment verification.
            </p>
            <CodeSample
              title="cURL · Discover application providers and models"
              code={snippets.providersCurl}
              id="providersCurl"
              copied={copied}
              onCopy={copyCode}
            />
            <p className={styles.hint}>
              GET /v1/providers returns the configured Gemini and DeepSeek
              model catalogue. GET /models separately discovers models
              exposed by the connected Gemini provider.
            </p>
            <CodeSample
              title="cURL · Discover live Gemini models"
              code={snippets.modelsCurl}
              id="modelsCurl"
              copied={copied}
              onCopy={copyCode}
            />
          </section>

          <section className={styles.section}>
            <h3>06 · Errors and limits</h3>
            <div className={styles.errorList}>
              <p><code>400</code> Invalid request or unsupported model.</p>
              <p><code>403</code> Request origin is not allowed.</p>
              <p><code>413</code> Upload or image size limit exceeded.</p>
              <p><code>422</code> Paid model opt-in header is missing.</p>
              <p><code>503</code> Required provider credentials are not configured.</p>
            </div>
            <p className={styles.hint}>
              Keep provider credentials in Worker secrets. Never put
              Gemini, DeepSeek or Hugging Face secrets in frontend code,
              public repositories or browser requests.
            </p>
          </section>

          <footer className={styles.footer}>
            <strong>Ready to build?</strong>
            <p>
              Start with the chat endpoint, test a model, then add image
              generation to your application.
            </p>
            <span>DeepSeek AI · Developer Guide</span>
          </footer>
        </div>
      </details>
    </section>
  )
}
