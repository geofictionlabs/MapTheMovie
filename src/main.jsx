import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'

// Only App stays eagerly imported -- it's the default/root screen most
// players land on directly (whatever path doesn't match anything below);
// lazy-loading it would add a network round-trip to the most common path
// for zero benefit, since those visitors need it immediately regardless.
// Every screen below is a secondary route most "/" visitors never touch,
// so splitting them out keeps their code out of everyone else's bundle.
const Dashboard = lazy(() => import('./Dashboard.jsx'))
const FlightDeck = lazy(() => import('./FlightDeck.jsx'))
const StaffRedeem = lazy(() => import('./StaffRedeem.jsx'))
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy.jsx'))
const Terms = lazy(() => import('./pages/Terms.jsx'))
const SalesDeck = lazy(() => import('./SalesDeck.jsx'))
const BusinessSignup = lazy(() => import('./BusinessSignup.jsx'))
const PlayerPassport = lazy(() => import('./PlayerPassport.jsx'))

function LoadingFallback() {
  return (
    <div style={{
      background: '#121218', minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Share Tech Mono', monospace", fontSize: '11px',
      color: '#6B67A0', letterSpacing: '3px',
    }}>
      LOADING...
    </div>
  )
}

const path = window.location.pathname
const Root = path.startsWith('/dashboard')
  ? Dashboard
  : path === '/flightdeck'
    ? FlightDeck
    : path === '/staff'
      ? StaffRedeem
      : path === '/privacy'
        ? PrivacyPolicy
        : path === '/terms'
          ? Terms
          : path === '/sales'
            ? SalesDeck
            : path === '/business'
              ? BusinessSignup
              : path === '/passport'
                ? PlayerPassport
                : App

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <Suspense fallback={<LoadingFallback />}>
        <Root />
      </Suspense>
    </ErrorBoundary>
  </StrictMode>,
)
