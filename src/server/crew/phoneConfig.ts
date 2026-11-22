export function crewPhoneConfig(crewCode: string) {
  const apiKey = process.env.ELEVENLABS_API_KEY
  const agentId = process.env.ELEVENLABS_AGENT_ID
  const phoneNumberId = process.env.ELEVENLABS_PHONE_NUMBER_ID
  const raw = process.env.CREW_PHONE_CONTACTS
  if (!apiKey || !agentId || !phoneNumberId || !raw || !process.env.ELEVENLABS_WEBHOOK_SECRET) return

  try {
    const profiles = JSON.parse(raw)[crewCode]
    if (!profiles || typeof profiles !== 'object' || Array.isArray(profiles)) return
    const contacts = new Map<string, string>()
    for (const [profile, number] of Object.entries(profiles)) {
      if (typeof number === 'string' && /^\+[1-9]\d{7,14}$/.test(number)) contacts.set(profile, number)
    }
    if (contacts.size && new Set(contacts.values()).size === contacts.size) {
      return { apiKey, agentId, phoneNumberId, contacts }
    }
  } catch {
    // Invalid phone configuration leaves the in-app workflow available.
  }
}
