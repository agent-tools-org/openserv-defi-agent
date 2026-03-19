import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import solc from 'solc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/** Resolved paths used by the compiler. */
export const paths = {
  contractsDir: join(__dirname, '..', 'contracts'),
  artifactsDir: join(__dirname, '..', 'artifacts')
} as const

/** Input descriptor for a Solidity source file. */
export interface CompileInput {
  name: string
  content: string
}

/** Compiled contract artifact. */
export interface CompileOutput {
  contractName: string
  abi: unknown[]
  bytecode: string
}

/**
 * Compile one or more Solidity sources using solc and return artifacts.
 * Throws on compilation errors.
 */
export function compileSources(sources: CompileInput[]): CompileOutput[] {
  const inputSources: Record<string, { content: string }> = {}
  for (const src of sources) {
    inputSources[src.name] = { content: src.content }
  }

  const input = {
    language: 'Solidity',
    sources: inputSources,
    settings: {
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode.object']
        }
      }
    }
  }

  const output = JSON.parse(solc.compile(JSON.stringify(input)))

  if (output.errors) {
    const severe = (output.errors as Array<{ severity: string; formattedMessage: string }>).filter(
      (e) => e.severity === 'error'
    )
    if (severe.length > 0) {
      throw new Error(
        `Solidity compilation failed:\n${severe.map((e) => e.formattedMessage).join('\n')}`
      )
    }
  }

  const artifacts: CompileOutput[] = []

  for (const fileName of Object.keys(output.contracts ?? {})) {
    for (const contractName of Object.keys(output.contracts[fileName])) {
      const contract = output.contracts[fileName][contractName]
      artifacts.push({
        contractName,
        abi: contract.abi,
        bytecode: `0x${contract.evm.bytecode.object as string}`
      })
    }
  }

  return artifacts
}

/**
 * Read DeFiAnalyticsLog.sol from the contracts directory, compile it,
 * write the artifact to artifacts/, and return the artifact.
 */
export function compileContract(): CompileOutput {
  const solPath = join(paths.contractsDir, 'DeFiAnalyticsLog.sol')
  const source = readFileSync(solPath, 'utf-8')

  const artifacts = compileSources([{ name: 'DeFiAnalyticsLog.sol', content: source }])

  const artifact = artifacts.find((a) => a.contractName === 'DeFiAnalyticsLog')
  if (!artifact) {
    throw new Error('DeFiAnalyticsLog contract not found in compilation output')
  }

  mkdirSync(paths.artifactsDir, { recursive: true })
  writeFileSync(
    join(paths.artifactsDir, 'DeFiAnalyticsLog.json'),
    JSON.stringify(artifact, null, 2)
  )

  return artifact
}

/* Run as a script when executed directly. */
const isMain =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  (process.argv[1].includes('compile') || process.argv[1] === fileURLToPath(import.meta.url))

if (isMain) {
  const artifact = compileContract()
  const fnCount = artifact.abi.filter((e: any) => e.type === 'function').length
  const evCount = artifact.abi.filter((e: any) => e.type === 'event').length
  console.log(
    `Compiled DeFiAnalyticsLog — ${fnCount} functions, ${evCount} events, bytecode ${artifact.bytecode.length} chars`
  )
}
