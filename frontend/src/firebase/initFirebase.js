import { initializeFirebaseFromLocalConfig } from './firebase.config.generated.js'

let initPromise = null

export function initFirebase() {
  if (initPromise) return initPromise

  initPromise = initializeFirebaseFromLocalConfig().catch((error) => {
    if (import.meta.env.DEV) {
      console.warn('Firebase initialization failed:', error)
    }
    return { app: null, analytics: null }
  })

  return initPromise
}
