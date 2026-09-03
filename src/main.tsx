import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './store/auth.tsx'
import { HabitProvider } from './store/habitStore.tsx'
import { NoteProvider } from './store/noteStore.tsx'
import { TaskProvider } from './store/taskStore.tsx'
import { ThemeProvider } from './store/theme.tsx'
import { registerServiceWorker } from './store/notifications.ts'
import { initializeNativeApp } from './native/platform.ts'

// Adds the native document classes synchronously, then configures the iOS
// status bar and keyboard through Capacitor without delaying first paint.
initializeNativeApp()

// The worker is the web/PWA delivery path. Native builds skip it inside the
// helper and use iOS local notifications instead.
void registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <TaskProvider>
        <NoteProvider>
          <HabitProvider>
            <ThemeProvider>
              <App />
            </ThemeProvider>
          </HabitProvider>
        </NoteProvider>
      </TaskProvider>
    </AuthProvider>
  </StrictMode>,
)
