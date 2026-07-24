import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { localDb } from '@/integrations/local-db/client';
import { updatePasswordSchema } from '@/lib/schemas/auth';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    localDb.auth.getSession().then(({ data }) => {
      if (data?.session || user) {
        setReady(true);
      } else {
        navigate('/login');
      }
    });
  }, [navigate, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = updatePasswordSchema.safeParse({ currentPassword, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || 'Invalid password');
      return;
    }

    setError('');
    setLoading(true);
    const { error } = await localDb.auth.updateUser({
      currentPassword: parsed.data.currentPassword,
      password: parsed.data.password,
    });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess(true);
  };

  if (!ready) {
    return null;
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center animate-fade-in">
          <h1 className="text-xl font-bold text-foreground">Password updated</h1>
          <p className="mt-2 text-sm text-muted-foreground">Your local desktop password has been changed successfully.</p>
          <button onClick={() => navigate('/')} className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-bold text-foreground">Set New Password</h1>
          <p className="mt-1 text-sm text-muted-foreground">This updates your local desktop account.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div role="alert" aria-live="polite" className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="reset-current-password" className="mb-1.5 block text-xs font-medium text-foreground">Current Password</label>
            <input
              id="reset-current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label htmlFor="reset-new-password" className="mb-1.5 block text-xs font-medium text-foreground">New Password</label>
            <input
              id="reset-new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              placeholder="Min 8 characters"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
