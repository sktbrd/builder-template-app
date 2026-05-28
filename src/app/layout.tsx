import './globals.css'

import type { Metadata } from 'next'
import {
  Fraunces,
  Geist,
  Geist_Mono,
  IBM_Plex_Sans,
  Londrina_Solid,
} from 'next/font/google'

import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { MainContainer } from '@/components/MainContainer'
import { TweaksPanel } from '@/components/TweaksPanel'
import { daoConfig } from '@/lib/dao.config'

import { Providers } from './providers'

const geistSans = Geist({
  variable: '--font-geist',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

const londrina = Londrina_Solid({
  variable: '--font-londrina',
  weight: ['400', '900'],
  subsets: ['latin'],
})

const ibmPlex = IBM_Plex_Sans({
  variable: '--font-ibm-plex',
  weight: ['400', '600', '700'],
  subsets: ['latin'],
})

const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin'],
})

const DISPLAY_FONT_VAR: Record<string, string> = {
  Geist: 'var(--font-geist)',
  'Londrina Solid': 'var(--font-londrina)',
  'IBM Plex Sans': 'var(--font-ibm-plex)',
  Fraunces: 'var(--font-fraunces)',
}

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.VERCEL_PROJECT_PRODUCTION_URL ||
  process.env.VERCEL_URL ||
  'http://localhost:3000'
const metadataBase = new URL(siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`)

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: daoConfig.name,
    template: `%s | ${daoConfig.name}`,
  },
  description: daoConfig.tagline,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const { accent, radius, displayFont } = daoConfig.theme
  const resolvedFont = DISPLAY_FONT_VAR[displayFont]
  if (!resolvedFont) {
    console.warn(
      `[layout] Unknown displayFont "${displayFont}" in dao.config — falling back to Geist. ` +
        `Valid options: ${Object.keys(DISPLAY_FONT_VAR).join(', ')}`
    )
  }
  const rootStyle: React.CSSProperties & Record<string, string> = {
    '--accent': accent,
    '--accent-strong': `color-mix(in oklab, ${accent} 80%, black)`,
    '--radius': `${radius}px`,
    '--font-display-active': resolvedFont ?? 'var(--font-geist)',
  }

  return (
    <html lang="en" suppressHydrationWarning style={rootStyle}>
      <body
        className={[
          geistSans.variable,
          geistMono.variable,
          londrina.variable,
          ibmPlex.variable,
          fraunces.variable,
          'antialiased',
        ].join(' ')}
      >
        <Providers>
          <div className="flex min-h-screen flex-col">
            <Header />
            <MainContainer>{children}</MainContainer>
            <Footer />
          </div>
          {process.env.NODE_ENV !== 'production' && <TweaksPanel />}
        </Providers>
      </body>
    </html>
  )
}
