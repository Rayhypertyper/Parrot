import type { CrewApi } from "./api";
import { httpAdapter } from "./httpAdapter";

// Release builds always use the HTTP adapter. Set REACT_APP_CREW_ADAPTER=fixture
// in a local .env.client to develop against in-browser sample data; the
// fixture module is only loaded behind that flag.
const wantsFixture = import.meta.env.REACT_APP_CREW_ADAPTER === "fixture";

let pending: Promise<CrewApi> | null = null;

export function getCrewApi(): Promise<CrewApi> {
  if (!pending) {
    pending = wantsFixture
      ? import("./fixtures/fixtureAdapter").then((m) => m.fixtureAdapter)
      : Promise.resolve(httpAdapter);
  }
  return pending;
}

export const usingFixture = wantsFixture;
