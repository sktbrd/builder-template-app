import { ImageResponse } from 'next/og'

import { daoConfig } from '@/lib/dao.config'
import { resolveIpfs } from '@/lib/utils'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'
export const revalidate = 86400

export default async function Icon() {
  const src = resolveIpfs(daoConfig.image)

  try {
    const res = await fetch(src)
    const buf = await res.arrayBuffer()
    const mime = res.headers.get('content-type') || 'image/png'
    const b64 = Buffer.from(buf).toString('base64')
    const dataUrl = `data:${mime};base64,${b64}`

    return new ImageResponse(
      (
        <img
          src={dataUrl}
          width={32}
          height={32}
          style={{ borderRadius: '6px', objectFit: 'cover' }}
        />
      ),
      { ...size }
    )
  } catch {
    return new ImageResponse(
      (
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 6,
            background: daoConfig.theme.accent,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 18,
            fontWeight: 800,
            fontFamily: 'sans-serif',
          }}
        >
          {daoConfig.name[0]}
        </div>
      ),
      { ...size }
    )
  }
}
