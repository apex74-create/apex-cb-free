// Community build: event floor data is not available.
// The full implementation lives in the private Apex estate.
import { createServerFn } from "@tanstack/react-start";

type EventFloorResult = {
  event: Record<string, unknown>;
  places: unknown[];
  vendors: unknown[];
  schedule: unknown[];
  items: unknown[];
  listings: unknown[];
};

export type EventFloor = EventFloorResult;

export const getEventFloor = createServerFn({ method: "GET" })
  .inputValidator((input: { code: string }): { code: string } => input)
  .handler(async (): Promise<EventFloorResult> => {
    throw new Error("Event floor is unavailable in the community build.");
  });

export const listPublishedEvents = createServerFn({ method: "GET" }).handler(
  async (): Promise<unknown[]> => [],
);
