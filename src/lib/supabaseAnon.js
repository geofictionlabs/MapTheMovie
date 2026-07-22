import { createClient } from '@supabase/supabase-js'
import { cleanUrl, cleanKey } from './supabase'

// A second client, deliberately never persisting or reading a session.
// The main `supabase` client is a single shared instance across every
// route on this origin (App, Dashboard, BusinessSignup, StaffRedeem,
// PlayerPassport, FlightDeck) -- if a real player has ever played a
// hunt in this browser, an anonymous session (signInAnonymously, fired
// on PLAY) is sitting in localStorage and gets attached to every
// request the main client makes, on every route, including ones that
// have nothing to do with playing.
//
// For any request that must always run as true anon regardless of
// whatever session happens to exist in this browser -- e.g.
// BusinessSignup.jsx's businesses insert, which `authenticated` has no
// grant for by design -- use this client instead of the shared one.
// persistSession: false means it never even looks at localStorage, so
// every request carries only the anon API key, never a user JWT. This
// must never call supabase.auth.signOut() on the SHARED client to
// force the same effect -- an anonymous session has no credentials to
// sign back into, so signing it out would permanently orphan that
// player's own hunt history/Passport progress from this browser.
export const supabaseAnon = createClient(cleanUrl, cleanKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})
