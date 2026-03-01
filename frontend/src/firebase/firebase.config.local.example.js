import { initializeApp } from 'firebase/app'
import { getAnalytics, isSupported } from 'firebase/analytics'

const firebaseConfig = {
  apiKey: 'your-api-key',
  authDomain: 'your-project.firebaseapp.com',
  projectId: 'your-project-id',
  storageBucket: 'your-project.appspot.com',
  messagingSenderId: 'your-messaging-sender-id',
  appId: 'your-app-id',
  measurementId: 'your-measurement-id',
}

export async function initializeFirebaseFromLocalConfig() {
  const app = initializeApp(firebaseConfig)
  let analytics = null

  if (typeof window !== 'undefined' && (await isSupported())) {
    analytics = getAnalytics(app)
  }

  return { app, analytics }
}
