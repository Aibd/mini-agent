import { callAnthropicModel } from './anthropic-call-model.mjs'

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile()
  } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) {
      throw error
    }
  }
}

function createToolDefinitions() {
  return [
    {
      name: 'get_current_time',
      description: 'Get the current date and time for a given IANA timezone.',
      input_schema: {
        type: 'object',
        properties: {
          timeZone: {
            type: 'string',
            description: 'IANA timezone like Asia/Shanghai or America/New_York.',
          },
        },
        required: ['timeZone'],
      },
    },
    {
      name: 'add_numbers',
      description: 'Add a list of numbers and return the total.',
      input_schema: {
        type: 'object',
        properties: {
          numbers: {
            type: 'array',
            items: {
              type: 'number',
            },
            description: 'Numbers to add together.',
          },
        },
        required: ['numbers'],
      },
    },
  ]
}

function serializeToolOutput(value) {
  if (typeof value === 'string') {
    return value
  }

  return JSON.stringify(value, null, 2)
}

async function executeLocalTool(toolUse) {
  switch (toolUse.name) {
    case 'get_current_time': {
      const timeZone = toolUse.input?.timeZone

      if (!timeZone) {
        throw new Error('timeZone is required')
      }

      const now = new Date()
      const formatter = new Intl.DateTimeFormat('zh-CN', {
        timeZone,
        dateStyle: 'full',
        timeStyle: 'long',
      })

      return {
        timeZone,
        iso: now.toISOString(),
        formatted: formatter.format(now),
      }
    }

    case 'add_numbers': {
      const numbers = toolUse.input?.numbers

      if (!Array.isArray(numbers) || numbers.length === 0) {
        throw new Error('numbers must be a non-empty array')
      }

      const sum = numbers.reduce((total, value) => total + Number(value), 0)

      return {
        numbers,
        sum,
      }
    }

    default:
      throw new Error(`Unknown tool: ${toolUse.name}`)
  }
}

function productionDeps() {
  return {
    callModel: callAnthropicModel,
    tools: createToolDefinitions(),
    executeTool: executeLocalTool,
  }
}

export function createUserMessage(content) {
  return {
    role: 'user',
    content,
  }
}

function createInitialState(messages) {
  return {
    messages,
    turnCount: 1,
    transition: undefined,
  }
}

export async function* query(params, deps = productionDeps()) {
  const terminal = yield* queryLoop(params, deps)
  return terminal
}

async function* queryLoop(params, deps) {
  let state = createInitialState(params.messages)
  const maxTurns = params.maxTurns ?? 8

  while (state.turnCount <= maxTurns) {
    yield {
      type: 'turn_start',
      turnCount: state.turnCount,
      transition: state.transition,
    }

    const assistantMessages = []
    const assistantEvents = []

    for await (const event of deps.callModel({
      messages: state.messages,
      systemPrompt: params.systemPrompt,
      tools: deps.tools ?? [],
      signal: params.signal,
      options: {
        model: params.model,
        maxTokens: params.maxTokens,
      },
    })) {
      yield event

      if (event.type === 'assistant') {
        assistantMessages.push(event.message)
        assistantEvents.push(event)
      }
    }

    const latestAssistantEvent = assistantEvents.at(-1)
    const latestAssistantMessage = assistantMessages.at(-1)
    const toolUses = latestAssistantEvent?.toolUses ?? []

    if (toolUses.length === 0) {
      return {
        reason: 'completed',
        messages: [...state.messages, ...assistantMessages],
      }
    }

    const toolResults = []

    for (const toolUse of toolUses) {
      yield {
        type: 'tool_use',
        turnCount: state.turnCount,
        toolUse,
      }

      try {
        const result = await deps.executeTool(toolUse)
        const content = serializeToolOutput(result)

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content,
        })

        yield {
          type: 'tool_result',
          turnCount: state.turnCount,
          toolName: toolUse.name,
          toolUseId: toolUse.id,
          isError: false,
          content,
        }
      } catch (error) {
        const content = error instanceof Error ? error.message : String(error)

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content,
          is_error: true,
        })

        yield {
          type: 'tool_result',
          turnCount: state.turnCount,
          toolName: toolUse.name,
          toolUseId: toolUse.id,
          isError: true,
          content,
        }
      }
    }

    state = {
      messages: [
        ...state.messages,
        ...(latestAssistantMessage ? [latestAssistantMessage] : []),
        {
          role: 'user',
          content: toolResults,
        },
      ],
      turnCount: state.turnCount + 1,
      transition: {
        reason: 'tool_result',
      },
    }
  }

  return {
    reason: 'max_turns',
    messages: state.messages,
  }
}

async function runConversation(userInput) {
  const stream = query({
    messages: [createUserMessage(userInput)],
    systemPrompt: 'You are a helpful assistant. Use an available tool whenever it helps answer the user more reliably.',
    maxTokens: 1024,
    signal: AbortSignal.timeout(60_000),
    maxTurns: 8,
  })

  while (true) {
    const { value, done } = await stream.next()

    if (done) {
      return value
    }

    if (value.type === 'turn_start') {
      console.log(`\n[turn ${value.turnCount}] transition=${value.transition?.reason ?? 'start'}`)
      continue
    }

    if (value.type === 'assistant' && value.text) {
      console.log(`[assistant] ${value.text}`)
      continue
    }

    if (value.type === 'tool_use') {
      console.log(`[tool_use] ${value.toolUse.name} ${JSON.stringify(value.toolUse.input)}`)
      continue
    }

    if (value.type === 'tool_result') {
      console.log(`[tool_result] ${value.toolName} ${value.isError ? 'error' : 'ok'}`)
      console.log(value.content)
    }
  }
}

const userInput =
  process.argv.slice(2).join(' ') ||
  'Explain the core loop from user input to model output.'

runConversation(userInput)
  .then(terminal => {
    console.log(`\nterminal reason: ${terminal.reason}`)
  })
  .catch(error => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
