import { type Abi, encodeFunctionData } from 'viem'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { decodeTransaction, formatArgValue, NotFoundError } from '@/lib/abi-decode'

// Avoid any RPC: the proxy-implementation fallback just echoes the address.
vi.mock('@/lib/proxy-implementation', () => ({
  getImplementationAddress: vi.fn(async (_chainId: number, addr: string) => addr),
}))

const ERC20_ABI = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const satisfies Abi

describe('formatArgValue', () => {
  it('stringifies a base bigint', () => {
    expect(formatArgValue({ type: 'uint256' }, BigInt(123))).toBe('123')
  })

  it('stringifies an array of base types', () => {
    expect(formatArgValue({ type: 'uint256[]' }, [BigInt(1), BigInt(2)])).toEqual([
      '1',
      '2',
    ])
  })

  it('maps a tuple by component name', () => {
    const input = {
      type: 'tuple',
      components: [
        { name: 'a', type: 'uint256' },
        { name: 'b', type: 'address' },
      ],
    }
    expect(formatArgValue(input, [BigInt(5), '0xabc'])).toEqual({ a: '5', b: '0xabc' })
  })
})

describe('decodeTransaction', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('decodes a function present in the contract ABI (no proxy round-trip)', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ status: '1', result: JSON.stringify(ERC20_ABI) }),
    })

    const calldata = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: ['0x1111111111111111111111111111111111111111', BigInt(1000)],
    })

    const decoded = await decodeTransaction(
      8453,
      '0x2222222222222222222222222222222222222222',
      calldata
    )

    expect(decoded.functionName).toBe('transfer')
    expect(decoded.functionSig).toBe('0xa9059cbb')
    expect(decoded.argOrder).toEqual(['to', 'amount'])
    expect(decoded.args.to.value).toBe('0x1111111111111111111111111111111111111111')
    expect(decoded.args.amount.value).toBe('1000')
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('throws NotFoundError when the contract is unverified', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ status: '0', result: 'Contract source code not verified' }),
    })

    const calldata = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: ['0x1111111111111111111111111111111111111111', BigInt(1)],
    })

    await expect(
      decodeTransaction(8453, '0x3333333333333333333333333333333333333333', calldata)
    ).rejects.toBeInstanceOf(NotFoundError)
  })
})
