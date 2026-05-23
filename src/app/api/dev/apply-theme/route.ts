import { readFileSync, writeFileSync } from 'fs'
import { NextResponse } from 'next/server'
import path from 'path'

const THEME_PATH = path.join(process.cwd(), 'src/config/dao.theme.json')

export async function POST(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  let body: { accent?: string; radius?: number; displayFont?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  try {
    const current = JSON.parse(readFileSync(THEME_PATH, 'utf8'))
    const updated = {
      ...current,
      ...(body.accent !== undefined && { accent: body.accent }),
      ...(body.radius !== undefined && { radius: body.radius }),
      ...(body.displayFont !== undefined && { displayFont: body.displayFont }),
    }
    writeFileSync(THEME_PATH, JSON.stringify(updated, null, 2) + '\n', 'utf8')
    return NextResponse.json({ ok: true, theme: updated })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
