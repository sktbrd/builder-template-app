import { notFound } from 'next/navigation'

import { daoConfig } from '@/lib/dao.config'

/**
 * Render a 404 when the optional Coins / Content feature is disabled in
 * `daoConfig`. Call as the first statement of every coins/droposals route so a
 * DAO that opts out of `features.coins` doesn't ship reachable, deep-linkable
 * coin-creation or droposal-mint surfaces. Mirrors the Header, which only
 * surfaces these links when the flag is on.
 */
export function assertCoinsEnabled(): void {
  if (!daoConfig.features.coins) notFound()
}
