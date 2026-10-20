import { Link } from 'react-router-dom';
import LegalLayout from './LegalLayout';

const REPO_URL = 'https://github.com/dsteiger42/Transcendence';

const sections = [
  {
    id: 'acceptance',
    title: 'Acceptance of these terms',
    body: (
      <p>
        By creating an account or using Transcendence you agree to these Terms of Service and to the{' '}
        <Link className="text-accent" to="/privacy">Privacy Policy</Link>. If you do not agree, do not use the service.
      </p>
    ),
  },
  {
    id: 'service',
    title: 'What Transcendence is',
    body: (
      <>
        <p>
          Transcendence is an educational simulation made by students of 42 school. Players predict whether the price
          of a cryptocurrency will be higher or lower after a short period, using a virtual currency.
        </p>
        <p>
          <strong>It is not a gambling service and no real money is involved.</strong> Nothing on the website is
          financial or investment advice, and results in the game say nothing about real trading.
        </p>
      </>
    ),
  },
  {
    id: 'eligibility',
    title: 'Who can use it',
    body: (
      <ul>
        <li>You must be at least 18 years old.</li>
        <li>One account per person. Accounts are personal and cannot be sold, shared or transferred.</li>
      </ul>
    ),
  },
  {
    id: 'account',
    title: 'Your account',
    body: (
      <ul>
        <li>Give a valid email address and keep your password secret. You are responsible for what happens under your account.</li>
        <li>Usernames must not impersonate other people or be offensive; moderators may ask you to change them.</li>
        <li>If you think someone else has access to your account, change your password in Settings immediately.</li>
      </ul>
    ),
  },
  {
    id: 'currency',
    title: 'The T$ virtual currency',
    body: (
      <ul>
        <li>Every new account receives <strong>1,000 T$</strong>. You can earn more by winning bets and by claiming the daily bonus.</li>
        <li>T$ has <strong>no monetary value</strong>. It cannot be bought, sold, exchanged, transferred to another player or withdrawn.</li>
        <li>Administrators may correct a balance (for example after a bug or abuse). Every correction is recorded in the wallet history.</li>
        <li>Because this is a student project, the whole game (balances included) may be reset.</li>
      </ul>
    ),
  },
  {
    id: 'rules',
    title: 'Game rules',
    body: (
      <>
        <ul>
          <li>Choose a coin (<strong>BTC or ETH</strong>, priced in euros), a direction (<strong>UP or DOWN</strong>), an amount between <strong>1 and 100,000 T$</strong> (never more than your balance) and a duration (<strong>1 or 5 minutes</strong>).</li>
          <li>The <strong>entry price</strong> is the latest Kraken price received by our server when it accepts your bet. The amount is taken from your balance at that moment.</li>
          <li>When the duration ends, the server compares the <strong>exit price</strong> (latest price at expiry) with the entry price: <strong>UP wins</strong> if the price is higher, <strong>DOWN wins</strong> if it is lower.</li>
          <li>A winning bet pays <strong>1.85 × the stake</strong> (stake included, rounded down to a whole T$). A losing bet pays nothing.</li>
          <li>If the exit price is exactly equal to the entry price, the stake is <strong>refunded</strong>.</li>
          <li>If live prices are unavailable for more than 2 minutes after a bet expires, the bet is refunded.</li>
          <li>You can have up to <strong>10 open bets</strong> at the same time and place up to 20 bets per minute.</li>
          <li>Bets are final: once accepted they cannot be cancelled or changed.</li>
          <li>The prices recorded by our server are the reference for every result, even if another exchange or website shows slightly different prices.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'rewards',
    title: 'Levels, achievements and bonuses',
    body: (
      <p>
        XP, levels, achievements, streaks and the daily bonus are game features with no monetary value. Their rules are
        described on the Rewards page. We may adjust them, and we may remove rewards obtained through cheating or bugs.
      </p>
    ),
  },
  {
    id: 'community',
    title: 'Community rules',
    body: (
      <>
        <p>In the forum and anywhere you can write text, do not post:</p>
        <ul>
          <li>harassment, threats, hate speech or insults;</li>
          <li>scams, promises of guaranteed profit, requests for money or crypto;</li>
          <li>spam, advertising or links to external promotions;</li>
          <li>illegal content or other people&apos;s personal data.</li>
        </ul>
        <p>
          Content is checked by automatic moderation when it is published: it can be rejected or held for a moderator.
          Players can report content, and moderators can approve or remove it.
        </p>
      </>
    ),
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable use',
    body: (
      <ul>
        <li>Do not cheat: no bots or scripts placing bets, no multiple accounts, no exploiting bugs. Report bugs to the team instead.</li>
        <li>Do not attack or overload the service, try to access other accounts, or bypass the firewall and rate limits.</li>
        <li>The public administration API may only be used with an API key given by the administrators.</li>
      </ul>
    ),
  },
  {
    id: 'content',
    title: 'Content you post',
    body: (
      <p>
        You keep the rights to what you write. By posting it you allow us to store it and show it to other players
        inside Transcendence. You are responsible for your content, and it is deleted when you delete your account.
      </p>
    ),
  },
  {
    id: 'enforcement',
    title: 'Suspension and termination',
    body: (
      <>
        <p>
          If you break these terms, we may remove your content, reset your balance or rewards, change your role, or
          delete your account.
        </p>
        <p>
          You can delete your account at any time in Settings → Security → Delete account. Deletion is permanent and
          also removes your bets, wallet history, achievements, posts and comments.
        </p>
      </>
    ),
  },
  {
    id: 'availability',
    title: 'Availability and liability',
    body: (
      <p>
        Transcendence is provided &quot;as is&quot;, without any warranty. It may be unavailable, contain errors or be
        reset, and prices may be delayed. To the extent permitted by law, the team is not liable for any loss related to
        the use of the service, which has no real-money value.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes and applicable law',
    body: (
      <>
        <p>
          We may update these terms. The date at the top shows the current version; continuing to use the service after
          a change means you accept it. These terms are governed by Portuguese law.
        </p>
        <p>
          Questions: contact the team through the project repository (
          <a className="text-accent" href={REPO_URL} target="_blank" rel="noreferrer">{REPO_URL}</a> ).
        </p>
      </>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Service"
      intro="These terms explain the rules for using Transcendence: who can play, how the virtual currency and the bets work, and what is not allowed."
      sections={sections}
      otherLink={{ to: '/privacy', label: 'Privacy Policy' }}
    />
  );
}
