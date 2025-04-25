import React from 'react'
import ReactDOM from 'react-dom/client'
// import './index.css'
import App from './App'
import './style.css'
import { ClerkProvider } from '@clerk/clerk-react'
import { BrowserRouter } from 'react-router-dom'
import { supabase } from './supabaseClient'

// Import your publishable key from environment variables
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key. Make sure VITE_CLERK_PUBLISHABLE_KEY is set in your .env.local file.")
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </BrowserRouter>
    </ClerkProvider>
  </React.StrictMode>,
)
