import { aiApi } from './axios'
import type { DashboardResponse } from './types'

// ── Admin usage & quality dashboard (TASK-13) ───────────────────────────────
// Targets ai-service `GET /usage/dashboard` (port 3002), gated server-side by
// the MANAGE_WORKSPACE capability. The web admin console is the primary surface.

export interface DashboardParams {
  /** `YYYY-MM` — a calendar month window. Takes precedence over `days`. */
  month?: string
  /** Rolling window in days (default 30 server-side) when `month` is absent. */
  days?: number
}

export const usageService = {
  getDashboard: (params: DashboardParams = {}) =>
    aiApi
      .get<DashboardResponse>('/usage/dashboard', { params })
      .then((r) => r.data),
}
