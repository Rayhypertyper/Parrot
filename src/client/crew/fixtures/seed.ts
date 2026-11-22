// Frontend-only sample crew for building against before A's routes are live.
// Mirrors the hackathon story in the brief. Never shipped in release builds:
// adapter.ts only imports this folder when REACT_APP_CREW_ADAPTER=fixture.
import type { Member } from "../contract";

export const FIXTURE_CREW = {
  id: "crew_demo",
  code: "demo",
  name: "Demo Day crew",
};

export const FIXTURE_MEMBERS: (Member & { profileCode: string })[] = [
  {
    id: "jo",
    profileCode: "jo",
    name: "Jo",
    location: "Demo Room B",
    availability: "busy",
    skills: ["Organizer"],
  },
  {
    id: "alex",
    profileCode: "alex",
    name: "Alex",
    location: "Main stage projector",
    availability: "available",
    skills: ["AV", "Cables"],
  },
  {
    id: "maya",
    profileCode: "maya",
    name: "Maya",
    location: "Hallway by registration",
    availability: "available",
    skills: ["Runner"],
  },
  {
    id: "jules",
    profileCode: "jules",
    name: "Jules",
    location: "North entrance",
    availability: "protected",
    skills: ["Check-in"],
  },
];
