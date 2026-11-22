import { allHandsSpeech } from '../../shared/crew/index'
import { CrewError, notFound } from './input'
import type { CrewActor, CrewDatabase } from './store'

export type AnnouncementSpeech = (text: string) => Promise<string>
const elevenLabs = 'https://api.elevenlabs.io/v1'
const clips = new Map<string, Promise<string>>()
let voiceId: string | undefined

async function synthesize(text: string) {
  const apiKey = process.env.ELEVENLABS_API_KEY
  const agentId = process.env.ELEVENLABS_AGENT_ID
  if (!apiKey || !agentId) throw new Error('ElevenLabs is unavailable')
  const headers = { 'xi-api-key': apiKey, 'Content-Type': 'application/json' }
  const options = { headers, redirect: 'error', signal: AbortSignal.timeout(8000) } as const
  if (!voiceId) {
    const agent = await fetch(`${elevenLabs}/convai/agents/${encodeURIComponent(agentId)}`, options)
    if (!agent.ok) throw new Error('Could not read the agent voice')
    const data = await agent.json() as { conversation_config?: { tts?: { voice_id?: string } } }
    voiceId = data.conversation_config?.tts?.voice_id
    if (!voiceId) throw new Error('No agent voice is configured')
  }
  const response = await fetch(`${elevenLabs}/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_22050_32`, {
    ...options, method: 'POST', body: JSON.stringify({ text, model_id: 'eleven_flash_v2_5' }),
  })
  if (!response.ok || !response.headers.get('content-type')?.startsWith('audio/')) throw new Error('Could not generate announcement speech')
  return Buffer.from(await response.arrayBuffer()).toString('base64')
}

export const elevenLabsAnnouncement: AnnouncementSpeech = (text) => {
  const cached = clips.get(text)
  if (cached) return cached
  const oldest = clips.keys().next().value
  if (clips.size >= 24 && oldest) clips.delete(oldest)
  const clip = synthesize(text).catch(error => {
    clips.delete(text)
    throw error
  })
  clips.set(text, clip)
  return clip
}

export async function getAnnouncementAudio(db: CrewDatabase, actor: CrewActor, id: string, speak: AnnouncementSpeech) {
  const announcement = await db.crewRequest.findFirst({
    where: { id, crewId: actor.crewId, archivedAt: null, allHands: true },
    select: { title: true, destination: true },
  })
  if (!announcement) notFound('Announcement was not found.')
  try {
    const audio = await speak(allHandsSpeech(announcement.title, announcement.destination))
    return { audio }
  } catch {
    throw new CrewError(503, 'unavailable', 'The announcement audio is unavailable.')
  }
}
