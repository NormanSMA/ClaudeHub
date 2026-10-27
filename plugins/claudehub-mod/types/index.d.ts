export type ClaudehubModPlan = number | null

declare module 'claude-code' {
  interface PluginState {
    'claudehub-mod': { pct5h: ClaudehubModPlan }
  }
}
