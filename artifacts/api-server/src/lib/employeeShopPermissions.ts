export type EmployeeCloseTime = {
  dayOfWeek: number;
  closeTime: string;
};

type CloseTimesResult =
  | { ok: true; hours: EmployeeCloseTime[] }
  | { ok: false; error: string };

const closeTimePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function parseEmployeeCloseTimes(body: unknown): CloseTimesResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Les employés peuvent uniquement modifier les heures de fermeture." };
  }
  const record = body as Record<string, unknown>;
  if (Object.keys(record).some((key) => key !== "hours") || !Array.isArray(record.hours) || record.hours.length === 0) {
    return { ok: false, error: "Les employés peuvent uniquement modifier les heures de fermeture." };
  }

  const seenDays = new Set<number>();
  const hours: EmployeeCloseTime[] = [];
  for (const value of record.hours) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { ok: false, error: "Chaque horaire doit contenir un jour valide et une heure de fermeture au format HH:MM." };
    }
    const hour = value as Record<string, unknown>;
    const dayOfWeek = hour.dayOfWeek;
    const closeTime = hour.closeTime;
    if (Object.keys(hour).some((key) => key !== "dayOfWeek" && key !== "closeTime")
      || typeof dayOfWeek !== "number" || !Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6
      || typeof closeTime !== "string" || !closeTimePattern.test(closeTime)
      || seenDays.has(dayOfWeek)) {
      return { ok: false, error: "Chaque horaire doit contenir un jour valide et une heure de fermeture au format HH:MM." };
    }
    seenDays.add(dayOfWeek);
    hours.push({ dayOfWeek, closeTime });
  }

  return { ok: true, hours };
}

export function employeeMayCloseShop(body: unknown): boolean {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const record = body as Record<string, unknown>;
  return Object.keys(record).length === 1 && record.isOpen === false;
}

export function validateCancellationReason(status: string, reason?: string) {
  if (reason && status !== "cancelled") {
    return { ok: false as const, error: "Un motif de refus n'est accepté que pour l'annulation d'une commande." };
  }
  return { ok: true as const, reason };
}