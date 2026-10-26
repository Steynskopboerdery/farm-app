import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import type { Root } from 'react-dom/client'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthProvider'
import { FarmProvider } from './farm/FarmProvider'
import { ErrorBoundary } from './components/ErrorBoundary'
import { I18nProvider } from './lib/i18n'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, networkMode: 'offlineFirst' },
    mutations: { networkMode: 'offlineFirst' },
  },
})

export function start(root: Root) {
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <I18nProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <FarmProvider>
                <App />
              </FarmProvider>
            </AuthProvider>
          </QueryClientProvider>
        </I18nProvider>
      </ErrorBoundary>
    </StrictMode>,
  )
}
