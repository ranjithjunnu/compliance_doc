// The landing screen: where compliance stands, and what needs attention first.
import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { caseStage, formatDate, packMode } from '../lib/format'
import type { Overview as OverviewData } from '../lib/types'
import { Alert, Card, EmptyState, PageHeader, Skeleton, Stat } from '../components/ui'

export function Overview({ today }: { today: string }) {
  const [data, setData] = useState<OverviewData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api<OverviewData>('/api/overview')
      .then(setData)
      .catch((e: Error) => setError(e.message))
  }, [])

  if (error) return <Alert>{error}</Alert>
  if (!data) return <Skeleton lines={6} />

  const { coverage: cov, kpi } = data

  return (
    <>
      <PageHeader title="Overview" actions={<span className="muted page-meta">As of {formatDate(today)}</span>} />

      <div className="stack">
        <section aria-label="Checks">
          <div className="stat-row">
            <Stat label="Checks in scope" value={cov.total} />
            <Stat label="Pass" value={cov.pass} />
            <Stat label="Fail" value={<span className={cov.fail ? 'text-fail' : undefined}>{cov.fail}</span>} />
            <Stat label="Unknown" value={<span className={cov.unknown ? 'text-unknown' : undefined}>{cov.unknown}</span>} />
          </div>
          <p className="footnote">{cov.scope_statement}</p>
        </section>

        <div className="split">
          <Card title="Needs attention" flush>
            {data.urgent.length ? (
              <div className="table-scroll">
                <table className="table table-compact">
                  <thead>
                    <tr>
                      <th>Issue</th>
                      <th>Due</th>
                      <th>Stage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.urgent.map((c) => {
                      const overdue = !!c.due_date && c.due_date < today
                      return (
                        <tr key={c.id}>
                          <td>
                            <div className="cell-primary">
                              {c.control_name}
                              {c.priority === 'high' ? <span className="priority">High</span> : null}
                            </div>
                            <div className="cell-secondary">{c.subject_name}</div>
                          </td>
                          <td className={overdue ? 'text-fail nowrap' : 'nowrap'}>
                            {formatDate(c.due_date)}
                            {overdue ? <div className="cell-secondary text-fail">Overdue</div> : null}
                          </td>
                          <td className="nowrap">
                            {caseStage(c.state)}
                            {c.escalated ? <div className="cell-secondary">Escalated</div> : null}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="Nothing needs attention">Every check in scope passes with accepted evidence.</EmptyState>
            )}
          </Card>

          <Card title="At a glance">
            <dl className="kv">
              <div className="kv-row">
                <dt>Approvals waiting</dt>
                <dd>{kpi.pending_approvals}</dd>
              </div>
              <div className="kv-row">
                <dt>Open cases</dt>
                <dd>{kpi.open_cases}</dd>
              </div>
              <div className="kv-row">
                <dt>Credentials expiring soon</dt>
                <dd>{kpi.expiring}</dd>
              </div>
              <div className="kv-row">
                <dt>Workers with open checks</dt>
                <dd>
                  {kpi.with_gaps} of {kpi.workers}
                </dd>
              </div>
            </dl>
          </Card>
        </div>

        <Card title="Compliance packs" flush>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Pack</th>
                  <th>Requests</th>
                  <th className="num">Checks</th>
                  <th className="num">Pass</th>
                  <th className="num">Fail</th>
                  <th className="num">Unknown</th>
                  <th className="num">Open cases</th>
                  <th>Owner</th>
                </tr>
              </thead>
              <tbody>
                {data.packs.map((p) => (
                  <tr key={p.key}>
                    <td className="cell-primary">{p.name}</td>
                    <td className="cell-secondary">{packMode(p.mode)}</td>
                    <td className="num">{p.total}</td>
                    <td className="num">{p.pass}</td>
                    <td className={`num${p.fail ? ' text-fail' : ''}`}>{p.fail}</td>
                    <td className={`num${p.unknown ? ' text-unknown' : ''}`}>{p.unknown}</td>
                    <td className="num">{p.open_cases}</td>
                    <td>{p.owner ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  )
}
