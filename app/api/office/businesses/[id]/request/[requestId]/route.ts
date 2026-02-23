import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withBusinessAccess, getBusinessIdFromPath } from '@/lib/access'

/**
 * DELETE /api/office/businesses/[id]/request/[requestId]
 * Удаление заявки (Request)
 */
export const DELETE = withBusinessAccess(async (req, user) => {
  try {
    const pathname = new URL(req.url).pathname
    const businessId = getBusinessIdFromPath(pathname)
    const pathParts = pathname.split('/')
    const requestIdx = pathParts.indexOf('request')
    const requestId = requestIdx >= 0 && requestIdx + 1 < pathParts.length ? pathParts[requestIdx + 1] : null

    if (!businessId || !requestId) {
      return NextResponse.json({ error: 'Business ID and Request ID are required' }, { status: 400 })
    }

    const request = await prisma.request.findUnique({
      where: { id: requestId },
      select: { id: true, businessId: true },
    })

    if (!request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    if (request.businessId !== businessId) {
      return NextResponse.json({ error: 'Request does not belong to this business' }, { status: 403 })
    }

    await prisma.request.delete({
      where: { id: requestId },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete request error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
