#!/usr/bin/env npx tsx
/* eslint-disable no-console */

/**
 * Labrat helper: flip the local environment to a different Builder DAO without
 * hand-editing .env.local. Updates env vars + theme overrides + regenerates
 * src/config/dao.{json,ts} via the existing fetchDaoAddresses script.
 *
 * Usage:
 *   pnpm switch-dao <preset>
 *
 * Preset list lives in src/lib/presets.ts (shared with the dev Tweaks panel).
 * After switching, restart `pnpm dev` for the new DAO to take effect.
 */

import { spawnSync } from 'child_process'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

import { SWITCHABLE_PRESETS } from '../src/lib/presets'

function parseArgs() {
  const args = process.argv.slice(2)
  const presetKey = args[0]
  if (!presetKey || presetKey === '--help' || presetKey === '-h') {
    console.log('Usage: pnpm switch-dao <preset>')
    console.log('')
    console.log('Switchable presets:')
    for (const p of Object.values(SWITCHABLE_PRESETS)) {
      console.log(
        `  ${p.key.padEnd(10)} — ${p.label} (chain ${p.chain.id}, ${p.tokenAddress})`
      )
    }
    process.exit(presetKey ? 0 : 1)
  }
  const preset = SWITCHABLE_PRESETS[presetKey]
  if (!preset) {
    console.error(`❌ Unknown or non-switchable preset: ${presetKey}`)
    console.error(
      `   Available: ${Object.keys(SWITCHABLE_PRESETS).join(', ')}`
    )
    process.exit(1)
  }
  return preset
}

/**
 * Update .env.local in place. Preserves any keys we don't manage and
 * overwrites the DAO-targeting ones. Creates the file if missing.
 */
function updateEnv(preset: ReturnType<typeof parseArgs>) {
  const envPath = join(process.cwd(), '.env.local')
  const sample = join(process.cwd(), 'sample.env')
  const seed = existsSync(envPath)
    ? readFileSync(envPath, 'utf8')
    : existsSync(sample)
      ? readFileSync(sample, 'utf8')
      : ''

  const overrides: Record<string, string> = {
    NEXT_PUBLIC_NETWORK_TYPE: `"${preset.chain.networkType}"`,
    NEXT_PUBLIC_CHAIN_ID: `"${preset.chain.id}"`,
    NEXT_PUBLIC_DAO_TOKEN_ADDRESS: `"${preset.tokenAddress}"`,
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

function writeThemeOverrides(preset: ReturnType<typeof parseArgs>) {
  const path = join(process.cwd(), 'src/config/dao.theme.json')
  writeFileSync(
    path,
    JSON.stringify(
      {
        tagline: preset.tagline,
        accent: preset.theme.accent,
        radius: preset.theme.radius,
        displayFont: preset.theme.displayFont,
      },
      null,
      2
    )
  )
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
  const preset = parseArgs()
  console.log(`🔁 Switching template to ${preset.label} (preset: ${preset.key})`)
  updateEnv(preset)
  writeThemeOverrides(preset)
  runFetchDao()
  console.log('')
  console.log('🎉 Switched. Restart `pnpm dev` for the new DAO to take effect.')
}

main()
