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

// The worker is how reminders reach a phone at all, so it is registered up
// front rather than when the first one comes due — on iOS the permission
// prompt is only offered to an installed app that already has one.
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
