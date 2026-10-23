export interface ServerConfig {
  apiUrl: string
  apiKey: string
  wsUrl: string
  transport: 'stdio' | 'sse'
  port: number
  host: string
}

export function loadConfig(): ServerConfig {
  const args = process.argv.slice(2)
  let transport: 'stdio' | 'sse' = 'stdio'
  let port = 3005
  let host = '127.0.0.1'

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--transport' && args[i + 1]) {
      const val = args[i + 1].toLowerCase()
      if (val === 'sse' || val === 'stdio') {
        transport = val
      }
      i++
    } else if (args[i] === '--port' && args[i + 1]) {
      port = parseInt(args[i + 1], 10) || 3005
      i++
    } else if (args[i] === '--host' && args[i + 1]) {
      host = args[i + 1]
      i++
    }
  }

  const apiUrl = (process.env.TYPECLUB_API_URL || 'http://localhost:8000').replace(/\/+$/, '')
  const apiKey = (process.env.TYPECLUB_API_KEY || '').trim()
  const wsUrl = (process.env.TYPECLUB_WS_URL || 'ws://localhost:4444').replace(/\/+$/, '')

  return {
    apiUrl,
    apiKey,
    wsUrl,
    transport,
    port,
    host,
  }
}
