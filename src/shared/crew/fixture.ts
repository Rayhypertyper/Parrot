import type { CrewErrorResponse, CrewEvent, CrewEventResult, CrewFeed, CrewJoinInput, CrewSession } from './index'

export const crewJoinExample = {
  input: { crewCode: 'demo', profileCode: 'maya' } satisfies CrewJoinInput,
  output: { memberToken: 'example-token', memberId: 'maya', crewId: 'demo' } satisfies CrewSession,
}

export const crewFeedExample = {
  me: { id: 'maya', name: 'Maya', location: 'Volunteer desk', availability: 'available', skills: ['Runner'] },
  members: [
    { id: 'jo', name: 'Jo', location: 'Room B', availability: 'busy', skills: ['Demo host'] },
    { id: 'alex', name: 'Alex', location: 'Projector', availability: 'busy', skills: ['AV'] },
    { id: 'maya', name: 'Maya', location: 'Volunteer desk', availability: 'available', skills: ['Runner'] },
    { id: 'jules', name: 'Jules', location: 'Main entrance', availability: 'protected', skills: ['Check-in'] },
  ],
  requests: [{
    id: 'r7', title: 'We need a USB-C to HDMI adapter in Room B.', requesterId: 'jo',
    status: 'offered', revision: 4, assigneeId: null,
    latestFact: 'I have to stay with the projector. The spare is in the blue pouch by registration.',
    pickupLocation: 'the blue pouch by registration', destination: 'Room B', planningStatus: 'idle',
    updatedAt: '2026-11-22T17:30:12.000Z',
  }],
  myOffers: [{
    id: 'o2', requestId: 'r7', recipientId: 'maya', status: 'pending',
    message: 'Can you grab the spare adapter from the blue pouch by registration and bring it to Room B?',
  }],
  activity: [
    { id: 'a3', requestId: 'r7', at: '2026-11-22T17:30:12.000Z', actorName: 'Crew Radio', summary: 'Offered the handoff to Maya.' },
    { id: 'a2', requestId: 'r7', at: '2026-11-22T17:30:09.000Z', actorName: 'Alex', summary: 'I have to stay with the projector. The spare is in the blue pouch by registration.' },
    { id: 'a1', requestId: 'r7', at: '2026-11-22T17:30:00.000Z', actorName: 'Jo', summary: 'We need a USB-C to HDMI adapter in Room B.' },
  ],
  updatedAt: '2026-11-22T17:30:12.000Z',
} satisfies CrewFeed

export const emptyCrewFeedExample: CrewFeed = {
  ...crewFeedExample, requests: [], myOffers: [], activity: [],
}

export const crewEventExamples = {
  request: { eventId: 'e101', kind: 'request_help', text: 'We need a USB-C to HDMI adapter in Room B.', location: 'Room B' } satisfies CrewEvent,
  requestResult: { eventId: 'e101', requestId: 'r7', result: 'applied', message: 'Request recorded.' } satisfies CrewEventResult,
  voiceDecline: {
    kind: 'decline', text: 'I have to stay with the projector. The spare is in the blue pouch by registration.',
    location: 'the blue pouch by registration',
  },
  plannerOffer: { requestId: 'r7', revision: 3, action: 'offer', memberId: 'maya', message: crewFeedExample.myOffers[0].message },
  accept: { eventId: 'e104', kind: 'accept', requestId: 'r7', offerId: 'o2' } satisfies CrewEvent,
  staleOffer: { code: 'conflict', message: 'This offer is no longer active. Refresh the feed.' } satisfies CrewErrorResponse,
  expiredSession: { code: 'unauthorized', message: 'Join the crew to continue.' } satisfies CrewErrorResponse,
} as const
