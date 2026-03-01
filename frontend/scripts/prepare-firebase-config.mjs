import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
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

mkdirSync(dirname(generatedConfigPath), { recursive: true })

if (existsSync(localConfigPath)) {
  copyFileSync(localConfigPath, generatedConfigPath)
  console.log('Using local Firebase config: src/firebase/firebase.config.local.js')
} else {
  writeFileSync(generatedConfigPath, fallbackModule, 'utf8')
  console.log('No local Firebase config found; Firebase initialization disabled.')
}
