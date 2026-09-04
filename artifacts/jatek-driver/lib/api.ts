import { clearTokenIfMatches, getToken } from "./auth";
import { getApiTarget, getBaseUrl } from "./apiTarget";
import { isDeliveryCodeValid } from "./deliveryCode";

export type ApiError = { status: number; message: string; data?: unknown };

export function getErrorMessage(error: unknown, fallback = "Une erreur est survenue."): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  auth = true,
): Promise<T> {
  const target = await getApiTarget();
  const base = getBaseUrl(target);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init.headers as Record<string, string>) ?? {}),
  };
  let requestToken: string | null = null;
  if (auth) {
    requestToken = await getToken();
    if (requestToken) headers["Authorization"] = `Bearer ${requestToken}`;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });
    const text = await res.text();
    let data: unknown = null;
    if (text) {
      try { data = JSON.parse(text); } catch { data = text; }
    }
    if (!res.ok) {
      const message =
        (data && typeof data === "object" && "message" in data
          ? String((data as { message: unknown }).message)
          : data && typeof data === "object" && "error" in data
            ? String((data as { error: unknown }).error)
            : null) ?? `Request failed (${res.status})`;
      const err: ApiError = { status: res.status, message, data };
      if (res.status === 401) {
        await clearTokenIfMatches(requestToken);
      }
      throw err;
    }
    return data as T;
  } catch (e: any) {
    if (e?.name === "AbortError") {
      throw { status: 408, message: "La requête a expiré. Vérifiez votre connexion." } as ApiError;
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// ─────────────────── Common types ───────────────────

export type Role = "client" | "driver" | "admin";

export type Me = {
  id: string;
  phone: string;
  role: Role;
  fullName?: string | null;
  email?: string | null;
  driver?: DriverProfile | null;
};

export type DriverStatus = "pending" | "approved" | "rejected";
export type VehicleType = "scooter" | "moto" | "voiture" | "velo";

export type DriverProfile = {
  id: string;
  fullName: string;
  vehicleType: VehicleType;
  vehiclePlate: string;
  cin: string;
  licenseNumber: string;
  photoUrl?: string | null;
  status: DriverStatus;
  isOnline: boolean;
  rating?: number | null;
  totalDeliveries?: number;
};

export type DriverOnboardingPayload = {
  fullName: string;
  vehicleType: VehicleType;
  vehiclePlate: string;
  cin: string;
  licenseNumber: string;
  photoUrl?: string | null;
};

export type OrderStatus =
  | "pending"
  | "assigned"
  | "accepted"
  | "confirmed"
  | "preparing"
  | "ready"
  | "picked_up"
  | "arrived_pickup"
  | "driver_at_restaurant"
  | "en_route"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "unknown";

export type PaymentMethod = "cash" | "card" | "online";

export type OrderItem = {
  name: string;
  quantity: number;
  unitPrice?: number;
  options?: string | null;
};

export type Order = {
  id: string;
  driverId: string | null;
  code: string;
  status: OrderStatus;
  restaurantName: string;
  restaurantPhone: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  distanceKm: number;
  etaMinutes: number;
  items: OrderItem[];
  subtotalMad: number;
  deliveryFeeMad: number;
  priceMad: number;
  driverEarningsMad: number;
  tipMad: number;
  paymentMethod: PaymentMethod;
  deliveryCode: string;
  customerName: string;
  customerPhone: string;
  notes?: string | null;
  createdAt: string;
};

export type Promotion = {
  id: string;
  title: string;
  description: string;
  bonusMad: number;
  required: number;
  progress: number;
  expiresAt: string;
};

export type EarningsSummary = {
  todayMad: number;
  weekMad: number;
  monthMad: number;
  todayDeliveries: number;
  weekDeliveries: number;
  monthDeliveries: number;
  todayTipsMad: number;
  weekTipsMad: number;
  totalDeliveries: number;
};

// ─────────────────── Backend API types (raw) ───────────────────

type BackendDriver = {
  id: number;
  userId: number;
  name?: string;
  phone?: string;
  vehicleType?: string;
  vehiclePlate?: string;
  nationalId?: string;
  licenseNumber?: string;
  photoUrl?: string;
  profileCompletedAt?: string;
  isAvailable?: boolean;
  totalDeliveries?: number;
  rating?: number;
  latitude?: number;
  longitude?: number;
};

type BackendOrderItem = {
  id: number;
  menuItemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

type BackendOrder = {
  id: number;
  reference?: string;
  userId: number;
  restaurantId: number;
  driverId?: number;
  restaurantName: string;
  userName: string;
  status: string;
  subtotal: number;
  deliveryFee: number;
  discountAmount: number;
  currency?: string;
  vatRate?: number;
  vatAmount?: number;
  serviceFee?: number;
  commissionRate?: number;
  merchantEarning?: number;
  driverEarning?: number;
  jatekEarning?: number;
  pricingVersion?: string;
  total: number;
  deliveryAddress: string;
  notes?: string;
  estimatedDeliveryTime?: number;
  pickupCode?: string;
  isContactless?: boolean;
  createdAt: string;
  items?: BackendOrderItem[];
  restaurant?: { phone?: string; address?: string; latitude?: number; longitude?: number };
  user?: { phone?: string; name?: string };
  pickupLat?: number | null;
  pickupLng?: number | null;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
};

type BackendMe = {
  id: number;
  phone?: string;
  email?: string;
  name?: string;
  role?: string;
  driver?: BackendDriver;
};

function mapDriver(d: BackendDriver): DriverProfile {
  return {
    id: String(d.id),
    fullName: d.name ?? "",
    vehicleType: (d.vehicleType as VehicleType) ?? "scooter",
    vehiclePlate: d.vehiclePlate ?? "",
    cin: d.nationalId ?? "",
    licenseNumber: d.licenseNumber ?? "",
    photoUrl: d.photoUrl ?? null,
    status: d.profileCompletedAt ? "approved" : "pending",
    isOnline: d.isAvailable ?? false,
    rating: d.rating ?? null,
    totalDeliveries: d.totalDeliveries ?? 0,
  };
}

function toFiniteCoordinate(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function mapOrder(o: BackendOrder): Order {
  const driverEarnings = o.driverEarning ?? o.deliveryFee ?? 0;
  const items: OrderItem[] = (o.items ?? []).map((i) => ({
    name: i.menuItemName,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
  }));
  const distanceKm = o.estimatedDeliveryTime
    ? Math.max(0.5, (o.estimatedDeliveryTime / 60) * 20)
    : 2.5;
  // Coordinates must be supplied by the API. Never invent a destination from
  // the restaurant position: that would send a driver to the wrong address.
  const pickupLat = toFiniteCoordinate(o.pickupLat) ?? toFiniteCoordinate(o.restaurant?.latitude);
  const pickupLng = toFiniteCoordinate(o.pickupLng) ?? toFiniteCoordinate(o.restaurant?.longitude);
  const dropoffLat = toFiniteCoordinate(o.dropoffLat) ?? toFiniteCoordinate(o.deliveryLat);
  const dropoffLng = toFiniteCoordinate(o.dropoffLng) ?? toFiniteCoordinate(o.deliveryLng);

  return {
    id: String(o.id),
    driverId: o.driverId == null ? null : String(o.driverId),
    code: o.reference ?? `#CMD${String(o.id).padStart(6, "0")}`,
    status: mapBackendStatus(o.status),
    restaurantName: o.restaurantName,
    restaurantPhone: o.restaurant?.phone ?? "",
    pickupAddress: o.restaurant?.address ?? o.restaurantName,
    dropoffAddress: o.deliveryAddress,
    pickupLat,
    pickupLng,
    dropoffLat,
    dropoffLng,
    distanceKm,
    etaMinutes: o.estimatedDeliveryTime ?? 20,
    items,
    subtotalMad: o.subtotal,
    deliveryFeeMad: o.deliveryFee,
    priceMad: o.total,
    driverEarningsMad: driverEarnings,
    tipMad: 0,
    paymentMethod: "cash",
    deliveryCode: o.pickupCode ?? "",
    customerName: o.userName,
    customerPhone: o.user?.phone ?? "",
    notes: o.notes ?? null,
    createdAt: o.createdAt,
  };
}

function mapBackendStatus(s: string): OrderStatus {
  const knownStatuses = new Set<OrderStatus>([
    "pending", "assigned", "accepted", "confirmed", "preparing", "ready", "picked_up",
    "arrived_pickup", "driver_at_restaurant", "en_route", "out_for_delivery",
    "delivered", "cancelled",
  ]);
  return knownStatuses.has(s as OrderStatus) ? s as OrderStatus : "unknown";
}

// ─────────────────── Auth ───────────────────

export type SendOtpResponse = { ok: true; debugCode?: string };
export type VerifyOtpResponse = { token: string; isNewUser: boolean };

export async function sendOtp(phone: string): Promise<SendOtpResponse> {
  return request<SendOtpResponse>(
    "/auth/send-otp",
    { method: "POST", body: JSON.stringify({ phone, role: "driver" }) },
    false,
  );
}

export async function verifyOtp(phone: string, code: string): Promise<VerifyOtpResponse> {
  return request<VerifyOtpResponse>(
    "/auth/verify-otp",
    { method: "POST", body: JSON.stringify({ phone, code, role: "driver" }) },
    false,
  );
}

export async function forgotPassword(email: string): Promise<{ success: boolean; message: string; demoOtp?: string }> {
  return request<{ success: boolean; message: string; demoOtp?: string }>(
    "/auth/forgot-password",
    { method: "POST", body: JSON.stringify({ email }) },
    false,
  );
}

export async function resetPassword(email: string, code: string, newPassword: string): Promise<{ success: boolean; token: string }> {
  return request<{ success: boolean; token: string }>(
    "/auth/reset-password",
    { method: "POST", body: JSON.stringify({ email, code, newPassword }) },
    false,
  );
}

export async function loginWithCredentials(email: string, password: string): Promise<{ token: string }> {
  const data = await request<Record<string, unknown>>(
    "/auth/login",
    { method: "POST", body: JSON.stringify({ email, password }) },
    false,
  );
  const token =
    (typeof data.token === "string" && data.token) ||
    (typeof data.accessToken === "string" && data.accessToken) ||
    (typeof data.access_token === "string" && data.access_token) ||
    (typeof data.jwt === "string" && data.jwt) ||
    null;
  if (!token) throw { status: 401, message: "Aucun token reçu dans la réponse." } as ApiError;
  return { token };
}

// ─────────────────── Me ───────────────────

export async function getMe(): Promise<Me> {
  const u = await request<BackendMe>("/auth/me");
  return {
    id: String(u.id),
    phone: u.phone ?? "",
    email: u.email ?? null,
    role: (u.role as Role) ?? "driver",
    fullName: u.name ?? null,
    driver: u.driver ? mapDriver(u.driver) : null,
  };
}

// ─────────────────── Driver profile ───────────────────

async function resolveDriverId(): Promise<string> {
  const me = await getMe();
  return me.driver?.id ?? me.id;
}

export async function submitDriverOnboarding(payload: DriverOnboardingPayload): Promise<DriverProfile> {
  const driverId = await resolveDriverId();
  const updated = await request<BackendDriver>(`/drivers/${driverId}/complete-profile`, {
    method: "POST",
    body: JSON.stringify({
      name: payload.fullName,
      vehicleType: payload.vehicleType,
      vehiclePlate: payload.vehiclePlate,
      nationalId: payload.cin,
      licenseNumber: payload.licenseNumber,
      photoUrl: payload.photoUrl ?? null,
    }),
  });
  return mapDriver(updated);
}

const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/**
 * Uploads a selected profile image as binary. The API validates its real
 * content before storage, then returns the URL persisted with the profile.
 */
export async function uploadDriverPhoto(uri: string, mimeType: string | null | undefined): Promise<string> {
  if (!mimeType || !ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
    throw new Error("Format non pris en charge. Choisissez une image JPEG, PNG, WebP ou GIF.");
  }

  const source = await fetch(uri);
  if (!source.ok) throw new Error("Impossible de lire la photo sélectionnée.");
  const image = await source.blob();
  if (image.size > 2 * 1024 * 1024) {
    throw new Error("La photo est trop grande. Maximum 2 Mo.");
  }

  const token = await getToken();
  if (!token) throw new Error("Votre session a expiré. Reconnectez-vous puis réessayez.");

  const target = await getApiTarget();
  const base = getBaseUrl(target);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(`${base}/storage/uploads/avatar`, {
      method: "POST",
      headers: { "Content-Type": mimeType, Authorization: `Bearer ${token}` },
      body: image,
      signal: controller.signal,
    });
    const text = await response.text();
    let data: unknown = null;
    if (text) {
      try { data = JSON.parse(text); } catch { data = text; }
    }
    if (!response.ok) {
      if (response.status === 401) await clearTokenIfMatches(token);
      throw {
        status: response.status,
        message: getErrorMessage(
          data && typeof data === "object"
            ? { message: (data as { error?: unknown; message?: unknown }).message ?? (data as { error?: unknown }).error }
            : null,
          `Impossible d'envoyer la photo (${response.status}).`,
        ),
        data,
      } as ApiError;
    }
    const url = data && typeof data === "object" ? (data as { url?: unknown }).url : null;
    if (typeof url !== "string" || !url) throw new Error("Le serveur n'a pas renvoyé l'URL de la photo.");
    return url.startsWith("http") ? url : `${base.replace(/\/api$/, "")}${url}`;
  } catch (error) {
    if (error && typeof error === "object" && (error as { name?: string }).name === "AbortError") {
      throw new Error("L'envoi de la photo a expiré. Vérifiez votre connexion puis réessayez.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function setDriverOnline(isOnline: boolean): Promise<{ isOnline: boolean }> {
  const driverId = await resolveDriverId();
  await request<BackendDriver>(`/drivers/${driverId}`, {
    method: "PATCH",
    body: JSON.stringify({ isAvailable: isOnline }),
  });
  return { isOnline };
}

export async function updateDriverLocation(coords: {
  latitude: number;
  longitude: number;
  heading?: number | null;
  speed?: number | null;
}): Promise<{ activeOrderIds: number[] }> {
  const driverId = await resolveDriverId();
  return request<{ activeOrderIds?: unknown }>(`/drivers/${driverId}/location`, {
    method: "PATCH",
    body: JSON.stringify({
      latitude: coords.latitude,
      longitude: coords.longitude,
    }),
  }).then((data) => ({
    activeOrderIds: Array.isArray(data.activeOrderIds)
      ? data.activeOrderIds.filter((id): id is number => typeof id === "number")
      : [],
  }));
}

// ─────────────────── Push token ───────────────────

export async function updatePushToken(pushToken: string): Promise<{ ok: true }> {
  try {
    await request("/drivers/me/push-token", {
      method: "PATCH",
      body: JSON.stringify({ pushToken }),
    });
  } catch {
    // best-effort — don't block auth flow if backend doesn't support the field
  }
  return { ok: true };
}

// ─────────────────── Orders ───────────────────

export async function listAvailableOrders(): Promise<Order[]> {
  const list = await request<BackendOrder[]>("/orders/available");
  return list.map(mapOrder);
}

export async function listMyOrders(): Promise<Order[]> {
  const driverId = await resolveDriverId();
  const list = await request<BackendOrder[]>(`/orders?driverId=${encodeURIComponent(driverId)}`);
  return list.map(mapOrder);
}

export async function getOrder(id: string): Promise<Order> {
  const o = await request<BackendOrder>(`/orders/${id}`);
  return mapOrder(o);
}

async function patchOrderStatus(id: string, status: string): Promise<Order> {
  const o = await request<BackendOrder>(`/orders/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  return mapOrder(o);
}

export async function acceptOrder(id: string): Promise<Order> {
  const driverId = await resolveDriverId();
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const order = await request<BackendOrder>(`/orders/${id}/accept-delivery`, {
        method: "POST",
        body: JSON.stringify({ driverId: Number(driverId) }),
      });
      return mapOrder(order);
    } catch (error) {
      lastError = error;
      const apiError = error as Partial<ApiError>;
      const errorData = apiError.data as { code?: unknown; retryAfterMs?: unknown } | undefined;
      const retryAfter = typeof errorData?.retryAfterMs === "number" ? errorData.retryAfterMs : 1_500;
      const shouldRetry = attempt < 2 && (
        (apiError.status === 503 && errorData?.code === "ORDER_NOT_READY") ||
        apiError.status === 408 ||
        !apiError.status
      );
      if (!shouldRetry) throw error;
      await new Promise((resolve) => setTimeout(resolve, retryAfter));
    }
  }
  // A request timeout can happen after the server has committed the
  // assignment. Reconcile before declaring the acceptance unsuccessful.
  try {
    const order = await getOrder(id);
    if (
      order.driverId === driverId &&
      ["accepted", "driver_at_restaurant", "picked_up", "en_route", "out_for_delivery"].includes(order.status)
    ) {
      return order;
    }
  } catch {
    // Keep the original error if the reconciliation request is unavailable.
  }
  throw lastError ?? new Error("Impossible d'accepter la course. Réessayez.");
}

export async function markArrivedPickup(id: string): Promise<Order> {
  return patchOrderStatus(id, "driver_at_restaurant");
}

export async function markPickedUp(id: string): Promise<Order> {
  return patchOrderStatus(id, "picked_up");
}

export async function markEnRoute(id: string): Promise<Order> {
  return patchOrderStatus(id, "en_route");
}

export async function markArrivedDropoff(id: string): Promise<Order> {
  return patchOrderStatus(id, "out_for_delivery");
}

export async function markDelivered(id: string, deliveryCode: string): Promise<Order> {
  if (!isDeliveryCodeValid(deliveryCode)) {
    throw { status: 400, message: "Le code de livraison doit contenir exactement 4 chiffres." } as ApiError;
  }
  try {
    const order = await request<BackendOrder>(`/orders/${id}/confirm-delivery`, {
      method: "POST",
      body: JSON.stringify({ pickupCode: deliveryCode }),
    });
    return mapOrder(order);
  } catch (error) {
    // The hand-off may have committed just before a network response was lost.
    // Fetching the authoritative order prevents leaving its GPS tracking live.
    const status = (error as Partial<ApiError>).status;
    const shouldReconcile = typeof status !== "number" || status === 408 || status >= 500;
    if (shouldReconcile) {
      try {
        const order = await getOrder(id);
        if (order.status === "delivered") return order;
      } catch {
        // Preserve the original confirmation failure.
      }
    }
    throw error;
  }
}

export async function cancelOrder(id: string): Promise<Order> {
  return patchOrderStatus(id, "cancelled");
}

// ─────────────────── Earnings & Promos ───────────────────

export async function getEarnings(): Promise<EarningsSummary> {
  try {
    const driverId = await resolveDriverId();
    const raw = await request<{
      today: number;
      thisWeek: number;
      thisMonth: number;
      completedToday: number;
      completedThisWeek: number;
      completedThisMonth: number;
      totalDeliveries: number;
    }>(`/drivers/${driverId}/earnings`);
    return {
      todayMad: raw.today ?? 0,
      weekMad: raw.thisWeek ?? 0,
      monthMad: raw.thisMonth ?? 0,
      todayDeliveries: raw.completedToday ?? 0,
      weekDeliveries: raw.completedThisWeek ?? 0,
      monthDeliveries: raw.completedThisMonth ?? 0,
      todayTipsMad: 0,
      weekTipsMad: 0,
      totalDeliveries: raw.totalDeliveries ?? 0,
    };
  } catch {
    return { todayMad: 0, weekMad: 0, monthMad: 0, todayDeliveries: 0, weekDeliveries: 0, monthDeliveries: 0, todayTipsMad: 0, weekTipsMad: 0, totalDeliveries: 0 };
  }
}

export async function getPromotions(): Promise<Promotion[]> {
  // Promotions endpoint is not implemented in the backend yet.
  return [];
}

// ─────────────────── Live Tracking ───────────────────

export type TrackingInfo =
  | { available: false }
  | {
      available: true;
      latitude: number;
      longitude: number;
      heading: number | null;
      updatedAt: number | null;
      orderStatus: OrderStatus;
      pickupLat: number | null;
      pickupLng: number | null;
      dropoffLat: number | null;
      dropoffLng: number | null;
    };

export async function getOrderTracking(orderId: string): Promise<TrackingInfo> {
  try {
    const driver = await request<{ latitude: number | null; longitude: number | null; lastSeenAt?: string | null }>(
      `/drivers/by-order/${orderId}`,
    ).catch(() => null);
    if (!driver || driver.latitude == null || driver.longitude == null) {
      return { available: false };
    }
    const order = await request<BackendOrder>(`/orders/${orderId}`);
    const mappedOrder = mapOrder(order);
    return {
      available: true,
      latitude: driver.latitude,
      longitude: driver.longitude,
      heading: null,
      updatedAt: driver.lastSeenAt ? Date.parse(driver.lastSeenAt) : null,
      orderStatus: mappedOrder.status,
      pickupLat: mappedOrder.pickupLat,
      pickupLng: mappedOrder.pickupLng,
      dropoffLat: mappedOrder.dropoffLat,
      dropoffLng: mappedOrder.dropoffLng,
    };
  } catch {
    return { available: false };
  }
}
