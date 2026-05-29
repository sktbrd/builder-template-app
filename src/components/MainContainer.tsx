/**
 * Wraps page content on the standard 1180px column — every route, including the
 * dashboard. The dashboard's auction carousel breaks out to full-bleed width on
 * its own (see AuctionHistoryStrip); everything else stays on the column.
 */
export function MainContainer({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 pb-20 sm:px-6">
      {children}
    </main>
  )
}
