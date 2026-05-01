/**
 * Shared types used across components and the data layer.
 */

/** The 5-state palette the UI cards use to style proposals. */
export type ProposalStatus =
  | 'active'
  | 'pending'
  | 'executed'
  | 'defeated'
  | 'cancelled'
