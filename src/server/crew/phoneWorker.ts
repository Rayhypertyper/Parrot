import { prisma } from 'wasp/server'
import { processCrewPhoneCalls } from './phoneCalls'

export async function dialCrewOffers() {
  await processCrewPhoneCalls(prisma)
}
