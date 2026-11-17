import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('CredLock UI error', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="login-screen">
          <div className="login-panel card">
            <h2>Something went wrong</h2>
            <p className="muted">{this.state.error.message}</p>
            <button
              type="button"
              className="btn"
              style={{ marginTop: 12 }}
              onClick={() => {
                this.setState({ error: null })
                window.location.reload()
              }}
            >
              Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
