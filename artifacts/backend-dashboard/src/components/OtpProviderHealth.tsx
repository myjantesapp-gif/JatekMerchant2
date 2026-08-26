import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck, RefreshCw, Loader2, AlertTriangle, CheckCircle2, XCircle, MinusCircle } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

type ProviderStatus = "ok" | "misconfigured" | "not_configured" | "error";

interface ProviderResult {
  status?: ProviderStatus;
  notes?: string[];
  note?: string;
  error?: string;
  [key: string]: unknown;
}

interface DiagnosticResponse {
  ok: boolean;
  providers: {
    twilio?: ProviderResult;
    twilioVerify?: ProviderResult;
    infobip?: ProviderResult;
    resend?: ProviderResult;
  };
}

// ── Provider display config ────────────────────────────────────────────────────

const PROVIDERS: { key: keyof DiagnosticResponse["providers"]; label: string; description: string }[] = [
  { key: "twilioVerify", label: "Twilio Verify", description: "OTP par SMS / WhatsApp (Verify API)" },
  { key: "twilio",       label: "Twilio direct", description: "SMS direct sans Verify" },
  { key: "infobip",      label: "Infobip",        description: "WhatsApp via Infobip" },
  { key: "resend",       label: "Resend",          description: "OTP par e-mail" },
];

// ── Status badge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ProviderStatus | undefined }) {
  if (!status || status === "not_configured") {
    return (
      <Badge variant="secondary" className="flex items-center gap-1 text-xs">
        <MinusCircle className="h-3 w-3" />
        Non configuré
      </Badge>
    );
  }
  if (status === "ok") {
    return (
      <Badge className="flex items-center gap-1 text-xs bg-green-100 text-green-800 border-green-200 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
        <CheckCircle2 className="h-3 w-3" />
        OK
      </Badge>
    );
  }
  if (status === "misconfigured") {
    return (
      <Badge variant="outline" className="flex items-center gap-1 text-xs border-amber-400 text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-700">
        <AlertTriangle className="h-3 w-3" />
        Mal configuré
      </Badge>
    );
  }
  // error
  return (
    <Badge variant="destructive" className="flex items-center gap-1 text-xs">
      <XCircle className="h-3 w-3" />
      Erreur
    </Badge>
  );
}

// ── Notes list ────────────────────────────────────────────────────────────────

function ProviderNotes({ result }: { result: ProviderResult }) {
  const notes: string[] = [];
  if (result.notes && Array.isArray(result.notes)) notes.push(...result.notes);
  if (result.note && typeof result.note === "string") notes.push(result.note);
  if (result.error && typeof result.error === "string") notes.push(result.error);
  if (notes.length === 0) return null;
  return (
    <ul className="mt-1 space-y-0.5">
      {notes.map((n, i) => (
        <li key={i} className="text-xs text-muted-foreground leading-snug">
          • {n}
        </li>
      ))}
    </ul>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function OtpProviderHealth() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<DiagnosticResponse>({
    queryKey: ["/api/auth/otp-diagnostic"],
    queryFn: () => apiFetch("/api/auth/otp-diagnostic"),
    // Don't retry on 403/401 — means not super_admin
    retry: (count, err: any) => {
      if (err?.message?.includes("403") || err?.message?.includes("401")) return false;
      return count < 2;
    },
    staleTime: 60_000,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Fournisseurs OTP</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-7 px-2"
          >
            {isFetching
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <RefreshCw className="h-3.5 w-3.5" />}
            <span className="sr-only">Actualiser</span>
          </Button>
        </div>
        <CardDescription>
          État des fournisseurs d'envoi de codes OTP (SMS, WhatsApp, e-mail).
          Aucune valeur de secret n'est affichée.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Diagnostic en cours…
          </div>
        )}

        {isError && (
          <div className="flex items-center gap-2 text-sm text-destructive py-2">
            <XCircle className="h-4 w-4" />
            {(error as any)?.message ?? "Impossible de charger le diagnostic"}
          </div>
        )}

        {data && (
          <div className="divide-y">
            {PROVIDERS.map(({ key, label, description }) => {
              const result = data.providers[key];
              const status: ProviderStatus = result?.status ?? "not_configured";
              return (
                <div key={key} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{label}</div>
                      <div className="text-xs text-muted-foreground">{description}</div>
                      {result && <ProviderNotes result={result} />}
                    </div>
                    <StatusBadge status={status} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
