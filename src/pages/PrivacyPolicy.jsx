const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=Space+Grotesk:wght@400;500;600;700&family=Share+Tech+Mono&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #121218; }
`

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{
        fontFamily: "'Nunito', sans-serif",
        fontSize: 17,
        fontWeight: 800,
        color: '#F59E0B',
        marginBottom: 14,
        paddingBottom: 8,
        borderBottom: '1px solid #32324A',
      }}>{title}</h2>
      {children}
    </section>
  )
}

function P({ children }) {
  return (
    <p style={{ color: '#B8B4D8', fontSize: 15, lineHeight: 1.8, marginBottom: 12 }}>
      {children}
    </p>
  )
}

function UL({ items }) {
  return (
    <ul style={{ paddingLeft: 20, marginBottom: 14 }}>
      {items.map((item, i) => (
        <li key={i} style={{ color: '#B8B4D8', fontSize: 15, lineHeight: 1.8, marginBottom: 6 }}>
          {item}
        </li>
      ))}
    </ul>
  )
}

export default function PrivacyPolicy() {
  return (
    <>
      <style>{CSS}</style>
      <div style={{ background: '#121218', minHeight: '100vh', color: '#F1F0FF' }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #3B1A6B, #7C3AED)',
          padding: '20px 20px 24px',
          marginBottom: 0,
        }}>
          <div style={{ maxWidth: 680, margin: '0 auto' }}>
            <a
              href="/"
              style={{
                display: 'inline-block',
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: 11,
                letterSpacing: 2,
                color: 'rgba(255,255,255,0.7)',
                textDecoration: 'none',
                marginBottom: 16,
              }}
            >
              &larr; BACK
            </a>
            <div style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: 11,
              letterSpacing: 3,
              color: 'rgba(255,255,255,0.6)',
              marginBottom: 6,
            }}>MAP THE MOVIE</div>
            <h1 style={{
              fontFamily: "'Nunito', sans-serif",
              fontSize: 28,
              fontWeight: 900,
              color: '#fff',
              lineHeight: 1.2,
              marginBottom: 8,
            }}>Privacy Policy</h1>
            <div style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 13,
              color: 'rgba(255,255,255,0.6)',
            }}>Last updated: June 2026</div>
          </div>
        </div>

        {/* Content */}
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '40px 20px 80px' }}>

          <Section title="1. Who We Are">
            <P>
              MapTheMovie is operated by <strong style={{ color: '#F1F0FF' }}>GeoFiction Labs Ltd</strong>, a company
              registered in England and Wales. Our registered address is in Gillingham, Kent, United Kingdom.
            </P>
            <P>
              We operate the MapTheMovie platform available at <strong style={{ color: '#F1F0FF' }}>app.mapthemovie.co.uk</strong> and
              associated services (collectively, the "Service").
            </P>
            <P>
              For any privacy-related enquiries, contact us at{' '}
              <a href="mailto:hello@geofictionlabs.com" style={{ color: '#F59E0B', textDecoration: 'none' }}>
                hello@geofictionlabs.com
              </a>.
            </P>
          </Section>

          <Section title="2. Data We Collect">
            <P>We collect the minimum data necessary to provide the Service:</P>
            <UL items={[
              'Email address — when you create a player account or sign up for business notifications.',
              'GPS location data — collected only during an active hunt session, used solely to determine your distance from the destination and detect arrival. GPS coordinates are processed in-memory and are never stored permanently on our servers.',
              'Anonymous session data — a randomly generated session identifier created when you start a hunt. This does not identify you personally.',
              'Puzzle answers — submitted answers are validated server-side and the result is returned to you. We store the outcome (correct/incorrect) and the coordinate digit unlocked, not your raw answer.',
              'Voucher redemption records — when a reward is claimed, we store the voucher code, the associated campaign, and the timestamp, to prevent duplicate redemptions.',
              'Business account data — for business subscribers: email address, business name, and payment information processed via Stripe.',
            ]} />
          </Section>

          <Section title="3. How We Use Your Data">
            <UL items={[
              'To operate the hunt gameplay — matching your GPS position to destination coordinates during active play.',
              'To issue and validate reward vouchers.',
              'To send transactional emails — account creation, magic link sign-in, and redemption notifications (business accounts).',
              'To process payments for business subscriptions via Stripe.',
              'To improve the Service — aggregate, anonymised usage patterns only.',
              'To respond to support requests submitted to hello@geofictionlabs.com.',
            ]} />
            <P>We do not use your data for advertising, profiling, or sale to third parties.</P>
          </Section>

          <Section title="4. GPS and Location Data">
            <P>
              Location access is requested only when you begin an active hunt and have solved the coordinate puzzle.
              The browser requests your GPS position to display your distance from the destination and confirm your arrival.
            </P>
            <P>
              <strong style={{ color: '#F1F0FF' }}>GPS coordinates are never stored permanently.</strong> They are processed
              transiently in your browser and, during arrival confirmation, passed to our server solely to validate that
              you are within the geofence radius. The server validates the coordinates against the puzzle destination and
              immediately discards them — no GPS history, movement trail, or location log is retained.
            </P>
            <P>
              You may deny location permission at any time through your device or browser settings. This will prevent
              the compass and arrival features from functioning, but you can still play the puzzle trivia portion.
            </P>
          </Section>

          <Section title="5. Legal Basis for Processing (UK GDPR)">
            <UL items={[
              'Contractual necessity — processing required to deliver the Service you have requested (gameplay, voucher issuance, account management).',
              'Legitimate interests — improving the Service using anonymised aggregate data; fraud prevention.',
              'Consent — email notifications for prize pool launches and marketing updates, where you have opted in. You may withdraw consent at any time.',
              'Legal obligation — where required by applicable law.',
            ]} />
          </Section>

          <Section title="6. Third-Party Services">
            <P>We use the following third-party processors:</P>
            <UL items={[
              'Supabase (database and authentication) — data is stored on servers in the European Union. Supabase is certified under the EU Standard Contractual Clauses.',
              'Vercel (hosting and CDN) — serves the web application. Vercel processes request logs that may include IP addresses, which are retained for a limited period for security purposes.',
              'Stripe (payment processing, business subscribers only) — handles payment card data. GeoFiction Labs Ltd never receives or stores card details. Stripe is PCI-DSS compliant.',
            ]} />
            <P>
              We do not share your personal data with any other third parties unless required by law or to protect
              our legal rights.
            </P>
          </Section>

          <Section title="7. Data Retention">
            <UL items={[
              'Player session data — retained for 90 days after the session ends, then automatically deleted.',
              'Voucher records — retained for 12 months for audit and fraud prevention purposes.',
              'Email addresses — retained until you request deletion or withdraw consent.',
              'Business account data — retained for the duration of the subscription plus 7 years for legal and tax compliance.',
              'GPS coordinates — not retained. Processed transiently and discarded immediately after arrival validation.',
            ]} />
          </Section>

          <Section title="8. Your Rights Under UK GDPR">
            <P>You have the following rights regarding your personal data:</P>
            <UL items={[
              'Right of access — request a copy of the personal data we hold about you.',
              'Right to rectification — request correction of inaccurate or incomplete data.',
              'Right to erasure ("right to be forgotten") — request deletion of your personal data, subject to our legal retention obligations.',
              'Right to data portability — receive your data in a machine-readable format.',
              'Right to restrict processing — request that we limit how we use your data.',
              'Right to object — object to processing based on legitimate interests.',
              'Right to withdraw consent — where processing is based on consent, withdraw it at any time without affecting the lawfulness of prior processing.',
            ]} />
            <P>
              To exercise any of these rights, email us at{' '}
              <a href="mailto:hello@geofictionlabs.com" style={{ color: '#F59E0B', textDecoration: 'none' }}>
                hello@geofictionlabs.com
              </a>.
              We will respond within 30 days. You also have the right to lodge a complaint with the
              Information Commissioner's Office (ICO) at ico.org.uk.
            </P>
          </Section>

          <Section title="9. Cookies and Local Storage">
            <P>
              We use browser local storage to retain your anonymous session identifier between visits so you can
              continue an in-progress hunt. No third-party tracking cookies are set. No advertising cookies are used.
            </P>
          </Section>

          <Section title="10. Children">
            <P>
              The Service is not directed at children under 13 years of age. We do not knowingly collect personal
              data from children under 13. If you believe a child under 13 has provided us with personal data,
              please contact us at hello@geofictionlabs.com and we will delete it promptly.
            </P>
          </Section>

          <Section title="11. Security">
            <P>
              We implement appropriate technical and organisational measures to protect your personal data, including
              TLS encryption in transit, row-level security on our database, and restricted access controls. No method
              of transmission over the internet is completely secure; we cannot guarantee absolute security but we
              will notify you of any breach as required by applicable law.
            </P>
          </Section>

          <Section title="12. Changes to This Policy">
            <P>
              We may update this Privacy Policy from time to time. Material changes will be notified via the Service
              or by email where we hold your email address. The date at the top of this page indicates when the policy
              was last updated. Continued use of the Service after changes constitutes acceptance of the updated policy.
            </P>
          </Section>

          <Section title="13. Governing Law">
            <P>
              This Privacy Policy is governed by the laws of England and Wales. Any disputes shall be subject to the
              exclusive jurisdiction of the courts of England and Wales.
            </P>
          </Section>

          <div style={{
            borderTop: '1px solid #32324A',
            paddingTop: 24,
            marginTop: 8,
          }}>
            <P>
              <strong style={{ color: '#F1F0FF' }}>GeoFiction Labs Ltd</strong>
              <br />Gillingham, Kent, United Kingdom
              <br />
              <a href="mailto:hello@geofictionlabs.com" style={{ color: '#F59E0B', textDecoration: 'none' }}>
                hello@geofictionlabs.com
              </a>
            </P>
          </div>
        </div>
      </div>
    </>
  )
}
