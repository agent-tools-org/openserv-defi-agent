import 'dotenv/config'
import { createDefiAgent } from './agent/defi-agent.js'
import { config } from './config.js'

async function main() {
  console.log(`Starting ${config.agent.name} v${config.agent.version}`)

  if (!config.openservApiKey) {
    console.error('Error: OPENSERV_API_KEY is required. Set it in .env or environment.')
    process.exit(1)
  }

  const agent = createDefiAgent()

  // Start the agent HTTP server.
  // In production, use `run(agent)` from '@openserv-labs/sdk' for tunnel support.
  agent.start()
  console.log('Agent server started. Waiting for tasks from OpenServ platform...')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
