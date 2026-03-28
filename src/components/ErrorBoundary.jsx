import { Component } from 'react'

/**
 * ErrorBoundary - Catches React render errors gracefully
 * Prevents app crashes from showing blank screens
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px',
          textAlign: 'center',
          background: '#080808',
          color: '#f59e0b',
          fontFamily: 'system-ui, sans-serif',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '24px' }}>⚠️</div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '16px', color: '#fff' }}>
            Something went wrong
          </h2>
          <p style={{ fontSize: '14px', color: '#888', marginBottom: '32px', maxWidth: '400px' }}>
            {this.state.error?.message || 'An unexpected error occurred. Please reload the app.'}
          </p>
          <button
            onClick={this.handleReload}
            style={{
              padding: '16px 32px',
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              color: '#000',
              border: 'none',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(245, 158, 11, 0.4)',
            }}
          >
            Reload Application
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary