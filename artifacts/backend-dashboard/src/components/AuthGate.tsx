import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useBackendMe } from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";
import {
  BACKEND_SESSION_EXPIRED_EVENT,
  BACKEND_TOKEN_KEY,
  endBackendSession,
  isUnauthorizedError,
} from "@/lib/session";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const [tokenChecked, setTokenChecked] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem(BACKEND_TOKEN_KEY);
    if (!token) {
      setLocation("/login");
    }
    setTokenChecked(true);
  }, [setLocation]);

  const { data: me, isLoading, error } = useBackendMe({
    query: {
      queryKey: ["/api/backend/me"],
      enabled: tokenChecked && !!localStorage.getItem(BACKEND_TOKEN_KEY),
      retry: false,
    },
  });

  useEffect(() => {
    const redirectAfterSessionExpiry = () => {
      setLocation("/login");
    };
    window.addEventListener(BACKEND_SESSION_EXPIRED_EVENT, redirectAfterSessionExpiry);
    return () => window.removeEventListener(BACKEND_SESSION_EXPIRED_EVENT, redirectAfterSessionExpiry);
  }, [setLocation]);

  useEffect(() => {
    if (isUnauthorizedError(error)) endBackendSession();
  }, [error]);

  // Keep a user-scoped stream open for the whole authenticated dashboard,
  // rather than only on feature pages such as Live Tracking. The terminal
  // event is needed because native EventSource does not expose a 401 after a
  // stream has already been established.
  useEffect(() => {
    const userId = me?.user?.id;
    const token = localStorage.getItem(BACKEND_TOKEN_KEY);
    if (!userId || !token) return;

    const stream = new EventSource(
      `/api/events?channels=user:${userId}&token=${encodeURIComponent(token)}`,
    );
    const expire = () => {
      stream.close();
      endBackendSession(token);
    };
    stream.addEventListener("session_expired", expire);
    return () => {
      stream.removeEventListener("session_expired", expire);
      stream.close();
    };
  }, [me?.user?.id]);

  if (!tokenChecked || isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background p-6 text-center text-muted-foreground">
        Impossible de vérifier votre session. Vérifiez votre connexion puis actualisez la page.
      </div>
    );
  }

  if (!me) {
    return null;
  }

  return <>{children}</>;
}
