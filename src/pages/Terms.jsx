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

export default function Terms() {
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
            }}>Terms of Service</h1>
            <div style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 13,
              color: 'rgba(255,255,255,0.6)',
            }}>Last updated: June 2026</div>
          </div>
        </div>

        {/* Content */}
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '40px 20px 80px' }}>

          <Section title="1. Acceptance of Terms">
            <P>
              By accessing or using the MapTheMovie platform ("Service") operated by{' '}
              <strong style={{ color: '#F1F0FF' }}>GeoFiction Labs Ltd</strong> ("we", "us", or "our"),
              you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the Service.
            </P>
            <P>
              These terms constitute a legally binding agreement between you and GeoFiction Labs Ltd, a company
              registered in England and Wales, with a registered address in Gillingham, Kent, United Kingdom.
            </P>
          </Section>

          <Section title="2. Service Description">
            <P>
              MapTheMovie is a location-based entertainment platform. Players solve film trivia questions to
              progressively unmask GPS coordinates, then navigate on foot to the hidden destination to claim a
              reward from a participating business.
            </P>
            <P>
              The Service includes: the player web application (app.mapthemovie.co.uk), the business management
              dashboard, and associated APIs and infrastructure.
            </P>
          </Section>

          <Section title="3. Eligibility">
            <UL items={[
              'You must be at least 13 years old to use the Service.',
              'If you are between 13 and 18 years old, you must have the consent of a parent or legal guardian.',
              'You must have the legal capacity to enter into binding contracts in your jurisdiction.',
              'You must not be prohibited from using the Service under any applicable law.',
            ]} />
            <P>
              By using the Service, you represent and warrant that you meet all eligibility requirements above.
            </P>
          </Section>

          <Section title="4. Player Accounts">
            <P>
              Player accounts are created automatically when you tap "Play" using anonymous authentication.
              No registration is required to play. An email address is required only if you choose to create
              a persistent account to save progress across devices.
            </P>
            <UL items={[
              'You are responsible for maintaining the confidentiality of your account.',
              'You must not share account credentials or allow others to use your session.',
              'We reserve the right to suspend or terminate accounts that violate these terms.',
              'Anonymous accounts may be deleted after 90 days of inactivity.',
            ]} />
          </Section>

          <Section title="5. Free Player Access">
            <P>
              Playing hunts listed as free tier is provided at no charge. No payment, registration, or
              subscription is required to access free hunts.
            </P>
            <P>
              Premium or paid features, including prize pool entry, may require payment. Where applicable,
              pricing will be clearly displayed before any charge is made.
            </P>
          </Section>

          <Section title="6. Business Subscriber Terms">
            <P>
              Businesses wishing to host hunts and offer rewards must create a business account and subscribe
              to an appropriate plan. By subscribing, you additionally agree to:
            </P>
            <UL items={[
              'Providing accurate and truthful information about your business and venue.',
              'Honouring all vouchers issued to players who legitimately complete your hunt.',
              'Ensuring your reward offering is available for the duration of the active campaign.',
              'Not using the Service to mislead, deceive, or defraud players.',
              'Complying with all applicable laws including consumer protection and advertising standards.',
              'Paying subscription fees as agreed. Fees are non-refundable unless required by law.',
            ]} />
            <P>
              We reserve the right to suspend or terminate business accounts for non-compliance, non-payment,
              or any conduct that we reasonably consider harmful to players or the platform.
            </P>
          </Section>

          <Section title="7. Vouchers and Rewards">
            <UL items={[
              'Vouchers are issued upon successful completion of a hunt and arrival confirmation within the geofence radius.',
              'Each voucher is valid for one redemption per person per campaign, unless the business specifies otherwise.',
              'Vouchers must be presented to venue staff at the time of redemption and cannot be transferred or resold.',
              'Voucher value, validity period, and conditions are set by the participating business, not GeoFiction Labs Ltd.',
              'GeoFiction Labs Ltd is not responsible for a business\'s failure to honour a voucher. In such cases, please contact us at hello@geofictionlabs.com and we will investigate.',
              'Expired or fraudulently obtained vouchers will be void.',
            ]} />
          </Section>

          <Section title="8. GPS and Location Permission">
            <P>
              The compass navigation and arrival confirmation features require access to your device's GPS or
              location services. By enabling location access within the Service, you acknowledge that:
            </P>
            <UL items={[
              'Location data is used solely for in-game navigation and arrival detection, as described in our Privacy Policy.',
              'GPS accuracy varies by device, environment, and conditions. Urban canyons, indoor spaces, and poor satellite coverage may reduce accuracy.',
              'You are responsible for your own safety during physical navigation. Always be aware of your surroundings.',
              'You should not use the Service while operating a vehicle or in any situation where physical activity presents a hazard.',
            ]} />
          </Section>

          <Section title="9. Acceptable Use Policy">
            <P>You agree not to:</P>
            <UL items={[
              'Attempt to circumvent, cheat, or exploit any aspect of the gameplay, including GPS spoofing, answer brute-forcing, or coordinate sharing.',
              'Use automated tools, bots, or scripts to interact with the Service.',
              'Interfere with, disrupt, or attempt to gain unauthorised access to our servers, databases, or infrastructure.',
              'Reverse-engineer, decompile, or extract source code, algorithms, or database content from the Service.',
              'Use the Service for any unlawful purpose or in any way that could harm us, other users, or third parties.',
              'Create multiple accounts to circumvent per-person voucher limits.',
              'Upload, transmit, or distribute any malicious code or content.',
            ]} />
            <P>
              Violation of this policy may result in immediate account suspension and, where appropriate, referral
              to law enforcement.
            </P>
          </Section>

          <Section title="10. GPS Accuracy and Limitation of Liability">
            <P>
              The Service relies on GPS technology which is inherently imprecise. GeoFiction Labs Ltd makes no
              warranty that GPS coordinates will be accurate to any particular precision, and arrival confirmation
              relies on industry-standard geofencing with a defined radius.
            </P>
            <P>
              To the fullest extent permitted by applicable law, GeoFiction Labs Ltd shall not be liable for:
            </P>
            <UL items={[
              'Failure of a hunt to unlock or navigate correctly due to GPS inaccuracy, device limitations, or poor signal conditions.',
              'Any injury, loss, or damage arising from physical participation in a hunt, including navigation on public or private land.',
              'Loss of data, interrupted service, or failure of third-party infrastructure (Supabase, Vercel, Stripe).',
              'Loss of opportunity to claim a reward where GPS conditions prevent arrival confirmation.',
              'Any indirect, incidental, consequential, or punitive damages arising from use of the Service.',
            ]} />
            <P>
              Nothing in these terms excludes or limits liability for death or personal injury caused by our negligence,
              fraud or fraudulent misrepresentation, or any other liability that cannot be excluded by law.
            </P>
            <P>
              Our total aggregate liability to you in respect of all claims arising under or in connection with
              these terms shall not exceed the amount paid by you (if any) to GeoFiction Labs Ltd in the 12 months
              preceding the claim.
            </P>
          </Section>

          <Section title="11. Intellectual Property">
            <P>
              All content, branding, software, puzzle questions, and design elements within the Service are the
              intellectual property of GeoFiction Labs Ltd or our licensors. You may not reproduce, redistribute,
              or create derivative works from any part of the Service without our prior written consent.
            </P>
            <P>
              Film titles, characters, and related intellectual property referenced in puzzle questions remain the
              property of their respective rights holders. MapTheMovie is an independent product not affiliated with
              or endorsed by any film studio or rights holder.
            </P>
          </Section>

          <Section title="12. Availability and Changes">
            <P>
              We reserve the right to modify, suspend, or discontinue the Service (or any part of it) at any
              time with or without notice. We will endeavour to provide reasonable notice of material changes.
              GeoFiction Labs Ltd shall not be liable to you or any third party for any modification, suspension,
              or discontinuation of the Service.
            </P>
          </Section>

          <Section title="13. Third-Party Links and Services">
            <P>
              The Service may contain links to third-party websites or services. These links are provided for
              convenience only. GeoFiction Labs Ltd has no control over third-party content and accepts no
              responsibility for it. Use of third-party services is governed by their respective terms and
              privacy policies.
            </P>
          </Section>

          <Section title="14. Termination">
            <P>
              Either party may terminate these terms at any time. You may stop using the Service at any time.
              We may suspend or terminate your access immediately if you breach these terms, engage in fraudulent
              activity, or where required by law.
            </P>
            <P>
              On termination, all licences granted to you cease immediately. Sections 10, 11, 15, and 16 survive
              termination.
            </P>
          </Section>

          <Section title="15. Governing Law and Dispute Resolution">
            <P>
              These Terms of Service are governed by and construed in accordance with the laws of England and Wales.
              You and GeoFiction Labs Ltd both agree to submit to the exclusive jurisdiction of the courts of
              England and Wales for the resolution of any disputes arising under or in connection with these terms.
            </P>
            <P>
              If you have a dispute with us, please contact us first at hello@geofictionlabs.com. We will make
              reasonable efforts to resolve disputes informally before either party initiates formal proceedings.
            </P>
          </Section>

          <Section title="16. Changes to These Terms">
            <P>
              We may revise these Terms of Service at any time. Material changes will be notified via the Service
              or by email. The date at the top of this page indicates when the terms were last updated. Continued
              use of the Service after changes take effect constitutes acceptance of the revised terms.
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
            <P>
              <a href="/privacy" style={{ color: '#7C3AED', textDecoration: 'none', fontSize: 14 }}>
                Privacy Policy
              </a>
            </P>
          </div>
        </div>
      </div>
    </>
  )
}
