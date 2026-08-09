/**
 * Zora ERC721Drop (the contract a droposal deploys via createEdition) — read +
 * mint surface. Pure viem `as const` ABI, no thirdweb. Ported from the Gnars
 * site's zoraNftMintAbi but trimmed to the functions the in-app mint widget and
 * detail page actually use.
 *
 * Mint value math (mintWithRewards / purchase): the contract charges
 * `publicSalePrice * quantity` PLUS the Zora protocol reward of 0.000777 ETH
 * per token. `mintReferral` routes the referral share — we set it to the DAO
 * treasury so the DAO benefits from third-party mints.
 */

/** Zora protocol reward fee per minted token, in ETH. */
export const ZORA_PROTOCOL_REWARD = 0.000777

export const zoraDropAbi = [
  // Modern mint with rewards — preferred entry point.
  {
    type: 'function',
    name: 'mintWithRewards',
    stateMutability: 'payable',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'quantity', type: 'uint256' },
      { name: 'comment', type: 'string' },
      { name: 'mintReferral', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // Legacy purchase — value = publicSalePrice * quantity + protocol reward.
  {
    type: 'function',
    name: 'purchase',
    stateMutability: 'payable',
    inputs: [{ name: 'quantity', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // Legacy purchase with on-chain comment.
  {
    type: 'function',
    name: 'purchaseWithComment',
    stateMutability: 'payable',
    inputs: [
      { name: 'quantity', type: 'uint256' },
      { name: 'comment', type: 'string' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // Sale state + supply, for the mint widget's live status.
  {
    type: 'function',
    name: 'saleDetails',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        name: 'saleDetails',
        type: 'tuple',
        components: [
          { name: 'publicSaleActive', type: 'bool' },
          { name: 'presaleActive', type: 'bool' },
          { name: 'publicSalePrice', type: 'uint256' },
          { name: 'publicSaleStart', type: 'uint64' },
          { name: 'publicSaleEnd', type: 'uint64' },
          { name: 'presaleStart', type: 'uint64' },
          { name: 'presaleEnd', type: 'uint64' },
          { name: 'presaleMerkleRoot', type: 'bytes32' },
          { name: 'maxSalePurchasePerAddress', type: 'uint256' },
          { name: 'totalMinted', type: 'uint256' },
          { name: 'maxSupply', type: 'uint256' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'totalSupply',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: 'supply', type: 'uint256' }],
  },
] as const
