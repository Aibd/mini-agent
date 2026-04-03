function joinTextBlocks(content) {
  if (!Array.isArray(content)) {
    return ''
  }

  return content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('\n')
}

function getToolUses(content) {
  if (!Array.isArray(content)) {
    return []
  }

  return content.filter(block => block.type === 'tool_use')
}

// 默认只用这三个环境变量：
// BASE_URL、API_KEY、MODEL
// MiniMax 兼容 Anthropic 接口时，通常只需要改这三个。
function resolveBaseUrl() {
  return (
    process.env.BASE_URL ??
    process.env.ANTHROPIC_BASE_URL ??
    // 'https://api.anthropic.com'
    'https://api.minimaxi.com/anthropic'
  )
}

function resolveApiKey() {
  return process.env.API_KEY ?? process.env.ANTHROPIC_API_KEY
}

function resolveModel(options) {
  return (
    options.model ??
    process.env.MODEL ??
    process.env.ANTHROPIC_MODEL ??
    // 'claude-3-5-sonnet-latest'
    'MiniMax-M2.7'
  )
}

function buildMessagesUrl(baseUrl) {
  const normalized = baseUrl.replace(/\/+$/, '')
  return normalized.endsWith('/v1/messages')
    ? normalized
    : `${normalized}/v1/messages`
}

function formatFetchError(error, requestUrl) {
  if (!(error instanceof Error)) {
    return `Request to ${requestUrl} failed: ${String(error)}`
  }

  const details = [`Request to ${requestUrl} failed: ${error.message}`]
  const cause = error.cause

  if (cause && typeof cause === 'object') {
    if ('code' in cause && cause.code) {
      details.push(`cause code: ${cause.code}`)
    }

    if ('message' in cause && cause.message) {
      details.push(`cause: ${cause.message}`)
    }

    if ('address' in cause && cause.address) {
      details.push(`address: ${cause.address}`)
    }

    if ('port' in cause && cause.port) {
      details.push(`port: ${cause.port}`)
    }
  }

  return details.join('\n')
}

function shouldRetryError(error) {
  const code = error?.cause?.code
  return code === 'UND_ERR_CONNECT_TIMEOUT' || code === 'ECONNRESET'
}

function shouldRetryStatus(status) {
  return status === 408 || status === 429 || status >= 500
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function* callAnthropicModel({
  messages,
  systemPrompt,
  tools,
  signal,
  options,
}) {
  const baseUrl = resolveBaseUrl()
  const apiKey = resolveApiKey()
  const model = resolveModel(options)

  if (!apiKey) {
    throw new Error('Missing API_KEY')
  }

  const requestUrl = buildMessagesUrl(baseUrl)
  const requestInit = {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    signal,
    body: JSON.stringify({
      model,
      max_tokens: options.maxTokens ?? 1024,
      system: systemPrompt,
      messages,
      tools,
    }),
  }
  const maxAttempts = 3
  let response
  let lastError

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      response = await fetch(requestUrl, requestInit)

      if (!shouldRetryStatus(response.status) || attempt === maxAttempts) {
        break
      }

      await delay(500 * attempt)
    } catch (error) {
      lastError = error

      if (!shouldRetryError(error) || attempt === maxAttempts) {
        throw new Error(formatFetchError(error, requestUrl), { cause: error })
      }

      await delay(500 * attempt)
    }
  }

  if (!response) {
    throw new Error(formatFetchError(lastError, requestUrl), { cause: lastError })
  }

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Anthropic API error ${response.status}: ${errorText}`)
  }

  const message = await response.json()

  yield {
    type: 'assistant',
    message: {
      role: message.role,
      content: message.content,
    },
    text: joinTextBlocks(message.content),
    toolUses: getToolUses(message.content),
    stopReason: message.stop_reason,
  }
}
