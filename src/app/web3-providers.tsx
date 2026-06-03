'use client'

import '@rainbow-me/rainbowkit/styles.css'

import {
  ChainStoreProvider,
  createChainStore,
  createDaoStore,
  DaoStoreProvider,
} from '@buildeross/stores'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { type Config, WagmiProvider } from 'wagmi'

const Web3ReadyContext = createContext(false)

/**
 * Returns `true` after wagmi/RainbowKit are mounted client-side. Use to gate
 * components that depend on wallet hooks (e.g. RainbowKit's `ConnectButton`).
 */
export function useWeb3Ready(): boolean {
  return useContext(Web3ReadyContext)
}

import { getDaoConfig } from '@/config'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // No GLOBAL polling. A 5s refetchInterval default made every mounted
      // wagmi read (balances, eligibility multicalls, vetoer, …) poll the
      // free-tier RPC/subgraph every 5s — the very endpoints the rest of the
      // app carefully backs off from. The live surfaces (useAuctionTruth /
      // useProposalTruth / ProposalActions / AuctionPoller) opt into their own
      // polling explicitly; everything else refetches on mount/focus.
      staleTime: 30_000,
      refetchInterval: false,
    },
  },
})

export function Web3Providers({ children }: { children: React.ReactNode }) {
  const daoConfig = getDaoConfig()
  const chainStore = useMemo(() => createChainStore(daoConfig.chain), [daoConfig.chain])
  const daoStore = useMemo(
    () => createDaoStore(daoConfig.addresses),
    [daoConfig.addresses]
  )

  // Wagmi/WalletConnect connector touches `localStorage`/`indexedDB` during
  // init. Defer creation to a client-side effect so SSR never imports it.
  const [config, setConfig] = useState<Config | null>(null)
  useEffect(() => {
    let cancelled = false
    import('@/utils/clientConfig').then((mod) => {
      if (!cancelled) setConfig(mod.createWagmiConfig())
    })
    return () => {
      cancelled = true
    }
  }, [])

  const stores = (
    <ChainStoreProvider store={chainStore}>
      <DaoStoreProvider store={daoStore}>{children}</DaoStoreProvider>
    </ChainStoreProvider>
  )

  if (!config) {
    return <Web3ReadyContext.Provider value={false}>{stores}</Web3ReadyContext.Provider>
  }

  return (
    <Web3ReadyContext.Provider value={true}>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider>{stores}</RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </Web3ReadyContext.Provider>
  )
}
