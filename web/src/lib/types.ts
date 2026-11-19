// Shapes of the data the backend returns (see server/views.js and server/routes.js).

export type CheckStatus = 'pass' | 'fail' | 'unknown' | 'not_applicable'
export type ResultStatus = CheckStatus | 'restricted' | 'not_assessed'
export type PackKey = 'onboarding' | 'healthcare' | 'immigration' | 'payroll'

export interface Tally {
  total: number
  pass: number
  fail: number
  unknown: number
  not_applicable: number
}

export interface Worker {
  id: string
  name: string
  email: string | null
  role: string | null
  category: string | null
  dept: string | null
  status: string
  hire_date: string | null
  source: string
  readiness: string | null
  facility: string | null
  state: string | null
  packs: Record<PackKey, ResultStatus>
  checks: Tally
  overall: ResultStatus
}

export interface Me {
  user: {
    id: string
    name: string
    email: string
    role: string
    role_label: string
    can_restricted: boolean
    is_admin: boolean
  }
  tenant: { name: string; slug: string; kind: string }
  demo: boolean
  today: string
}

export interface CaseRow {
  id: string
  subject_name: string
  pack_key: PackKey
  control_name: string
  state: string
  priority: 'high' | 'medium' | 'low'
  due_date: string | null
  escalated: number
  restricted: number
  owner_name: string | null
}

export interface PackRow {
  key: PackKey
  name: string
  mode: 'auto' | 'shadow'
  owner: string | null
  total: number
  pass: number
  fail: number
  unknown: number
  open_cases: number
}

export interface Overview {
  coverage: Tally & { scope_statement: string; as_of: string }
  packs: PackRow[]
  urgent: CaseRow[]
  kpi: {
    open_cases: number
    expiring: number
    workers: number
    with_gaps: number
    pending_approvals: number
  }
}
