import {
  encodeAbiParameters,
  getAddress,
  type Hex,
  parseAbiParameters,
  zeroHash,
} from 'viem'

import { daoConfig } from '@/lib/dao.config'

// Matches @buildeross/constants/eas — kept inline so we never drift from the
// canonical schema while only ever importing from one place at the call site.
export const PROPDATE_SCHEMA =
  'bytes32 proposalId, bytes32 originalMessageId, uint8 messageType, string message'

const propdateSchemaParams = parseAbiParameters(PROPDATE_SCHEMA)

export enum PropdateMessageType {
  INLINE_TEXT = 0,
  INLINE_JSON = 1,
  URL_TEXT = 2,
  URL_JSON = 3,
}

export type PropdateAttestationData = {
  schema: Hex
  data: {
    recipient: Hex
    expirationTime: bigint
    revocable: boolean
    refUID: Hex
    data: Hex
    value: bigint
  }
}

export function encodePropdateMessage(
  proposalIdHash: Hex,
  message: string,
  replyToId?: Hex
): Hex {
  const trimmed = message.trim()
  if (!trimmed) throw new Error('Propdate message must not be empty')

  const replyTo = replyToId && replyToId !== zeroHash ? replyToId : zeroHash

  return encodeAbiParameters(propdateSchemaParams, [
    proposalIdHash,
    replyTo,
    PropdateMessageType.INLINE_TEXT,
    trimmed,
  ])
}

export function buildPropdateAttestation(
  schemaUid: Hex,
  proposalIdHash: Hex,
  message: string,
  replyToId?: Hex
): PropdateAttestationData {
  return {
    schema: schemaUid,
    data: {
      recipient: getAddress(daoConfig.addresses.token),
      expirationTime: BigInt(0),
      revocable: true,
      refUID: zeroHash,
      data: encodePropdateMessage(proposalIdHash, message, replyToId),
      value: BigInt(0),
    },
  }
}
