import { Navigate } from 'react-router-dom';
import { useBusiness } from '@/contexts/BusinessContext';

export default function RequireBusiness({ children }: { children: React.ReactNode }) {
  const { business, loading } = useBusiness();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!business) return <Navigate to="/setup-business" replace />;

  return <>{children}</>;
}
