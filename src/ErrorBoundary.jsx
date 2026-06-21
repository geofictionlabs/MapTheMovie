import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[MapTheMovie] Render error:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          background: '#121218', minHeight: '100dvh',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px', color: '#F1F0FF', fontFamily: 'system-ui, sans-serif',
          textAlign: 'center', boxSizing: 'border-box',
        }}>
          <div>
            <div style={{ fontSize: 48, marginBottom: 16 }}></div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
              Something went wrong
            </div>
            <div style={{ fontSize: 13, color: '#6B67A0', marginBottom: 24, lineHeight: 1.6, maxWidth: 320 }}>
              An unexpected error occurred. Please refresh and try again.
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: '#7C3AED', border: 'none', borderRadius: 12,
                color: '#fff', padding: '12px 28px', fontSize: 13,
                cursor: 'pointer', letterSpacing: 1,
              }}
            >
              REFRESH
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
