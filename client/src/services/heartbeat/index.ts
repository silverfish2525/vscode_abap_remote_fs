/**
 * 💓 Heartbeat Module
 *
 * Periodic LLM agent turns for background monitoring.
 * The LLM reads heartbeat.json watchlist and uses available tools to check tasks.
 */

// Types — split from value re-exports because rolldown (the bundler under
// tsdown) treats `export {}` of an interface/type alias from another file
// as a MISSING_EXPORT runtime error if the symbol exists only in the type
// world. webpack with ts-loader silently elided these; rolldown is stricter
// and forces us to be explicit.
export type {
  HeartbeatConfig,
  HeartbeatRunResult,
  HeartbeatRunRecord,
  HeartbeatServiceState,
  HeartbeatEvent,
  HeartbeatEventListener,
  ActiveHoursConfig
} from "./heartbeatTypes"

// Values from heartbeatTypes (constants + helper functions)
export {
  HEARTBEAT_OK_TOKEN,
  DEFAULT_HEARTBEAT_CONFIG,
  parseDurationMs,
  formatDuration,
  isWithinActiveHours,
  parseHeartbeatResponse
} from "./heartbeatTypes"

// Watchlist
export type { WatchlistTask, HeartbeatWatchlistFile } from "./heartbeatWatchlist"
export { HeartbeatWatchlist } from "./heartbeatWatchlist"

// State Manager
export { HeartbeatStateManager } from "./heartbeatStateManager"

// LM Client
export type { HeartbeatLMResult } from "./heartbeatLmClient"
export { runHeartbeatLM } from "./heartbeatLmClient"

// Service
export {
  HeartbeatService,
  initializeHeartbeatService,
  getHeartbeatService
} from "./heartbeatService"

// Tool
export type { HeartbeatToolParams } from "./heartbeatTool"
export { HeartbeatTool, registerHeartbeatTool } from "./heartbeatTool"
