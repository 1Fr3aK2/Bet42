import LegalLayout from './LegalLayout';

const REPO_URL = 'https://github.com/dsteiger42/Transcendence';

const sections = [
  {
    id: 'who-we-are',
    title: 'Who we are',
    body: (
      <>
        <p>
          Transcendence is a student web application built by a team of five students of 42 school as their final
          Common Core project. It lets players predict whether the price of Bitcoin or Ethereum will go up or down,
          using <strong>T$</strong>, a virtual currency with no real-money value.
        </p>
        <p>
          The project team is the data controller for the personal data processed by this website. You can contact
          us through the project repository ({' '}
          <a className="text-accent" href={REPO_URL} target="_blank" rel="noreferrer">{REPO_URL}</a> ).
        </p>
      </>
    ),
  },
  {
    id: 'data-we-collect',
    title: 'Data we collect',
    body: (
      <>
        <p>We only collect what the service needs to work:</p>
        <ul>
          <li><strong>Account data</strong>: username, email address and password. The password is never stored: we keep only a salted bcrypt hash.</li>
          <li><strong>Profile</strong>: the avatar image you upload (optional) and your role (user, moderator or administrator).</li>
          <li><strong>Game activity</strong>: every bet (coin, direction, amount, duration, entry and exit prices, result), your wallet history (stakes, payouts, refunds, daily bonuses, administrator corrections), XP, level, streaks and achievements.</li>
          <li><strong>Forum content</strong>: posts, comments and reports you write, and the moderation decisions about them.</li>
          <li><strong>Technical data</strong>: IP address, browser user agent, requested URLs, timestamps and errors, recorded in server and firewall (WAF) logs for security and troubleshooting.</li>
          <li><strong>Browser storage</strong>: your session token and a copy of your profile are kept in your browser&apos;s local storage while you are logged in.</li>
        </ul>
        <p>We do not collect payment details, real names, addresses, phone numbers or location data.</p>
      </>
    ),
  },
  {
    id: 'why',
    title: 'Why we use it',
    body: (
      <ul>
        <li><strong>To provide the service</strong> (GDPR art. 6(1)(b), contract): creating your account, logging you in, recording and settling your bets, keeping your balance, showing your statistics, rewards and ranking.</li>
        <li><strong>To keep the service safe</strong> (art. 6(1)(f), legitimate interest): rate limiting, blocking attacks with the web application firewall, preventing cheating and abuse, investigating incidents.</li>
        <li><strong>To moderate the community</strong> (art. 6(1)(f)): checking forum content against the community rules.</li>
        <li><strong>To run the platform</strong> (art. 6(1)(f)): aggregated statistics (number of bets, volume, active players) shown to administrators.</li>
      </ul>
    ),
  },
  {
    id: 'public',
    title: 'What other players can see',
    body: (
      <>
        <p>Some information is public by design, because the game is competitive and social:</p>
        <ul>
          <li>Your <strong>username, avatar, level, XP, T$ balance, wins, losses, win rate and best streak</strong> appear on the public leaderboard and on your public profile page.</li>
          <li>Your <strong>unlocked achievements</strong> and your <strong>last settled bets</strong> appear on your public profile.</li>
          <li>When you place a bet, the <strong>live activity feed</strong> shows your username, the coin, direction, amount, duration and result to everyone online.</li>
          <li>Your <strong>forum posts and comments</strong> are visible to logged-in players.</li>
        </ul>
        <p>Your email address is never shown to other players. Only administrators can see it.</p>
      </>
    ),
  },
  {
    id: 'automated',
    title: 'Automated decisions',
    body: (
      <p>
        Forum posts and comments are analysed automatically when you publish them. Content with a high risk score
        (for example scams, spam or abusive language) is rejected, and borderline content is held until a moderator
        approves or removes it. You can always ask a moderator to review a decision. Bets are settled automatically by
        the server using the live market price, following the rules in the Terms of Service.
      </p>
    ),
  },
  {
    id: 'sharing',
    title: 'Who we share it with',
    body: (
      <>
        <p>
          <strong>Nobody.</strong> We do not sell or rent your data, we do not show advertising and we do not use
          third-party trackers or analytics.
        </p>
        <p>
          Cryptocurrency prices come from the Kraken exchange (and CoinGecko for longer price history). Our server
          connects to them to receive prices; none of your personal data is sent to these services. The whole
          application, including its database, logs and monitoring, runs on the team&apos;s own Docker infrastructure.
        </p>
      </>
    ),
  },
  {
    id: 'security',
    title: 'How we protect it',
    body: (
      <ul>
        <li>All connections use HTTPS (TLS 1.2 or 1.3).</li>
        <li>Passwords are hashed and salted with bcrypt; secrets such as database passwords and signing keys are stored in HashiCorp Vault.</li>
        <li>A web application firewall (ModSecurity with the OWASP Core Rule Set) filters requests, and login attempts are rate limited.</li>
        <li>Access to administration and moderation tools is restricted by role, and every balance correction is recorded.</li>
      </ul>
    ),
  },
  {
    id: 'retention',
    title: 'How long we keep it',
    body: (
      <ul>
        <li><strong>Account, bets, wallet history, achievements and forum content</strong>: until you delete your account. They are then deleted immediately.</li>
        <li><strong>Server and firewall logs</strong>: 14 days, then deleted automatically.</li>
        <li><strong>Database backups</strong>: 7 days. Data you delete therefore disappears from the backups within 7 days.</li>
        <li><strong>Moderation log entries</strong>: kept to document moderation decisions; if a moderator deletes their account, their name is removed from the entries.</li>
      </ul>
    ),
  },
  {
    id: 'rights',
    title: 'Your rights',
    body: (
      <>
        <p>Under the GDPR you have the right to:</p>
        <ul>
          <li><strong>Access</strong> your data: your profile, dashboard and wallet history are always available in the app.</li>
          <li><strong>Portability</strong>: export your bets as CSV, JSON or PDF from the Dashboard.</li>
          <li><strong>Rectification</strong>: change your username, avatar and password in Settings.</li>
          <li><strong>Erasure</strong>: delete your account and all associated data in Settings → Security → Delete account.</li>
          <li><strong>Restriction and objection</strong>: ask us to stop a specific processing.</li>
          <li><strong>Complain</strong> to a supervisory authority. In Portugal this is the Comissão Nacional de Proteção de Dados (CNPD, www.cnpd.pt).</li>
        </ul>
        <p>For anything you cannot do yourself in the app, contact the team as described in section 1.</p>
      </>
    ),
  },
  {
    id: 'cookies',
    title: 'Cookies and local storage',
    body: (
      <p>
        The website itself does not set cookies. It uses your browser&apos;s local storage only to keep you logged in
        (your session token) and to remember your profile between visits; both are removed when you log out. The
        monitoring tools used by administrators (Grafana and Kibana) set their own session cookies, but only for the
        administrators who log in to them.
      </p>
    ),
  },
  {
    id: 'age',
    title: 'Age requirement',
    body: (
      <p>
        Transcendence imitates a betting product, so it is meant for adults. You must be at least 18 years old to
        create an account. If we learn that an account belongs to a minor, we delete it.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    body: (
      <p>
        We may update this policy when the application changes. The date at the top shows the latest version. If a
        change affects how your data is used, we will announce it on the website before it applies.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      intro="This policy explains what personal data Transcendence collects, why, who can see it, how long it is kept and how you can control it."
      sections={sections}
      otherLink={{ to: '/terms', label: 'Terms of Service' }}
    />
  );
}
