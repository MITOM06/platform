'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { useState } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { SessionInitializer } from '@/components/layout/SessionInitializer'
import { registerQueryClient } from '@/lib/query-client'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      defaultOptions: { queries: { staleTime: 60_000 } },
    })
    // Lets logout / forced logout wipe the cache from outside React.
    registerQueryClient(client)
    return client
  })

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <SessionInitializer>{children}</SessionInitializer>
        <Toaster position="top-center" richColors closeButton />
      </ThemeProvider>
    </QueryClientProvider>
  )
}
