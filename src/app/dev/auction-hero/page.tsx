'use client'

import { AuctionHero } from '@/components/dao/AuctionHero'
import { fallbackArtPalette } from '@/lib/dao.config'

const SAMPLE_IMAGE =
  'https://nouns.build/api/renderer/stack-images?contractAddress=0xaf2273eb279a37654a22ebf4c6bfec3366e9e3a3&tokenId=56&images=ipfs%3a%2f%2fbafybeihcsfjvnjmzivm4gxgt75zwajtfxumyxd7j6ibvloykpg4sx47uca%2f0-backgrounds%2fbg-cool.png&images=ipfs%3a%2f%2fbafybeihcsfjvnjmzivm4gxgt75zwajtfxumyxd7j6ibvloykpg4sx47uca%2f2-accessories%2faccessory-txt-ico.png&images=ipfs%3a%2f%2fbafybeihcsfjvnjmzivm4gxgt75zwajtfxumyxd7j6ibvloykpg4sx47uca%2f3-heads%2fhead-goldcoin.png&images=ipfs%3a%2f%2fbafybeihcsfjvnjmzivm4gxgt75zwajtfxumyxd7j6ibvloykpg4sx47uca%2f1-bodies%2fbody-rust.png&images=ipfs%3a%2f%2fbafybeihcsfjvnjmzivm4gxgt75zwajtfxumyxd7j6ibvloykpg4sx47uca%2f4-glasses%2fglasses-square-teal.png'

const palette = fallbackArtPalette()
const tokenLabel = 'HackerTestDAO'

const now = Math.floor(Date.now() / 1000)

const states: {
  title: string
  description: string
  props: Parameters<typeof AuctionHero>[0]
}[] = [
  {
    title: 'No active auction',
    description: 'auction = null — empty state',
    props: { auction: null, palette, tokenLabel },
  },
  {
    title: 'Live — plenty of time',
    description: 'endTimeUnix > 1h, has top bid + bidder',
    props: {
      auction: {
        tokenId: 56,
        name: 'HackerTestDAO #56',
        image: SAMPLE_IMAGE,
        endTimeUnix: now + 60 * 60 * 12,
        topBidEth: '0.42',
        bidderShort: '0x3a21…5ead',
      },
      palette,
      tokenLabel,
    },
  },
  {
    title: 'Live — urgent (<1h)',
    description: 'countdown turns warning color',
    props: {
      auction: {
        tokenId: 57,
        name: 'HackerTestDAO #57',
        image: SAMPLE_IMAGE,
        endTimeUnix: now + 60 * 45,
        topBidEth: '0.085',
        bidderShort: '0x9f12…ab44',
      },
      palette,
      tokenLabel,
    },
  },
  {
    title: 'Live — critical (<5min)',
    description: 'countdown turns destructive color',
    props: {
      auction: {
        tokenId: 58,
        name: 'HackerTestDAO #58',
        image: SAMPLE_IMAGE,
        endTimeUnix: now + 90,
        topBidEth: '1.337',
        bidderShort: '0xbeef…cafe',
      },
      palette,
      tokenLabel,
    },
  },
  {
    title: 'Live — no bids yet',
    description: 'topBidEth = null, bidderShort = null',
    props: {
      auction: {
        tokenId: 59,
        name: 'HackerTestDAO #59',
        image: SAMPLE_IMAGE,
        endTimeUnix: now + 60 * 60 * 6,
        topBidEth: null,
        bidderShort: null,
      },
      palette,
      tokenLabel,
    },
  },
  {
    title: 'Ended — awaiting settlement (with bid)',
    description: 'endTimeUnix in the past, has bidder → settle CTA',
    props: {
      auction: {
        tokenId: 60,
        name: 'HackerTestDAO #60',
        image: SAMPLE_IMAGE,
        endTimeUnix: now - 60 * 30,
        topBidEth: '0.0001',
        bidderShort: '0x3a21…5ead',
      },
      palette,
      tokenLabel,
    },
  },
  {
    title: 'Ended — no bids',
    description: 'ended with topBidEth = null',
    props: {
      auction: {
        tokenId: 61,
        name: 'HackerTestDAO #61',
        image: SAMPLE_IMAGE,
        endTimeUnix: now - 60 * 5,
        topBidEth: null,
        bidderShort: null,
      },
      palette,
      tokenLabel,
    },
  },
  {
    title: 'Live — fallback art (no image)',
    description: 'image = null → AuctionArt SVG fallback',
    props: {
      auction: {
        tokenId: 62,
        name: 'HackerTestDAO #62',
        image: null,
        endTimeUnix: now + 60 * 60 * 3,
        topBidEth: '0.21',
        bidderShort: '0xfeed…1234',
      },
      palette,
      tokenLabel,
    },
  },
  {
    title: 'Live — long token name',
    description: 'stress-test heading wrap',
    props: {
      auction: {
        tokenId: 63,
        name: 'HackerTestDAO #63 — A Very Long Token Name For Layout Testing',
        image: SAMPLE_IMAGE,
        endTimeUnix: now + 60 * 60 * 2,
        topBidEth: '12.500001',
        bidderShort: '0xdead…0001',
      },
      palette,
      tokenLabel,
    },
  },
]

export default function AuctionHeroStatesPage() {
  return (
    <div className="flex flex-col gap-10 py-6">
      <header className="border-b border-border pb-4">
        <h1 className="font-display text-3xl font-extrabold text-fg">
          AuctionHero — all states
        </h1>
        <p className="mt-1 text-sm text-muted-fg">
          Visual matrix of every render path. Countdowns run live from page load.
        </p>
      </header>

      {states.map((s) => (
        <section key={s.title} className="flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-bold text-fg">{s.title}</h2>
            <p className="text-sm text-muted-fg">{s.description}</p>
          </div>
          <AuctionHero {...s.props} />
        </section>
      ))}
    </div>
  )
}
