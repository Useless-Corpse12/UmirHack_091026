import type { Snapshot } from "../../shared/types/models";
// A late HTTP response or socket frame may never overwrite another restaurant or a newer revision.
export function chooseSnapshot(
  current: Snapshot | null,
  incoming: Snapshot,
  selectedId: string,
): Snapshot | null {
  if (incoming.restaurantId !== selectedId) return current;
  if (
    current &&
    (incoming.revision < current.revision ||
      (incoming.revision === current.revision &&
        Date.parse(incoming.generatedAt) < Date.parse(current.generatedAt)))
  )
    return current;
  return incoming;
}
