import { useState } from 'react';
import { Link } from 'react-router-dom';
import { checkAvailability, registerUser } from '../api/users';
import { loginUser } from '../api/auth';
import { useApp } from '../context/AppContext';
import { Button, ErrorMessage, Field, Modal, inputClass } from './ui';
import { validateEmail, validatePassword, validateUsername } from '../utils/validation';

export default function RegisterModal({ onClose, onSwitchToLogin }) {
  const { login, notify } = useApp();
  const [form, setForm] = useState({ username: '', email: '', password: '', confirmPassword: '', accept: false });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const nextErrors = {
      username: validateUsername(form.username),
      email: validateEmail(form.email),
      password: validatePassword(form.password),
      confirmPassword: form.password === form.confirmPassword ? '' : 'Passwords do not match',
      accept: form.accept ? '' : 'You must accept the terms to create an account',
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setError('');
    setLoading(true);
    try {
      // Check uniqueness first, so a taken name is a field error, not a failed request.
      const available = await checkAvailability(form);
      if (!available.username || !available.email) {
        setErrors({
          username: available.username ? '' : 'This username is already taken',
          email: available.email ? '' : 'An account already uses this email',
        });
        return;
      }

      await registerUser(form);

      // Registration doesn't return a token, so log in right after
      // with the same credentials to get a real session going.
      const { access_token } = await loginUser({ email: form.email, password: form.password });
      const user = await login(access_token);

      notify(`Welcome, ${user.username}! You received ${user.wallet.toLocaleString('en-US')} T$ to start.`, 'win');
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Register" onClose={onClose}>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <Field label="Username" error={errors.username} hint="3-20 characters: letters, numbers or _">
          {(props) => (
            <input {...props} name="username" autoComplete="username" className={inputClass} value={form.username} onChange={handleChange} maxLength={20} />
          )}
        </Field>
        <Field label="Email" error={errors.email}>
          {(props) => (
            <input {...props} name="email" type="email" autoComplete="email" className={inputClass} value={form.email} onChange={handleChange} maxLength={254} />
          )}
        </Field>
        <Field label="Password" error={errors.password} hint="8-72 characters with at least one letter and one number">
          {(props) => (
            <input {...props} name="password" type="password" autoComplete="new-password" className={inputClass} value={form.password} onChange={handleChange} maxLength={72} />
          )}
        </Field>
        <Field label="Confirm password" error={errors.confirmPassword}>
          {(props) => (
            <input {...props} name="confirmPassword" type="password" autoComplete="new-password" className={inputClass} value={form.confirmPassword} onChange={handleChange} maxLength={72} />
          )}
        </Field>
        <div className="flex flex-col gap-1">
          <label className="flex items-start gap-2 text-xs text-dim">
            <input
              type="checkbox"
              name="accept"
              className="mt-0.5"
              checked={form.accept}
              aria-invalid={Boolean(errors.accept)}
              onChange={handleChange}
            />
            <span>
              I am at least 18 years old and I accept the{' '}
              <Link to="/terms" className="text-accent" onClick={onClose}>Terms of Service</Link> and the{' '}
              <Link to="/privacy" className="text-accent" onClick={onClose}>Privacy Policy</Link>.
            </span>
          </label>
          {errors.accept && <span className="text-xs text-down">{errors.accept}</span>}
        </div>
        <ErrorMessage>{error}</ErrorMessage>
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Registering...' : 'Create account'}
        </Button>
        <p className="m-0 text-center text-xs text-dim">
          Already registered?{' '}
          <button type="button" className="cursor-pointer border-0 bg-transparent p-0 font-mono text-xs text-accent underline" onClick={onSwitchToLogin}>
            Login
          </button>
        </p>
      </form>
    </Modal>
  );
}
