import { NextRequest, NextResponse } from 'next/server'

export async function GET(_request: NextRequest) {
  const gatewayUrl = process.env.LEC7_AI_GATEWAY_URL || ''
  const gatewaySecret = process.env.LEC7_GATEWAY_SECRET || ''

  if (!gatewayUrl) {
    return NextResponse.json(
      {
        ok: false,
        error: 'LEC7_AI_GATEWAY_URL is missing',
        gatewayUrl,
        hasGatewaySecret: Boolean(gatewaySecret),
        gatewaySecretLen: gatewaySecret.length,
      },
      { status: 400 }
    )
  }

  const diagnostics: {
    gatewayUrl: string
    hasGatewaySecret: boolean
    gatewaySecretLen: number
    gatewayHealthHttpCode?: number
    gatewayHealthBody?: string
    gatewayHealthError?: string
    ownerAgentHttpCode?: number
    ownerAgentBody?: string
    ownerAgentError?: string
  } = {
    gatewayUrl,
    hasGatewaySecret: Boolean(gatewaySecret),
    gatewaySecretLen: gatewaySecret.length,
  }

  // 1. Проверяем /health на gateway
  try {
    const healthRes = await fetch(`${gatewayUrl.replace(/\/+$/, '')}/health`, {
      method: 'GET',
    })
    diagnostics.gatewayHealthHttpCode = healthRes.status

    const text = await healthRes.text().catch(() => '')
    diagnostics.gatewayHealthBody = text.slice(0, 300)
  } catch (error) {
    diagnostics.gatewayHealthError = error instanceof Error ? error.message : String(error)
  }

  // 2. Проверяем /v1/owner-agent на gateway
  try {
    const ownerAgentRes = await fetch(`${gatewayUrl.replace(/\/+$/, '')}/v1/owner-agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(gatewaySecret ? { 'X-LEC7-GATEWAY-SECRET': gatewaySecret } : {}),
      },
      body: JSON.stringify({
        message: 'Пинг. Ответь одним предложением.',
      }),
    })

    diagnostics.ownerAgentHttpCode = ownerAgentRes.status

    const text = await ownerAgentRes.text().catch(() => '')
    diagnostics.ownerAgentBody = text.slice(0, 500)
  } catch (error) {
    diagnostics.ownerAgentError = error instanceof Error ? error.message : String(error)
  }

  return NextResponse.json(
    {
      ok: true,
      ...diagnostics,
    },
    { status: 200 }
  )
}

