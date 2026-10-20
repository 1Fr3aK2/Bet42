import { useApp } from '../context/AppContext';
import { Button, Card } from './ui';

// Shows the page only to logged-in users (and, with `roles`, only to those
// roles). The API enforces the same rules: this only hides what the user
// could not use anyway.
export default function RequireRole({ roles, onLoginRequest, children }) {
  const { user } = useApp();

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-20">
        <Card title="Login required">
          <p className="m-0 mb-4 text-sm text-dim">You need to be logged in to see this page.</p>
          <Button onClick={onLoginRequest}>Log in</Button>
        </Card>
      </div>
    );
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <div className="mx-auto max-w-md px-4 py-20">
        <Card title="Access denied">
          <p className="m-0 text-sm text-dim">
            This page is only available to {roles.map((r) => r.toLowerCase()).join(' and ')} accounts.
          </p>
        </Card>
      </div>
    );
  }

  return children;
}
