import { Component, type ReactNode } from 'react'

export function StartupError({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="page narrow stack" style={{ paddingTop: 40 }}>
      <div className="card stack">
        <h1>{title}</h1>
        <p className="error" style={{ wordBreak: 'break-word' }}>{detail}</p>
        <button className="btn primary" onClick={() => location.reload()}>↻ Reload</button>
      </div>
    </div>
  )
}

/** Shows what went wrong instead of a white page if a screen crashes. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) return <StartupError title="Something went wrong" detail={this.state.error.message} />
    return this.props.children
  }
}
