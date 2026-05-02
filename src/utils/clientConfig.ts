import { transports } from '@buildeross/utils/wagmi'
import { getDefaultConfig } from '@rainbow-me/rainbowkit'

import { getDaoConfig } from '@/config'

// Get the DAO chain
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
    '[clientConfig] NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID is not set — wallet connections will not work. Get a project ID at https://cloud.walletconnect.com'
  )
}

export const config = getDefaultConfig({
  appName: 'Builder Template',
  projectId: walletConnectProjectId || 'dummy_project_id',
  chains: [daoChain],
  transports: {
    [daoChain.id]: transports[daoChain.id],
  },
  ssr: true,
})
