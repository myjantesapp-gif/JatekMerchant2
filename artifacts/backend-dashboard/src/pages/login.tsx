import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useBackendLogin } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { UtensilsCrossed, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { BACKEND_TOKEN_KEY, consumeBackendSessionExpiredMessage } from "@/lib/session";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const loginMutation = useBackendLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!consumeBackendSessionExpiredMessage()) return;
    toast({
      title: "Session expirée",
      description: "Votre compte a été désactivé ou votre session a expiré. Veuillez vous reconnecter.",
      variant: "destructive",
    });
  }, [toast]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    loginMutation.mutate(
      { data: { email, password } },
      {
        onSuccess: (data) => {
          localStorage.setItem(BACKEND_TOKEN_KEY, data.token);
          setLocation("/");
        },
        onError: (err) => {
          toast({
            title: "Login failed",
            description: err.message || "Invalid credentials",
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Decorative background blob */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-[120px] pointer-events-none" />

      <Card className="w-full max-w-md shadow-2xl border-primary/10 relative z-10">
        <CardHeader className="space-y-3 pb-6 text-center">
          <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30 mb-4">
            <UtensilsCrossed className="h-8 w-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-3xl font-black tracking-tight text-foreground">Jatek Staff</CardTitle>
          <CardDescription className="text-base">
            Log in to manage operations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@jatek.ma"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 border-input focus:border-primary focus:ring-primary"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-12 border-input focus:border-primary focus:ring-primary"
              />
            </div>
            <Button
              type="submit"
              className="w-full h-12 text-base font-bold mt-2 shadow-lg shadow-primary/20"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
