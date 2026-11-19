import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from './lib/api'
import type { Me } from './lib/types'
import { AppShell } from './components/AppShell'
import { Overview } from './pages/Overview'
import { SignIn } from './pages/SignIn'
import { EmptyState, Skeleton } from './components/ui'

type State = { kind: 'loading' } | { kind: 'signed-out' } | { kind: 'signed-in'; me: Me } | { kind: 'error'; message: string }

const pageFromHash = () => window.location.hash.slice(1) || 'overview'

export function App() {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [page, setPage] = useState(pageFromHash)

  const load = useCallback(() => {
    api<Me>('/api/me')
      .then((me) => setState({ kind: 'signed-in', me }))
      .catch((e: unknown) =>
        setState(
          e instanceof ApiError && e.status === 401
            ? { kind: 'signed-out' }
            : { kind: 'error', message: 'Aegis could not reach its server. Check that the backend is running.' },
        ),
      )
  }, [])

  useEffect(load, [load])
  useEffect(() => {
    const onHash = () => setPage(pageFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (state.kind === 'loading') return <div className="signin"><Skeleton lines={3} /></div>
  if (state.kind === 'error') return <div className="signin"><EmptyState title="Something went wrong">{state.message}</EmptyState></div>
  if (state.kind === 'signed-out') return <SignIn onSignedIn={load} />

  const signOut = () => api('/api/logout', {}).finally(() => setState({ kind: 'signed-out' }))

  return (
    <AppShell me={state.me} current={page} onNavigate={(id) => (window.location.hash = id)} onSignOut={signOut}>
      {page === 'overview' ? (
        <Overview key={state.me.today} today={state.me.today} />
      ) : (
        <EmptyState title="Not rebuilt yet">
          Open this screen in the <a href={`http://localhost:4100/#${page}`}>current app</a>.
        </EmptyState>
      )}
    </AppShell>
  )
}
