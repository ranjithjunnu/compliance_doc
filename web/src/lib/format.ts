// Shared wording and date formats, so every screen says things the same way.

// Dates from the backend are plain YYYY-MM-DD. Formatting in UTC keeps the day from shifting by time zone.
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

const STATES: Record<string, string> = {
  identified: 'New',
  assigned: 'Assigned',
  requested: 'Requested',
  following_up: 'Following up',
  in_review: 'In review',
  closed: 'Closed',
}
export const caseStage = (state: string) => STATES[state] ?? state.replace(/_/g, ' ')

export const packMode = (mode: string) => (mode === 'auto' ? 'Automatic requests' : 'Validation only')
