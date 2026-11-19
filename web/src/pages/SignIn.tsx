import { useState, type FormEvent } from 'react'
import { api, ApiError } from '../lib/api'
import { Alert, Button, Card, Field } from '../components/ui'

export function SignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api('/api/login', { email, password })
      onSignedIn()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach Aegis. Check your connection.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="signin">
      <div className="signin-panel">
        <div className="signin-brand">
          <span className="logo-mark" aria-hidden="true">
            A
          </span>
          <span className="logo-word">Aegis</span>
        </div>
        <Card title="Sign in" description="Use your work email.">
          <form className="signin-form" onSubmit={submit}>
            {error ? <Alert>{error}</Alert> : null}
            <Field
              label="Work email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Field
              label="Password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
