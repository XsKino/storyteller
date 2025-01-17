import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { AssistantUpdateParams } from 'openai/resources/beta/index.mjs'

const openai = new OpenAI({
  dangerouslyAllowBrowser: true,
  organization: process.env.OPENAI_ORGANIZATION,
  apiKey: process.env.OPENAI_API_KEY
})

// Get the assistant with ID from the URL
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params

  let response

  try {
    response = await openai.beta.assistants.retrieve(id)
  } catch (error) {
    response = error
    return NextResponse.json(response, { status: 404 })
  }

  return NextResponse.json(response)
}

// Update the assistant with ID from the URL
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params

  let body
  let response

  try {
    body = await req.json()
  } catch (error) {
    response = error
    return NextResponse.json(response, { status: 400 })
  }

  try {
    response = await openai.beta.assistants.update(id, body as AssistantUpdateParams)
  } catch (error) {
    response = error
    return NextResponse.json(response, { status: 404 })
  }

  return NextResponse.json(response)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params

  let response

  try {
    response = await openai.beta.assistants.del(id)
  } catch (error) {
    response = error
    return NextResponse.json(response, { status: 404 })
  }

  return NextResponse.json(response)
}
