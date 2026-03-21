import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = resolve(__dirname, '..')

const localConfigPath = resolve(projectRoot, 'src', 'firebase', 'firebase.config.local.js')
const generatedConfigPath = resolve(projectRoot, 'src', 'firebase', 'firebase.config.generated.js')

const fallbackModule = `export async function initializeFirebaseFromLocalConfig() {
  return { app: null, analytics: null }
}
`

const wait = (milliseconds) => new Promise((resolvePromise) => {
  setTimeout(resolvePromise, milliseconds)
})

const writeGeneratedConfig = async (contents) => {
  let lastError = null

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      writeFileSync(generatedConfigPath, contents, 'utf8')
      return
    } catch (error) {
      lastError = error
      if (error?.code !== 'EBUSY' || attempt === 4) {
        throw error
      }
      await wait(120 * (attempt + 1))
    }
  }

  if (lastError) {
    throw lastError
  }
}

mkdirSync(dirname(generatedConfigPath), { recursive: true })

if (existsSync(localConfigPath)) {
  const localConfigContents = readFileSync(localConfigPath, 'utf8')
  await writeGeneratedConfig(localConfigContents)
  console.log('Using local Firebase config: src/firebase/firebase.config.local.js')
} else {
  await writeGeneratedConfig(fallbackModule)
  console.log('No local Firebase config found; Firebase initialization disabled.')
}
