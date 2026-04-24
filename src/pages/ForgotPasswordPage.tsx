import { Link } from 'react-router-dom';

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-bold text-foreground">Password Reset</h1>
          <p className="mt-1 text-sm text-muted-foreground">The offline desktop build does not send email reset links.</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          Sign in with your current local password, then change it from <strong className="text-foreground">Settings</strong>.
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/login" className="font-medium text-accent hover:underline">Back to Sign In</Link>
        </p>
      </div>
    </div>
  );
}
