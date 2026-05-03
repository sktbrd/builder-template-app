'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { SWRConfig } from 'swr'

import { Web3Providers } from './web3-providers'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <SWRConfig value={{}}>
        <Web3Providers>{children}</Web3Providers>
      </SWRConfig>
    </NextThemesProvider>
  )
}
