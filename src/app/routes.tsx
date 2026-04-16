export const ROUTES = {
  worldIndex: '/',
  world: (worldId: string) => `/world/${worldId}`,
} as const;
