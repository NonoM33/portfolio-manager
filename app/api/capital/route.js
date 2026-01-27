import { updateCapital } from '@/lib/db'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const body = await request.json()
    const { newTotal } = body
    
    const result = await updateCapital(parseFloat(newTotal))
    
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
