type Props = {
  value: React.ReactNode
  label: string
}

export function KpiCard({ value, label }: Props) {
  return (
    <div className="rounded-md border border-border bg-surface px-5 py-[18px]">
      <div className="font-display text-[26px] font-bold leading-none tracking-tight text-fg">
        {value}
      </div>
      <div className="mt-1.5 text-[12.5px] text-muted-fg">{label}</div>
    </div>
  )
}
