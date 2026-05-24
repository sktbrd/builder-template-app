import { transports } from '@buildeross/utils/wagmi'
import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { mainnet } from 'wagmi/chains'

import { getDaoConfig } from '@/config'

/**
 * Create the wagmi/RainbowKit config lazily. Wallet connector init touches
 * `localStorage`/`indexedDB`, so creation must be deferred until the client
 * has mounted — never call this at module top level.
 */
export function createWagmiConfig() {
  const daoChain = getDaoConfig().chain
  if (!daoChain) {
    throw new Error(`DAO chain not found. Make sure to run the prebuild script first.`)
  }

  const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID?.trim()
  if (!walletConnectProjectId) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID is not set. Get a project ID at https://cloud.walletconnect.com and add it to your .env file.'
      )
    }
    console.warn(
      '[clientConfig] NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID is not set — wallet connections will not work.'
    )
  }

  const chains = (daoChain.id === mainnet.id ? [daoChain] : [daoChain, mainnet]) as [
    typeof daoChain,
    ...(typeof daoChain)[],
  ]

  return getDefaultConfig({
    appName: 'Builder Template',
    projectId: walletConnectProjectId || 'dummy_project_id',
    chains,
    transports: {
      [daoChain.id]: transports[daoChain.id],
      [mainnet.id]: transports[mainnet.id],
    },
    ssr: true,
  })
}
