// Small shared building blocks. Every screen uses these instead of its own styles.
import { useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'
import type { ResultStatus } from '../lib/types'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: 'sm' | 'md' }) {
  return <button type={type} className={`btn btn-${variant} btn-${size} ${className}`} {...rest} />
}

export function Field({
  label,
  hint,
  error,
  ...input
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className={`input${error ? ' input-invalid' : ''}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...input}
      />
      {error ? (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

const STATUS: Record<ResultStatus, { label: string; tone: 'pass' | 'fail' | 'unknown' | 'na' }> = {
  pass: { label: 'Pass', tone: 'pass' },
  fail: { label: 'Fail', tone: 'fail' },
  unknown: { label: 'Unknown', tone: 'unknown' },
  not_applicable: { label: 'N/A', tone: 'na' },
  restricted: { label: 'Restricted', tone: 'na' },
  not_assessed: { label: 'Not checked', tone: 'na' },
}

// A check result. Always shows the word, never color alone.
export function StatusPill({ status }: { status: ResultStatus }) {
  const s = STATUS[status] ?? STATUS.unknown
  return (
    <span className={`pill pill-${s.tone}`}>
      <span className="pill-dot" aria-hidden="true" />
      {s.label}
    </span>
  )
}

export function Card({
  title,
  description,
  actions,
  children,
  flush = false,
}: {
  title?: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  flush?: boolean
}) {
  return (
    <section className="card">
      {title || actions ? (
        <header className="card-header">
          <div>
            {title ? <h2 className="card-title">{title}</h2> : null}
            {description ? <p className="card-description">{description}</p> : null}
          </div>
          {actions ? <div className="card-actions">{actions}</div> : null}
        </header>
      ) : null}
      <div className={flush ? 'card-body-flush' : 'card-body'}>{children}</div>
    </section>
  )
}

export function Stat({ label, value, detail }: { label: string; value: ReactNode; detail?: ReactNode }) {
  return (
    <div className="stat">
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
      {detail ? <p className="stat-detail">{detail}</p> : null}
    </div>
  )
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <header className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {description ? <p className="page-description">{description}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      {children ? <div className="empty-body">{children}</div> : null}
    </div>
  )
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="skeleton" role="status" aria-label="Loading">
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="skeleton-line" />
      ))}
    </div>
  )
}

export function Alert({ tone = 'fail', children }: { tone?: 'fail' | 'unknown' | 'na'; children: ReactNode }) {
  return (
    <div className={`alert alert-${tone}`} role={tone === 'fail' ? 'alert' : 'status'}>
      {children}
    </div>
  )
}
