'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { SWRConfig } from 'swr'

import { TweaksProvider } from '@/lib/tweaks-context'

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
        <Web3Providers>
          <TweaksProvider>{children}</TweaksProvider>
        </Web3Providers>
      </SWRConfig>
    </NextThemesProvider>
  )
}
