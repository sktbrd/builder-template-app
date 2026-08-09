type Props = {
  style: 'stripes' | 'tv' | 'leaf'
  color: string
  size?: number
}

export function DaoLogo({ style, color, size = 28 }: Props) {
  if (style === 'tv') {
    return (
      <div
        className="relative flex items-center justify-center"
        style={{
          width: size,
          height: size,
          borderRadius: 6,
          background: 'linear-gradient(135deg, #8a5a2b 0%, #5e3a1a 100%)',
          border: '1.5px solid #2a1a08',
        }}
      >
        <div
          style={{
            width: size * 0.6,
            height: size * 0.45,
            background: color,
            borderRadius: 2,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: -6,
            left: size * 0.3,
            width: 1.5,
            height: 8,
            background: '#2a1a08',
            transform: 'rotate(-20deg)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: -6,
            right: size * 0.3,
            width: 1.5,
            height: 8,
            background: '#2a1a08',
            transform: 'rotate(20deg)',
          }}
        />
      </div>
    )
  }
  if (style === 'leaf') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M12 2C7 6 4 10 4 14c0 4 3.5 7 8 7s8-3 8-7c0-4-3-8-8-12z" fill={color} />
        <path
          d="M12 6c-2 2-4 5-4 8"
          stroke="#fff"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.5"
        />
      </svg>
    )
  }
  return (
    <div
      className="flex items-center justify-center gap-[2px]"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: '#fff',
        border: `2px solid ${color}`,
      }}
    >
      <div
        style={{ width: 3, height: size * 0.55, background: color, borderRadius: 1 }}
      />
      <div
        style={{ width: 3, height: size * 0.55, background: color, borderRadius: 1 }}
      />
      <div
        style={{ width: 3, height: size * 0.55, background: color, borderRadius: 1 }}
      />
    </div>
  )
}
