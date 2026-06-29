import { type CHAIN_ID } from '@buildeross/types'
import { getProvider } from '@buildeross/utils/provider'
import { type Address, getAddress, type Hex, isAddress, type PublicClient } from 'viem'

/**
 * Resolve the implementation behind a proxy contract so we can fetch the ABI
 * that actually carries the business methods. Ported from nouns-builder's
 * `implementationService`, with its Redis cache swapped for a process-local
 * Map (implementations are effectively immutable per address, and a warm
 * serverless instance keeps the Map between requests).
 *
 * This matters here because Builder DAO contracts (token / auction / governor /
 * treasury / metadata) are all UUPS proxies — decoding a governance call that
 * targets one of them requires the implementation ABI, not the proxy's.
 */

// Common read-only accessors used by proxies.
const IMPLEMENTATION_SELECTORS: Record<string, Hex> = {
  implementation: '0x5c60da1b',
  getImplementation: '0x7915cf02',
  proxyImplementation: '0x52d1902d',
  logic: '0x4c4ee1e1',
  masterCopy: '0xa619486e',
}

const BEACON_SLOT: Hex =
  '0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50' // EIP-1967 beacon slot

const IMPLEMENTATION_SLOTS: Hex[] = [
  '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc', // EIP-1967 implementation slot
  '0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3', // keccak256("org.zeppelinos.proxy.implementation")
]

const EIP1167_PATTERNS = [
  { prefix: '363d3d373d3d3d363d73', suffix: '5af43d82803e903d91602b57fd5bf3' },
  { prefix: '3d602d80600a3d3981f3', suffix: '5af43d82803e903d91602b57fd5bf3' },
]

const isDataValid = (data?: Hex | null): data is Hex => !!data && /^0x(?!0*$)/i.test(data)

const extractAddress = (raw: Hex | undefined): Address | null => {
  if (!isDataValid(raw)) return null
  const normalized = raw.slice(2)
  if (normalized.length < 40) return null
  const addr = `0x${normalized.slice(-40)}` as Address
  if (isAddress(addr)) return getAddress(addr)
  return null
}

const readImplementationViaImplementationSlots = async (
  provider: PublicClient,
  address: Address
): Promise<Address | null> => {
  for (const slot of IMPLEMENTATION_SLOTS) {
    try {
      const raw = await provider.getStorageAt({ address, slot })
      const candidate = extractAddress(raw)
      if (candidate) return candidate
    } catch (err) {
      console.warn(`Slot read failed for ${slot}:`, err)
    }
  }
  return null
}

const readImplementationViaBeaconSlot = async (
  provider: PublicClient,
  address: Address
): Promise<Address | null> => {
  try {
    const raw = await provider.getStorageAt({ address, slot: BEACON_SLOT })
    const candidate = extractAddress(raw)
    if (candidate) {
      const { data: res } = await provider.call({
        to: candidate,
        data: IMPLEMENTATION_SELECTORS.implementation,
        gas: BigInt(100_000),
      })
      const impl = extractAddress(res)
      if (impl) return impl
    }
  } catch (err) {
    console.warn(`Beacon slot read failed:`, err)
  }
  return null
}

const readImplementationViaDirectCalls = async (
  provider: PublicClient,
  address: Address
): Promise<Address | null> => {
  for (const [name, selector] of Object.entries(IMPLEMENTATION_SELECTORS)) {
    try {
      const { data: res } = await provider.call({
        to: address,
        data: selector,
        gas: BigInt(100_000),
      })
      const impl = extractAddress(res)
      if (impl) return impl
    } catch (err) {
      console.warn(`Implementation call failed for ${name}:`, err)
    }
  }
  return null
}

const readImplementationViaCode = async (
  provider: PublicClient,
  address: Address
): Promise<Address | null> => {
  try {
    const code = await provider.getCode({ address })
    if (!isDataValid(code)) return null
    const body = code.slice(2)

    // Strict EIP-1167 minimal proxy detection (exact length match).
    if (body.length > 200) return null

    for (const { prefix, suffix } of EIP1167_PATTERNS) {
      const expectedLength = prefix.length + 40 + suffix.length
      if (body.length !== expectedLength) continue
      if (!body.startsWith(prefix)) continue
      if (!body.endsWith(suffix)) continue

      const implHex = `0x${body.slice(prefix.length, prefix.length + 40)}`
      if (isAddress(implHex)) return getAddress(implHex)
    }
  } catch (err) {
    console.warn('Code fetch failed:', err)
  }
  return null
}

const READ_IMPLEMENTATION_METHODS = [
  readImplementationViaImplementationSlots,
  readImplementationViaBeaconSlot,
  readImplementationViaDirectCalls,
  readImplementationViaCode,
] as const

// Process-local cache: address → resolved implementation (or self), with expiry.
type CacheEntry = { value: Address; expires: number }
const implCache = new Map<string, CacheEntry>()
const ONE_DAY_MS = 24 * 60 * 60 * 1000
const ONE_HOUR_MS = 60 * 60 * 1000

export async function getImplementationAddress(
  chainId: number,
  addressInput: Address
): Promise<Address> {
  const address = getAddress(addressInput)
  const cacheKey = `${chainId}:${address}`

  const cached = implCache.get(cacheKey)
  if (cached && cached.expires > nowMs()) return cached.value

  const provider = getProvider(chainId as CHAIN_ID)
  let implementation: Address | null = null

  for (const method of READ_IMPLEMENTATION_METHODS) {
    implementation = await method(provider, address)
    if (implementation) break
  }

  // Cache resolved impls for a day; cache "no proxy" for an hour (cheaper to
  // recheck in case the contract is later upgraded behind a proxy).
  const finalAddress = getAddress(implementation || address)
  implCache.set(cacheKey, {
    value: finalAddress,
    expires: nowMs() + (implementation ? ONE_DAY_MS : ONE_HOUR_MS),
  })
  return finalAddress
}

// Isolated so tests can mock it without Date.now nondeterminism leaking in.
function nowMs(): number {
  return Date.now()
}
