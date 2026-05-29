#!/usr/bin/env bash
#
# drive-proposal.sh — drive a Builder DAO proposal through any governance state
# on a local Anvil fork, by impersonating real holders and warping time.
#
# Prereqs: anvil running as a Base fork (see sandbox/README.md), foundry (cast).
# All writes use `--unlocked` against impersonated accounts — no private keys.
#
# Usage:
#   ./drive-proposal.sh <state>
#     state ∈ pending | active | defeated | succeeded | queued |
#             executed | expired | canceled | vetoed
#
# Configure the DAO + actors below (defaults = HackerDAO on Base).
set -euo pipefail

RPC="${RPC:-http://127.0.0.1:8545}"

# --- DAO under test (HackerDAO on Base — see BUILDER_REFERENCE.md) -------------
GOVERNOR="${GOVERNOR:-0x7c4c33efe412f06f83278acafc16b435be904b03}"
TREASURY="${TREASURY:-0x7c27601741cbc96b66766d499c15b688abeefcca}"

# --- Actors (MUST be real delegates on the forked DAO) -------------------------
# PROPOSER needs getVotes > proposalThreshold. VOTERS_FOR / VOTERS_AGAINST are
# space-separated holder addresses. Discover delegates with:
#   cast call $GOVERNOR "proposalThreshold()(uint256)"
#   cast call <TOKEN> "getVotes(address)(uint256)" <candidate>
PROPOSER="${PROPOSER:-0x0000000000000000000000000000000000000000}"
VOTERS_FOR="${VOTERS_FOR:-}"
VOTERS_AGAINST="${VOTERS_AGAINST:-}"

# --- Proposal payload: a no-op (0 ETH, empty calldata, to a burn address) ------
TARGET="0x000000000000000000000000000000000000dEaD"
VALUE="0"
CALLDATA="0x"
DESC="sandbox: drive to ${1:-?} @ $(date -u +%FT%TZ)"

# ------------------------------------------------------------------------------
STATE_NAMES=(Pending Active Canceled Defeated Succeeded Queued Expired Executed Vetoed)
say() { printf '\033[1;36m▸ %s\033[0m\n' "$*"; }
die() { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

c()  { cast "$@" --rpc-url "$RPC"; }                 # read
imp() { cast rpc --rpc-url "$RPC" anvil_impersonateAccount "$1" >/dev/null
        cast rpc --rpc-url "$RPC" anvil_setBalance "$1" 0xDE0B6B3A7640000 >/dev/null; }
send_as() { local from="$1"; shift; cast send "$@" --from "$from" --unlocked --rpc-url "$RPC" >/dev/null; }
warp() { say "warp +$1s"; cast rpc --rpc-url "$RPC" evm_increaseTime "$1" >/dev/null; cast rpc --rpc-url "$RPC" evm_mine >/dev/null; }

now()    { c block latest --field timestamp; }
state()  { c call "$GOVERNOR" "state(bytes32)(uint8)" "$1"; }
show()   { local s; s=$(state "$1"); say "state = $s (${STATE_NAMES[$s]})"; }

[ $# -eq 1 ] || die "usage: $0 <pending|active|defeated|succeeded|queued|executed|expired|canceled|vetoed>"
TARGET_STATE="$1"
[ "$PROPOSER" != "0x0000000000000000000000000000000000000000" ] || die "set PROPOSER to a real delegate (see header)"

DESC_HASH=$(cast keccak "$DESC")
PROPOSAL_ID=$(c call "$GOVERNOR" \
  "hashProposal(address[],uint256[],bytes[],bytes32,address)(bytes32)" \
  "[$TARGET]" "[$VALUE]" "[$CALLDATA]" "$DESC_HASH" "$PROPOSER")

# --- preflight ---------------------------------------------------------------
THRESH=$(c call "$GOVERNOR" "proposalThreshold()(uint256)")
QUORUM=$(c call "$GOVERNOR" "quorum()(uint256)")
say "proposalId   = $PROPOSAL_ID"
say "threshold=$THRESH  quorum=$QUORUM"

# === 1. PROPOSE (→ Pending) ==================================================
say "propose() as $PROPOSER"
imp "$PROPOSER"
send_as "$PROPOSER" "$GOVERNOR" \
  "propose(address[],uint256[],bytes[],string)" \
  "[$TARGET]" "[$VALUE]" "[$CALLDATA]" "$DESC"
show "$PROPOSAL_ID"
[ "$TARGET_STATE" = pending ] && { say "done."; exit 0; }

# === canceled: proposer cancels while Pending ================================
if [ "$TARGET_STATE" = canceled ]; then
  say "cancel() as proposer"
  send_as "$PROPOSER" "$GOVERNOR" "cancel(bytes32)" "$PROPOSAL_ID"
  show "$PROPOSAL_ID"; exit 0
fi

# === 2. open voting (→ Active) ===============================================
DELAY=$(c call "$GOVERNOR" "votingDelay()(uint256)")
warp "$((DELAY + 1))"
show "$PROPOSAL_ID"
[ "$TARGET_STATE" = active ] && { say "done."; exit 0; }

# === vetoed: vetoer kills it mid-flight ======================================
if [ "$TARGET_STATE" = vetoed ]; then
  VETOER=$(c call "$GOVERNOR" "vetoer()(address)")
  say "veto() as $VETOER"
  imp "$VETOER"
  send_as "$VETOER" "$GOVERNOR" "veto(bytes32)" "$PROPOSAL_ID"
  show "$PROPOSAL_ID"; exit 0
fi

# === 3. cast votes ===========================================================
cast_votes() { # $1 = support (0/1/2), rest = addrs
  local support="$1"; shift
  for v in "$@"; do
    [ -z "$v" ] && continue
    say "castVote($support) as $v"
    imp "$v"
    send_as "$v" "$GOVERNOR" "castVote(bytes32,uint256)" "$PROPOSAL_ID" "$support"
  done
}
if [ "$TARGET_STATE" = defeated ]; then
  cast_votes 0 $VOTERS_AGAINST   # Against (or simply cast none → no quorum)
else
  cast_votes 1 $VOTERS_FOR       # For
  cast_votes 0 $VOTERS_AGAINST
fi

# === 4. close voting (→ Defeated / Succeeded) ================================
PERIOD=$(c call "$GOVERNOR" "votingPeriod()(uint256)")
warp "$((PERIOD + 1))"
show "$PROPOSAL_ID"
case "$TARGET_STATE" in defeated|succeeded) say "done."; exit 0;; esac

# === 5. queue (→ Queued) =====================================================
say "queue()"
imp "$PROPOSER"
send_as "$PROPOSER" "$GOVERNOR" "queue(bytes32)" "$PROPOSAL_ID"
show "$PROPOSAL_ID"
[ "$TARGET_STATE" = queued ] && { say "done."; exit 0; }

# === 6a. expired: warp past timelock delay + grace (2 weeks) =================
TL_DELAY=$(c call "$TREASURY" "delay()(uint256)")
if [ "$TARGET_STATE" = expired ]; then
  warp "$((TL_DELAY + 1209600 + 1))"   # delay + 2-week grace + 1
  show "$PROPOSAL_ID"; say "done."; exit 0
fi

# === 6b. executed: warp past timelock delay, then execute ====================
warp "$((TL_DELAY + 1))"
say "execute()"
send_as "$PROPOSER" "$GOVERNOR" \
  "execute(address[],uint256[],bytes[],bytes32,address)" \
  "[$TARGET]" "[$VALUE]" "[$CALLDATA]" "$DESC_HASH" "$PROPOSER"
show "$PROPOSAL_ID"
say "done."
