#!/usr/bin/env npx tsx
/* eslint-disable no-console */

/**
 * Labrat helper: flip the local environment to a different Builder DAO without
 * hand-editing .env.local. Updates env vars + theme overrides + regenerates
 * src/config/dao.{json,ts} via the existing fetchDaoAddresses script.
 *
 * Usage
 *
 *   pnpm switch-dao <preset>
 *   pnpm switch-dao 0x<token-address> [flags]
 *
 * The first positional arg is either a preset key (defined in
 * src/lib/presets.ts — shared with the dev Tweaks panel) OR a raw
 * 0x-prefixed token address for any Builder DAO.
 *
 * When passing a raw token address, the following flags are accepted:
 *
 *   --chain <id>             chain id (default 8453, Base mainnet)
 *   --network <m|t>          mainnet | testnet (default: mainnet)
 *   --tagline "<text>"       hero subtitle (default: blank → keeps existing)
 *   --accent <#hex>          accent color (default: keep existing)
 *   --radius <px>            corner radius in px (default: keep existing)
 *   --display-font <name>    Geist | "Londrina Solid" | "IBM Plex Sans" | Fraunces
 *
 * After switching, restart `pnpm dev` for the new DAO to take effect.
 */

import { spawnSync } from 'child_process'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

import { SWITCHABLE_PRESETS } from '../src/lib/presets'

type ResolvedTarget = {
  label: string
  chainId: number
  networkType: 'mainnet' | 'testnet'
  tokenAddress: string
  themeOverrides?: {
    tagline?: string
    accent?: string
    radius?: number
    displayFont?: string
  }
}

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

function printHelp() {
  console.log('Usage:')
  console.log('  pnpm switch-dao <preset>')
  console.log('  pnpm switch-dao 0x<token-address> [flags]')
  console.log('')
  console.log('Switchable presets:')
  for (const p of Object.values(SWITCHABLE_PRESETS)) {
    console.log(
      `  ${p.key.padEnd(10)} — ${p.label} (chain ${p.chain.id}, ${p.tokenAddress})`
    )
  }
  console.log('')
  console.log('Flags (raw-address form only):')
  console.log('  --chain <id>             chain id (default 8453, Base)')
  console.log('  --network <mainnet|testnet>')
  console.log('  --tagline "<text>"')
  console.log('  --accent <#hex>')
  console.log('  --radius <px>')
  console.log('  --display-font <name>')
}

function parseFlags(args: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const val = args[i + 1]
      if (val === undefined || val.startsWith('--')) {
        console.error(`❌ Missing value for --${key}`)
        process.exit(1)
      }
      out[key] = val
      i++
    }
  }
  return out
}

function resolveTarget(): ResolvedTarget {
  const args = process.argv.slice(2)
  const first = args[0]

  if (!first || first === '--help' || first === '-h') {
    printHelp()
    process.exit(first ? 0 : 1)
  }

  // Preset path
  if (!ADDRESS_RE.test(first)) {
    const preset = SWITCHABLE_PRESETS[first]
    if (!preset) {
      console.error(`❌ Unknown preset: ${first}`)
      console.error(`   Available presets: ${Object.keys(SWITCHABLE_PRESETS).join(', ')}`)
      console.error(`   Or pass a 0x-prefixed token address directly.`)
      process.exit(1)
    }
    return {
      label: preset.label,
      chainId: preset.chain.id,
      networkType: preset.chain.networkType,
      tokenAddress: preset.tokenAddress,
      themeOverrides: {
        tagline: preset.tagline,
        accent: preset.theme.accent,
        radius: preset.theme.radius,
        displayFont: preset.theme.displayFont,
      },
    }
  }

  // Raw-address path
  const flags = parseFlags(args.slice(1))
  const chainId = parseInt(flags['chain'] ?? '8453', 10)
  if (!Number.isFinite(chainId) || chainId <= 0) {
    console.error(`❌ Invalid --chain: ${flags['chain']}`)
    process.exit(1)
  }
  const networkType = (flags['network'] ?? 'mainnet') as 'mainnet' | 'testnet'
  if (networkType !== 'mainnet' && networkType !== 'testnet') {
    console.error(`❌ --network must be mainnet or testnet`)
    process.exit(1)
  }

  const themeOverrides: ResolvedTarget['themeOverrides'] = {}
  if (flags['tagline']) themeOverrides.tagline = flags['tagline']
  if (flags['accent']) themeOverrides.accent = flags['accent']
  if (flags['radius']) {
    const r = parseInt(flags['radius'], 10)
    if (Number.isFinite(r)) themeOverrides.radius = r
  }
  if (flags['display-font']) themeOverrides.displayFont = flags['display-font']

  return {
    label: `Custom DAO ${first.slice(0, 6)}…${first.slice(-4)}`,
    chainId,
    networkType,
    tokenAddress: first,
    themeOverrides: Object.keys(themeOverrides).length > 0 ? themeOverrides : undefined,
  }
}

/**
 * Update .env.local in place. Preserves any keys we don't manage and
 * overwrites the DAO-targeting ones. Creates the file if missing.
 */
function updateEnv(target: ResolvedTarget) {
  const envPath = join(process.cwd(), '.env.local')
  const sample = join(process.cwd(), 'sample.env')
  const seed = existsSync(envPath)
    ? readFileSync(envPath, 'utf8')
    : existsSync(sample)
      ? readFileSync(sample, 'utf8')
      : ''

  const overrides: Record<string, string> = {
    NEXT_PUBLIC_NETWORK_TYPE: `"${target.networkType}"`,
    NEXT_PUBLIC_CHAIN_ID: `"${target.chainId}"`,
    NEXT_PUBLIC_DAO_TOKEN_ADDRESS: `"${target.tokenAddress}"`,
  }

  const lines = seed.split('\n')
  const seen = new Set<string>()
  const out: string[] = []
  for (const line of lines) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=/)
    if (m && overrides[m[1]] !== undefined) {
      out.push(`${m[1]}=${overrides[m[1]]}`)
      seen.add(m[1])
    } else {
      out.push(line)
    }
  }
  for (const k of Object.keys(overrides)) {
    if (!seen.has(k)) out.push(`${k}=${overrides[k]}`)
  }
  writeFileSync(envPath, out.join('\n'))
  console.log(`✅ .env.local updated`)
}

/**
 * Merge theme overrides into dao.theme.json, preserving any fields the user
 * didn't explicitly set this run. For raw-address switches with no theme flags,
 * we leave the existing theme alone.
 */
function writeThemeOverrides(target: ResolvedTarget) {
  if (!target.themeOverrides) {
    console.log('ℹ️  No theme overrides specified; keeping existing dao.theme.json.')
    return
  }
  const path = join(process.cwd(), 'src/config/dao.theme.json')
  const existing = existsSync(path)
    ? (JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>)
    : {}
  const merged = { ...existing, ...target.themeOverrides }
  writeFileSync(path, JSON.stringify(merged, null, 2) + '\n')
  console.log(`✅ Theme overrides written to ${path}`)
}

function runFetchDao() {
  console.log('')
  console.log('🔄 Running pnpm fetch-dao...')
  console.log('')
  const result = spawnSync('pnpm', ['fetch-dao'], { stdio: 'inherit' })
  if (result.status !== 0) {
    console.error('❌ fetch-dao failed')
    process.exit(result.status ?? 1)
  }
}

function main() {
  const target = resolveTarget()
  console.log(
    `🔁 Switching template to ${target.label} (chain ${target.chainId}, token ${target.tokenAddress})`
  )
  updateEnv(target)
  writeThemeOverrides(target)
  runFetchDao()
  console.log('')
  console.log('🎉 Switched. Restart `pnpm dev` for the new DAO to take effect.')
}

main()
