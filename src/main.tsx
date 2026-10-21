import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ToastProvider } from './components/toast'
import { AppStoreProvider } from './state/AppStore'
import { ThemeProvider } from './theme/ThemeProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <AppStoreProvider>
          <App />
        </AppStoreProvider>
      </ToastProvider>
    </ThemeProvider>
  </StrictMode>,
)
