import { useState } from 'react';
import { loginUser } from '../api/auth';
import { useApp } from '../context/AppContext';
import { Button, ErrorMessage, Field, Modal, inputClass } from './ui';
import { validateEmail } from '../utils/validation';

export default function LoginModal({ onClose, onSwitchToRegister }) {
  const { login, notify } = useApp();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const nextErrors = {
      email: validateEmail(form.email),
      password: form.password ? '' : 'Enter your password',
    };
    setErrors(nextErrors);
    if (nextErrors.email || nextErrors.password) return;

    setError('');
    setLoading(true);
    try {
      const { access_token } = await loginUser(form);
      const user = await login(access_token);
      notify(`Welcome back, ${user.username}!`, 'win');
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Login" onClose={onClose}>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <Field label="Email" error={errors.email}>
          {(props) => (
            <input {...props} name="email" type="email" autoComplete="email" className={inputClass} value={form.email} onChange={handleChange} maxLength={254} />
          )}
        </Field>
        <Field label="Password" error={errors.password}>
          {(props) => (
            <input {...props} name="password" type="password" autoComplete="current-password" className={inputClass} value={form.password} onChange={handleChange} maxLength={72} />
          )}
        </Field>
        <ErrorMessage>{error}</ErrorMessage>
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Logging in...' : 'Login'}
        </Button>
        <p className="m-0 text-center text-xs text-dim">
          No account yet?{' '}
          <button type="button" className="cursor-pointer border-0 bg-transparent p-0 font-mono text-xs text-accent underline" onClick={onSwitchToRegister}>
            Register
          </button>
        </p>
      </form>
    </Modal>
  );
}
