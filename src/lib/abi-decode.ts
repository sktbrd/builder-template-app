import type { DecodedArg, DecodedTransactionData, DecodedValue } from '@buildeross/types'
import {
  type Abi,
  type AbiFunction,
  type Address,
  decodeFunctionData,
  type DecodeFunctionDataReturnType,
  getAbiItem,
  getAddress,
  type Hex,
  toFunctionSelector,
} from 'viem'

import { getImplementationAddress } from '@/lib/proxy-implementation'

/**
 * Server-side ABI-based transaction decoder. Ported from nouns-builder's
 * `abiService`, adapted for this template: `fetch` instead of axios, a
 * process-local Map instead of Redis, and the single Etherscan v2 multichain
 * endpoint (one key, `chainid` param). This is the generic fallback for
 * proposal transactions whose selector the offline `proposal-tx-decoder`
 * doesn't recognize — it fetches the target contract's verified ABI and
 * decodes the function + args.
 */

export class InvalidRequestError extends Error {}
export class NotFoundError extends Error {}
export class BackendFailedError extends Error {}

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY ?? ''
const ETHERSCAN_API_KEY_PARAM = ETHERSCAN_API_KEY ? `&apikey=${ETHERSCAN_API_KEY}` : ''

// Process-local ABI cache: `${chainId}:${address}` → ABI JSON string. ABIs are
// immutable per address, so a long TTL is safe; the Map survives between
// requests on a warm serverless instance.
type AbiCacheEntry = { abi: string; expires: number }
const abiCache = new Map<string, AbiCacheEntry>()
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

type GetContractAbiOptions = { skipImplementationCheck?: boolean }

export async function getContractAbi(
  chainId: number,
  addressInput: string,
  options?: GetContractAbiOptions
): Promise<string> {
  let address: Address
  try {
    address = getAddress(addressInput)
  } catch {
    throw new InvalidRequestError('Invalid address')
  }

  const { skipImplementationCheck = false } = options ?? {}

  const fetchedAddress = skipImplementationCheck
    ? address
    : await getImplementationAddress(chainId, address)

  const cacheKey = `${chainId}:${fetchedAddress}`
  const cached = abiCache.get(cacheKey)
  if (cached && cached.expires > Date.now()) return cached.abi

  const url =
    `https://api.etherscan.io/v2/api?chainid=${chainId}` +
    `&module=contract&action=getabi&address=${fetchedAddress}&tag=latest${ETHERSCAN_API_KEY_PARAM}`

  let res: Response
  try {
    res = await fetch(url)
  } catch {
    throw new BackendFailedError('Remote request failed')
  }
  if (!res.ok) throw new BackendFailedError('Remote request failed')

  const body = (await res.json()) as { status?: string; result?: string }
  if (body.status !== '1' || typeof body.result !== 'string') {
    throw new NotFoundError('ABI not verified')
  }

  abiCache.set(cacheKey, { abi: body.result, expires: Date.now() + THIRTY_DAYS_MS })
  return body.result
}

/**
 * Recursively turn decoded args into JSON-serializable values, preserving tuple
 * shape and stringifying primitives (bigint → string). Mirrors nouns-builder.
 */
export function formatArgValue(input: any, value: any): DecodedValue {
  if (value === undefined || value === null) return value

  // tuple
  if (input.type === 'tuple' && input.components) {
    return input.components.reduce((acc: any, component: any, i: number) => {
      const key = component.name || i
      const val = Array.isArray(value) ? value[i] : value[key]
      acc[key] = formatArgValue(component, val)
      return acc
    }, {})
  }

  // array (dynamic `[]` or fixed `[n]`)
  if (
    (input.type.endsWith('[]') || /\[\d+\]$/.test(input.type)) &&
    Array.isArray(value)
  ) {
    if (input.components) {
      // array of tuples
      return value.map((v: any) =>
        input.components.reduce((acc: any, component: any, i: number) => {
          const key = component.name || i
          const val = Array.isArray(v) ? v[i] : v[key]
          acc[key] = formatArgValue(component, val)
          return acc
        }, {})
      )
    }
    // array of base types
    return value.map((v: any) => v?.toString?.() ?? v)
  }

  // base
  return value?.toString?.() ?? value
}

export async function decodeTransaction(
  chainId: number,
  contract: string,
  calldata: string
): Promise<DecodedTransactionData> {
  let abi: Abi | undefined

  // Fast path: the contract's own verified ABI (no proxy round-trip).
  try {
    const abiJson = await getContractAbi(chainId, contract, {
      skipImplementationCheck: true,
    })
    abi = JSON.parse(abiJson) as Abi
  } catch {
    // fall through to the implementation lookup below
  }

  const functionSelector = calldata.slice(0, 10)

  const abiHasSig = abi?.some(
    (item) => item.type === 'function' && toFunctionSelector(item) === functionSelector
  )

  // If the selector isn't in the direct ABI, the contract is likely a proxy —
  // resolve the implementation and fetch its ABI instead.
  if (!abiHasSig) {
    const implAbiJson = await getContractAbi(chainId, contract, {
      skipImplementationCheck: false,
    })
    abi = JSON.parse(implAbiJson) as Abi
  }

  if (!abi) throw new NotFoundError('ABI not found')

  let decodeResult: DecodeFunctionDataReturnType<Abi>
  try {
    decodeResult = decodeFunctionData({ abi, data: calldata as Hex })
  } catch {
    throw new InvalidRequestError('Invalid calldata')
  }

  const functionInfo = getAbiItem({ abi, name: functionSelector }) as
    | AbiFunction
    | undefined
  if (!functionInfo) throw new NotFoundError('Function not found')

  const argMapping: Record<string, DecodedArg> = functionInfo.inputs.reduce(
    (acc: Record<string, DecodedArg>, input: any, index: number) => {
      const name = input.name || index.toString()
      acc[name] = {
        name,
        type: input.type,
        value: formatArgValue(input, decodeResult.args?.[index]),
      }
      return acc
    },
    {}
  )

  return {
    args: argMapping,
    functionName: decodeResult.functionName,
    functionSig: functionSelector,
    encodedData: calldata,
    argOrder: functionInfo.inputs.map((input, i) => input.name || i.toString()),
  }
}
