import { ImageResponse } from 'next/og'

import { daoConfig } from '@/lib/dao.config'
import { resolveIpfs } from '@/lib/utils'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'
export const revalidate = 86400

export default async function Icon() {
  const src = resolveIpfs(daoConfig.image)

  try {
    return new ImageResponse(
      (
        <img
          src={src}
          alt=""
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
