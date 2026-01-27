import { updateInvestor, removeInvestor } from '@/lib/db'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function PATCH(request, { params }) {
  try {
    const { id } = await params
    const body = await request.json()
    
    const investor = await updateInvestor(id, body)
    
    if (!investor) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    
    return NextResponse.json({ success: true, investor })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params
    
    const result = await removeInvestor(id)
    
    if (!result) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
