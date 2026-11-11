import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api, clearAuthSession, getStoredUser, setAuthSession } from '../lib/api';

type ProtectedRouteProps = {
  children: ReactNode;
  allowedRoles?: string[];
};

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const validate = async () => {
      const token = localStorage.getItem('sieuechxanh-token');
      const storedUser = getStoredUser();

      if (!token || !storedUser) {
        if (!cancelled) {
          setIsAuthorized(false);
          setIsChecking(false);
        }
        return;
      }

      try {
        const response = await api.get('/auth/me');
        const user = response.data;

        if (allowedRoles && !allowedRoles.includes(user.role)) {
          throw new Error('role-mismatch');
        }

        if (allowedRoles?.includes('HOST') && user.role === 'HOST' && user.hostApplication?.status !== 'APPROVED') {
          throw new Error('host-not-approved');
        }

        setAuthSession(token, user);

        if (!cancelled) {
          setIsAuthorized(true);
        }
      } catch {
        clearAuthSession();
        if (!cancelled) {
          setIsAuthorized(false);
        }
      } finally {
        if (!cancelled) {
          setIsChecking(false);
        }
      }
    };

    void validate();

    return () => {
      cancelled = true;
    };
  }, [allowedRoles, location.pathname]);

  if (isChecking) {
    return <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">Đang kiểm tra quyền truy cập...</div>;
  }

  if (!isAuthorized) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
