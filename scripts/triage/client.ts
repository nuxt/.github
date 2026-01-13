const GITHUB_MODELS_ENDPOINT = 'https://models.github.ai/inference'

const DEFAULT_MAX_RETRIES = 3
const DEFAULT_RETRY_DELAY_MS = 1000
const MIN_REQUEST_INTERVAL_MS = 100

type ModelIdentifier =
  | 'openai/gpt-4o'
  | 'openai/gpt-4o-mini'
  | 'openai/o3-mini'

interface AIClientOptions {
  /** GitHub token with models access */
  token: string
  /** Default model to use */
  defaultModel?: ModelIdentifier
  /** Maximum retry attempts for transient failures */
  maxRetries?: number
  /** Base delay between retries in ms (doubles with each retry) */
  retryDelayMs?: number
}

interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface CompletionOptions {
  /** Chat messages */
  messages: Message[]
  /** Override default model */
  model?: ModelIdentifier
  /** Temperature for generation */
  temperature?: number
  /** Whether to request JSON output */
  jsonMode?: boolean
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
  error?: {
    message?: string
    code?: string
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function isRetryableError(status: number): boolean {
  return status === 429 || status >= 500
}

export function createAIClient(options: AIClientOptions) {
  const {
    token,
    defaultModel = 'openai/gpt-4o-mini',
    maxRetries = DEFAULT_MAX_RETRIES,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
  } = options

  let lastRequestTime = 0

  async function throttle(): Promise<void> {
    const now = Date.now()
    const timeSinceLastRequest = now - lastRequestTime
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL_MS) {
      await sleep(MIN_REQUEST_INTERVAL_MS - timeSinceLastRequest)
    }
    lastRequestTime = Date.now()
  }

  async function complete(completionOptions: CompletionOptions): Promise<string> {
    const {
      messages,
      model = defaultModel,
      temperature = 0.1,
      jsonMode = true,
    } = completionOptions

    let lastError: Error | null = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await throttle()

        const response = await fetch(`${GITHUB_MODELS_ENDPOINT}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages,
            temperature,
            ...(jsonMode && { response_format: { type: 'json_object' } }),
          }),
        })

        if (!response.ok) {
          const errorText = await response.text()
          const error = new Error(`GitHub Models API error: ${response.status} ${response.statusText}\n${errorText}`)

          if (isRetryableError(response.status) && attempt < maxRetries) {
            const delay = retryDelayMs * Math.pow(2, attempt)
            console.warn(`Retrying after ${delay}ms (attempt ${attempt + 1}/${maxRetries}): ${response.status}`)
            await sleep(delay)
            lastError = error
            continue
          }

          throw error
        }

        const data = await response.json() as ChatCompletionResponse

        if (data.error) {
          throw new Error(`GitHub Models API returned error: ${data.error.message || 'Unknown error'}`)
        }

        if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
          throw new Error('GitHub Models API returned invalid response: missing choices array')
        }

        const content = data.choices[0]?.message?.content
        if (content === undefined || content === null) {
          throw new Error('GitHub Models API returned empty content')
        }

        return content
      } catch (error) {
        lastError = error as Error

        if (attempt >= maxRetries) {
          break
        }

        if (error instanceof TypeError && error.message.includes('fetch')) {
          const delay = retryDelayMs * Math.pow(2, attempt)
          console.warn(`Network error, retrying after ${delay}ms (attempt ${attempt + 1}/${maxRetries})`)
          await sleep(delay)
          continue
        }

        break
      }
    }

    throw lastError || new Error('Unknown error during AI completion')
  }

  function parseJSON<T>(response: string, defaultValue: T): T {
    try {
      // Handle potential markdown code blocks
      const cleaned = response
        .replace(/^```json\n?/i, '')
        .replace(/\n?```$/, '')
        .trim()
      return JSON.parse(cleaned) as T
    } catch (error) {
      console.error('Failed to parse AI response:', response, error)
      return defaultValue
    }
  }

  return {
    complete,
    parseJSON,
    models: {
      /** High accuracy model for complex decisions */
      COMPLEX: 'openai/gpt-4o' as const,
      /** Fast model for simple checks */
      SIMPLE: 'openai/gpt-4o-mini' as const,
      /** Reasoning model for nuanced decisions */
      REASONING: 'openai/o3-mini' as const,
    },
  }
}
