import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Dashboard from './Dashboard.jsx'
import FlightDeck from './FlightDeck.jsx'
import StaffRedeem from './StaffRedeem.jsx'
import PrivacyPolicy from './pages/PrivacyPolicy.jsx'
import Terms from './pages/Terms.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'

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
          : App

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <Root />
    </ErrorBoundary>
  </StrictMode>,
)
