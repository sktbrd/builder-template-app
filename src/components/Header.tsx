'use client'

import { isChainIdSupportedByCoining } from '@buildeross/utils'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Menu, Moon, Sun, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useMemo, useState, useSyncExternalStore } from 'react'

import { useEnsAvatar, useEnsName } from 'wagmi'
import { mainnet } from 'wagmi/chains'

import { useWeb3Ready } from '@/app/web3-providers'
import { DaoAvatar } from '@/components/DaoAvatar'
import { daoConfig } from '@/lib/dao.config'
import { cn } from '@/lib/utils'

function ConnectedProfile({
  address,
  openAccountModal,
}: {
  address: `0x${string}`
  openAccountModal: () => void
}) {
  const { data: ensName } = useEnsName({ address, chainId: mainnet.id })
  const { data: ensAvatar } = useEnsAvatar({ name: ensName ?? undefined, chainId: mainnet.id })

  const displayName = ensName ?? `${address.slice(0, 6)}…${address.slice(-4)}`
  const hue = parseInt(address.slice(2, 8), 16) % 360

  return (
    <button
      type="button"
      onClick={openAccountModal}
      className="flex h-9 items-center gap-2 rounded-full border border-border bg-surface-2 pl-1.5 pr-3 text-sm font-medium hover:bg-surface-3"
    >
      {ensAvatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={ensAvatar} alt="" className="h-6 w-6 rounded-full object-cover" />
      ) : (
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
          style={{ background: `hsl(${hue} 60% 45%)` }}
        >
          {displayName.slice(0, 2).toUpperCase()}
        </span>
      )}
      <span className="font-mono text-[12px]">{displayName}</span>
    </button>
  )
}

function WalletButton() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openConnectModal, openAccountModal, mounted }) => {
        if (!mounted) return <div className="h-9 w-[140px] rounded-full bg-surface-2" />
        if (!account || !chain) {
          return (
            <button
              type="button"
              onClick={openConnectModal}
              className="h-9 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg hover:opacity-90"
            >
              Connect
            </button>
          )
        }
        return (
          <ConnectedProfile
            address={account.address as `0x${string}`}
            openAccountModal={openAccountModal}
          />
        )
      }}
    </ConnectButton.Custom>
  )
}

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  10: 'Optimism',
  8453: 'Base',
  7777777: 'Zora',
}

type NavItem = {
  href: string
  label: string
  match: (p: string) => boolean
}

const BASE_NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Dashboard', match: (p: string) => p === '/' },
  {
    href: '/auction/latest',
    label: 'Auction',
    match: (p: string) => p.startsWith('/auction'),
  },
  {
    href: '/proposals',
    label: 'Proposals',
    match: (p: string) => p === '/proposals' || p.startsWith('/proposals/'),
  },
  { href: '/treasury', label: 'Treasury', match: (p: string) => p === '/treasury' },
  {
    href: '/members',
    label: 'Members',
    match: (p: string) => p === '/members' || p.startsWith('/members/'),
  },
  { href: '/feed', label: 'Feed', match: (p: string) => p === '/feed' },
  { href: '/about', label: 'About', match: (p: string) => p === '/about' },
]

const COINS_NAV_ITEM: NavItem = {
  href: '/coins',
  label: 'Coins',
  match: (p: string) => p === '/coins' || p.startsWith('/coins/'),
}

const subscribeMounted = () => () => {}
const getMountedSnapshot = () => true
const getMountedServerSnapshot = () => false

export function Header() {
  const pathname = usePathname() ?? '/'
  const [mobileOpen, setMobileOpen] = useState(false)
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(
    subscribeMounted,
    getMountedSnapshot,
    getMountedServerSnapshot
  )
  const web3Ready = useWeb3Ready()

  const chainName = CHAIN_NAMES[daoConfig.chainId] ?? `Chain ${daoConfig.chainId}`

  // Inject /coins between Treasury and Members when the chain supports Clanker
  // and the feature flag is on. Keeps the surface invisible on chains where
  // the route would 404 anyway (Ethereum, Optimism, Zora, …).
  const navItems = useMemo<NavItem[]>(() => {
    const coinsEnabled =
      daoConfig.features.coins && isChainIdSupportedByCoining(daoConfig.chainId)
    if (!coinsEnabled) return BASE_NAV_ITEMS
    const treasuryIdx = BASE_NAV_ITEMS.findIndex((i) => i.href === '/treasury')
    if (treasuryIdx === -1) return [...BASE_NAV_ITEMS, COINS_NAV_ITEM]
    return [
      ...BASE_NAV_ITEMS.slice(0, treasuryIdx + 1),
      COINS_NAV_ITEM,
      ...BASE_NAV_ITEMS.slice(treasuryIdx + 1),
    ]
  }, [])

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/80 backdrop-blur-md backdrop-saturate-150">
      <div className="mx-auto flex max-w-[1180px] items-center gap-6 px-6 py-3">
        <Link href="/" className="flex items-center gap-2.5 text-base font-bold">
          <DaoAvatar
            image={daoConfig.image}
            alt={daoConfig.name}
            fallbackColor={daoConfig.theme.accent}
            size={28}
            priority
          />
          <span className="font-display tracking-tight">{daoConfig.name}</span>
          <ChainPill chainName={chainName} />
        </Link>

        <nav className="ml-auto hidden items-center gap-1 md:flex">
          {navItems.map((item) => {
            const active = item.match(pathname)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active ? 'text-fg' : 'text-muted-fg hover:bg-surface-2 hover:text-fg'
                )}
              >
                {item.label}
                {active && (
                  <span className="absolute inset-x-2 -bottom-3 h-0.5 rounded-sm bg-fg" />
                )}
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <button
            type="button"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-2 text-base hover:bg-surface-3"
            aria-label="Toggle theme"
          >
            {mounted ? (
              resolvedTheme === 'dark' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )
            ) : (
              <span className="h-4 w-4" />
            )}
          </button>
          <div className="hidden md:block">
            {web3Ready ? <WalletButton /> : <div className="h-9 w-[140px] rounded-full bg-surface-2" />}
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-2 md:hidden"
            aria-label="Menu"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden">
          <div
            className="fixed inset-0 top-[60px] z-40 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <nav className="fixed right-4 top-[68px] z-50 flex min-w-[200px] flex-col gap-1 rounded-lg border border-border bg-surface p-3 shadow-lg">
            {navItems.map((item) => {
              const active = item.match(pathname)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'rounded-md px-3 py-2 text-sm font-medium',
                    active
                      ? 'bg-surface-2 text-fg'
                      : 'text-muted-fg hover:bg-surface-2 hover:text-fg'
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
            <div className="mt-2 border-t border-border pt-3">
              {web3Ready ? <WalletButton /> : <div className="h-9 w-full rounded-full bg-surface-2" />}
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}

function ChainPill({ chainName }: { chainName: string }) {
  return (
    <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-accent-strong">
      {chainName}
    </span>
  )
}
