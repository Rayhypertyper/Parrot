import type { PrismaClient } from '@prisma/client'

export async function seedDemo(prisma: PrismaClient): Promise<void> {
  const crew = await prisma.crew.upsert({
    where: { code: 'demo' },
    update: {},
    create: { code: 'demo', name: 'Demo Crew' },
  })
  const profiles = [
    { profileCode: 'jo', name: 'Jo', location: 'Room B', availability: 'busy', skills: ['Demo host'] },
    { profileCode: 'alex', name: 'Alex', location: 'Projector', availability: 'available', skills: ['AV', 'Adapters'] },
    { profileCode: 'maya', name: 'Maya', location: 'Volunteer desk', availability: 'available', skills: ['Runner'] },
    { profileCode: 'jules', name: 'Jules', location: 'Main entrance', availability: 'protected', skills: ['Check-in'] },
  ] as const
  for (const profile of profiles) {
    await prisma.crewMember.upsert({
      where: { crewId_profileCode: { crewId: crew.id, profileCode: profile.profileCode } },
      update: {},
      create: { ...profile, skills: [...profile.skills], crewId: crew.id },
    })
  }
}
