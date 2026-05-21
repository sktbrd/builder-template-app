'use client'

import { NATIVE_TOKEN_ADDRESS } from '@buildeross/constants/addresses'
import { ETHERSCAN_BASE_URL } from '@buildeross/constants/etherscan'
import {
  useExecuteSwap,
  useSwapOptions,
  useSwapQuote,
  type SwapOption,
} from '@buildeross/hooks'
import { CHAIN_ID } from '@buildeross/types'
import { isChainIdSupportedForSaleOfZoraCoins } from '@buildeross/utils/coining'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { ExternalLink } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { type Address, erc20Abi, formatEther, parseEther } from 'viem'
import {
  useAccount,
  useBalance,
  useChainId,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWalletClient,
} from 'wagmi'

import { useWeb3Ready } from '@/app/web3-providers'
import { Button } from '@/components/ui/button'
import { daoConfig } from '@/lib/dao.config'

type Tab = 'buy' | 'sell'
type Phase = 'idle' | 'submitting' | 'mining' | 'done' | 'error'

type Props = {
  coinAddress: string
  coinSymbol: string | null
}

type SupportedChainId = CHAIN_ID.BASE | CHAIN_ID.BASE_SEPOLIA

function isSupportedChainId(id: number): id is SupportedChainId {
  return id === CHAIN_ID.BASE || id === CHAIN_ID.BASE_SEPOLIA
}

export function CoinTradeWidget(props: Props) {
  const ready = useWeb3Ready()
  if (!ready) return <CoinTradeWidgetSkeleton />
  if (!isSupportedChainId(daoConfig.chainId)) {
    return (
      <div className="rounded-md border border-border bg-surface-2 px-4 py-3 text-[12.5px] text-muted-fg">
        Trading is only available on Base / Base Sepolia.
      </div>
    )
  }
  return <CoinTradeWidgetInner {...props} chainId={daoConfig.chainId} />
}

function CoinTradeWidgetSkeleton() {
  return (
    <div className="h-[148px] animate-pulse rounded-md border border-border bg-surface-2" />
  )
}

function CoinTradeWidgetInner({
  coinAddress,
  coinSymbol,
  chainId,
}: Props & { chainId: SupportedChainId }) {
  const [tab, setTab] = useState<Tab>('buy')
  const [amount, setAmount] = useState('')
  const [selectedPaymentToken, setSelectedPaymentToken] = useState<Address>(
    NATIVE_TOKEN_ADDRESS as Address
  )
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null)

  const { address: userAddress, isConnected } = useAccount()
  const connectedChainId = useChainId()
  const { openConnectModal } = useConnectModal()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient({ chainId })

  const onWrongChain = isConnected && connectedChainId !== chainId
  const isBuying = tab === 'buy'

  // Selling Zora coins only works on Base mainnet right now (per builder utils).
  const sellEnabled = isChainIdSupportedForSaleOfZoraCoins(chainId)
  useEffect(() => {
    if (!sellEnabled && tab === 'sell') setTab('buy')
  }, [sellEnabled, tab])

  const { options, isLoading: optionsLoading } = useSwapOptions(
    chainId,
    coinAddress as Address,
    isBuying
  )

  // Keep selected payment token valid as options change.
  useEffect(() => {
    if (options.length === 0) return
    const lower = options.map((o) => o.token.address.toLowerCase())
    if (!lower.includes(selectedPaymentToken.toLowerCase())) {
      setSelectedPaymentToken(options[0].token.address)
    }
  }, [options, selectedPaymentToken])

  const selectedOption: SwapOption | undefined = options.find(
    (o) => o.token.address.toLowerCase() === selectedPaymentToken.toLowerCase()
  )
  const path = selectedOption?.path

  // Input token: what the user is spending. ETH on buy w/ native; otherwise the ERC20.
  const inputTokenAddress = isBuying ? selectedPaymentToken : (coinAddress as Address)
  const isInputNativeEth =
    isBuying && selectedPaymentToken.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase()

  const { data: nativeBalance, refetch: refetchNativeBalance } = useBalance({
    address: userAddress,
    chainId,
    query: { enabled: !!userAddress && isInputNativeEth },
  })

  const { data: erc20Balance, refetch: refetchErc20Balance } = useReadContract({
    address: inputTokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined,
    chainId,
    query: { enabled: !!userAddress && !isInputNativeEth },
  })

  const inputBalance: bigint | undefined = isInputNativeEth
    ? nativeBalance?.value
    : (erc20Balance as bigint | undefined)

  function refetchBalance() {
    if (isInputNativeEth) refetchNativeBalance()
    else refetchErc20Balance()
  }

  const amountInBigInt = useMemo(() => {
    if (!amount) return BigInt(0)
    try {
      return parseEther(amount)
    } catch {
      return BigInt(0)
    }
  }, [amount])

  const {
    amountOut,
    isLoading: quoteLoading,
    error: quoteError,
  } = useSwapQuote({
    chainId,
    path: path ?? undefined,
    amountIn: amountInBigInt,
    slippage: 0.05,
    enabled: !!path && amountInBigInt > BigInt(0),
  })

  const { execute, isExecuting } = useExecuteSwap({
    walletClient: walletClient ?? undefined,
    publicClient: publicClient ?? undefined,
  })

  // Reset transient state when switching tab/payment token
  useEffect(() => {
    setAmount('')
    setPhase('idle')
    setError(null)
    setTxHash(null)
  }, [tab, selectedPaymentToken])

  // After success, keep the tx hash visible but reset the input + phase so the
  // user can chain another trade.
  useEffect(() => {
    if (phase !== 'done') return
    const t = setTimeout(() => {
      setPhase('idle')
      setAmount('')
    }, 1500)
    return () => clearTimeout(t)
  }, [phase])

  const amountValid = amountInBigInt > BigInt(0)
  const paymentSymbol = selectedOption?.token.symbol ?? 'ETH'
  const inputUnit = isBuying ? paymentSymbol : (coinSymbol ?? 'TOKEN')
  const outputUnit = isBuying ? (coinSymbol ?? 'TOKEN') : paymentSymbol

  async function handleTrade() {
    if (!path || !amountOut || amountOut === BigInt(0) || !publicClient) return
    setPhase('submitting')
    setError(null)
    setTxHash(null)
    try {
      const hash = await execute({
        chainId,
        path,
        amountIn: amountInBigInt,
        amountOut,
        slippage: 0.05,
      })
      setTxHash(hash)
      setPhase('mining')
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      if (receipt.status === 'reverted') throw new Error('Transaction reverted')
      setPhase('done')
      refetchBalance()
    } catch (e) {
      setPhase('error')
      setError(parseTradeError(e))
    }
  }

  function setMax() {
    if (inputBalance == null) return
    // For native ETH, leave a small buffer for gas.
    const buffer = isInputNativeEth ? parseEther('0.0002') : BigInt(0)
    const usable = inputBalance > buffer ? inputBalance - buffer : BigInt(0)
    setAmount(formatEther(usable))
  }

  const exceedsBalance = inputBalance != null && amountInBigInt > inputBalance
  const explorerBase = ETHERSCAN_BASE_URL[chainId]
  const txUrl = txHash && explorerBase ? `${explorerBase}/tx/${txHash}` : null

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-surface-2 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11.5px] font-semibold uppercase tracking-wider text-muted-fg">
          Trade
        </div>
        <div className="inline-flex rounded-md bg-surface p-0.5 text-[12px]">
          <TabButton active={tab === 'buy'} onClick={() => setTab('buy')}>
            Buy
          </TabButton>
          <TabButton
            active={tab === 'sell'}
            disabled={!sellEnabled}
            onClick={() => sellEnabled && setTab('sell')}
          >
            Sell
          </TabButton>
        </div>
      </div>

      <label className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2 focus-within:border-accent">
        <input
          inputMode="decimal"
          placeholder="0.0"
          value={amount}
          onChange={(e) => {
            const v = e.target.value.replace(',', '.')
            if (v === '' || /^\d*\.?\d*$/.test(v)) setAmount(v)
          }}
          disabled={phase === 'submitting' || phase === 'mining' || phase === 'done'}
          className="min-w-0 flex-1 bg-transparent text-base font-semibold outline-none placeholder:text-muted-fg/60"
        />
        {isBuying && options.length > 1 ? (
          <select
            value={selectedPaymentToken}
            onChange={(e) => setSelectedPaymentToken(e.target.value as Address)}
            className="bg-transparent text-[12.5px] font-semibold text-muted-fg outline-none"
          >
            {options.map((o) => (
              <option key={o.token.address} value={o.token.address}>
                {o.token.symbol}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-[12.5px] font-semibold text-muted-fg">{inputUnit}</span>
        )}
      </label>

      <div className="flex items-center justify-between text-[11.5px] text-muted-fg">
        {userAddress && inputBalance != null ? (
          <span>
            Balance:{' '}
            <span className="font-mono">
              {formatShortAmount(inputBalance)} {inputUnit}
            </span>{' '}
            <button
              type="button"
              onClick={setMax}
              disabled={inputBalance === BigInt(0)}
              className="font-semibold text-accent-strong hover:underline disabled:opacity-40 disabled:no-underline"
            >
              Max
            </button>
          </span>
        ) : (
          <span>
            {isBuying ? 'Spend' : 'Sell'} {inputUnit} for {outputUnit}. Slippage 5%.
          </span>
        )}
        {amountValid && quoteLoading && <span>Quoting…</span>}
        {amountValid && !quoteLoading && amountOut != null && amountOut > BigInt(0) && (
          <span className="font-mono">
            ≈ {formatShortAmount(amountOut)} {outputUnit}
          </span>
        )}
      </div>

      {exceedsBalance && (
        <div className="text-[12px] text-destructive">
          Amount exceeds your {inputUnit} balance.
        </div>
      )}

      {(error || quoteError) && !exceedsBalance && (
        <div className="text-[12px] text-destructive">
          {error ?? parseTradeError(quoteError)}
        </div>
      )}

      {txUrl && (phase === 'mining' || phase === 'done') && (
        <a
          href={txUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11.5px] text-accent-strong hover:underline"
        >
          {phase === 'mining' ? 'View pending tx' : 'View tx'}
          <ExternalLink className="h-3 w-3" />
        </a>
      )}

      {!isConnected ? (
        <Button type="button" variant="primary" size="md" onClick={openConnectModal}>
          Connect wallet
        </Button>
      ) : onWrongChain ? (
        <Button
          type="button"
          variant="primary"
          size="md"
          disabled={isSwitching}
          onClick={() => switchChain({ chainId })}
        >
          {isSwitching ? 'Switching…' : 'Switch network'}
        </Button>
      ) : (
        <Button
          type="button"
          variant="primary"
          size="md"
          disabled={
            !amountValid ||
            exceedsBalance ||
            !path ||
            optionsLoading ||
            quoteLoading ||
            !amountOut ||
            amountOut === BigInt(0) ||
            phase === 'submitting' ||
            phase === 'mining' ||
            phase === 'done' ||
            isExecuting ||
            !walletClient
          }
          onClick={handleTrade}
        >
          {phase === 'submitting'
            ? 'Confirm in wallet…'
            : phase === 'mining'
              ? 'Mining…'
              : phase === 'done'
                ? 'Posted ✓'
                : isBuying
                  ? `Buy ${coinSymbol ? `$${coinSymbol}` : 'token'}`
                  : `Sell ${coinSymbol ? `$${coinSymbol}` : 'token'}`}
        </Button>
      )}
    </div>
  )
}

function TabButton({
  active,
  disabled,
  children,
  onClick,
}: {
  active: boolean
  disabled?: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        'h-7 rounded-[5px] px-3 font-semibold transition-colors ' +
        (active
          ? 'bg-accent text-accent-fg'
          : 'text-muted-fg hover:text-fg disabled:opacity-40 disabled:hover:text-muted-fg')
      }
    >
      {children}
    </button>
  )
}

function formatShortAmount(value: bigint): string {
  const n = Number(formatEther(value))
  if (!Number.isFinite(n)) return value.toString()
  if (n === 0) return '0'
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
  if (n >= 1) return n.toLocaleString('en-US', { maximumSignificantDigits: 4 })
  return n.toLocaleString('en-US', { maximumSignificantDigits: 4 })
}

function parseTradeError(err: unknown): string | null {
  if (!err) return null
  const msg = err instanceof Error ? err.message : String(err)
  if (/User rejected|user rejected/i.test(msg)) return 'Transaction rejected.'
  if (/insufficient funds/i.test(msg)) return 'Insufficient funds for gas.'
  if (/InsufficientLiquidity|no.*liquidity/i.test(msg))
    return 'Pool has insufficient liquidity for this amount.'
  return msg.split('\n')[0]
}
