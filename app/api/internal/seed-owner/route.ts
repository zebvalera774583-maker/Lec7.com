import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export async function POST() {
  const rawEmail = process.env.LEC7_OWNER_EMAIL || ''
  const ownerEmail = rawEmail.replace(/"/g, '').trim()
  const ownerPass = process.env.LEC7_OWNER_PASSWORD || ''

  if (!ownerEmail || !ownerPass) {
    return NextResponse.json(
      { error: 'Missing ENV: LEC7_OWNER_EMAIL / LEC7_OWNER_PASSWORD' },
      { status: 500 }
    )
  }

  const existing = await prisma.user.findUnique({ where: { email: ownerEmail } })
  if (existing) {
    return NextResponse.json({ ok: true, status: 'already_exists', email: ownerEmail, role: existing.role })
  }

  const hash = await bcrypt.hash(ownerPass, 10)

  const user = await prisma.user.create({
    data: {
      email: ownerEmail,
      password: hash,
      name: 'Lec7 Owner',
      role: 'LEC7_ADMIN',
    },
  })

  return NextResponse.json({ ok: true, status: 'created', email: user.email, role: user.role })
}
