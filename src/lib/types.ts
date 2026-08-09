/**
 * Shared types used across components and the data layer.
 */

/**
 * Mirrors the 9-state Governor enum used by Builder DAOs.
 * Order matches the on-chain enum (Pending=0 … Vetoed=8).
 */
export type ProposalStatus =
  | 'pending'
  | 'active'
  | 'cancelled'
  | 'defeated'
  | 'succeeded'
  | 'queued'
  | 'expired'
  | 'executed'
  | 'vetoed'
