export type MerchantUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  phone?: string | null;
  createdAt?: string | null;
};

export type BackendMe = {
  user: MerchantUser;
  permissions: string[];
  scopedShopIds: number[];
};

export type DashboardData = {
  inProgressOrders: number;
  cancelledOrders: number;
  deliveredOrders: number;
  outOfStockProducts: number;
  totalProducts: number;
  orderReviews: number;
  totalEarned: number;
  deliveryEarning: number;
  totalOrderTax: number;
  totalCommission: number;
  merchantEarning: number;
  jatekEarning: number;
  ordersChart: { label: string; value: number }[];
};

export type DashboardTodo = {
  id: number;
  text: string;
  done: boolean;
  createdAt?: string;
};

export type MerchantOrderItem = {
  id: number;
  menuItemName?: string | null;
  quantity: number;
  unitPrice: number | string;
  totalPrice: number | string;
};

export type MerchantOrder = {
  id: number;
  reference?: string | null;
  status: string;
  userName?: string | null;
  restaurantName?: string | null;
  deliveryAddress?: string | null;
  notes?: string | null;
  paymentMethod?: string | null;
  createdAt: string;
  items?: MerchantOrderItem[];
  subtotal?: number | string;
  discountAmount?: number | string;
  deliveryFee?: number | string;
  vatAmount?: number | string;
  vatRate?: number | string;
  serviceFee?: number | string;
  total: number | string;
};

export type MenuProduct = {
  id: number;
  restaurantId: number;
  name: string;
  description?: string | null;
  price: number | string;
  imageUrl?: string | null;
  category: string;
  isAvailable: boolean;
  isPopular?: boolean;
  compareAtPrice?: number | string | null;
};

export type ProductPage = {
  items: MenuProduct[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type MenuCategory = {
  id: number;
  name: string;
};

export type MerchantShop = {
  id: number;
  name: string;
  description?: string | null;
  address?: string | null;
  phone?: string | null;
  category?: string | null;
  businessType?: string | null;
  deliveryTime?: number | null;
  deliveryFee?: number | string | null;
  minimumOrder?: number | string | null;
  isOpen: boolean;
  imageUrl?: string | null;
  coverImageUrl?: string | null;
  logoUrl?: string | null;
  rating?: number | string | null;
  reviewCount?: number | null;
};

export type MerchantReview = {
  id: number;
  userName?: string | null;
  rating: number;
  comment?: string | null;
  createdAt: string;
};

export function money(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);
  const formatted = new Intl.NumberFormat('fr-MA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
  return `${formatted} MAD`;
}

export function dateLabel(value: string | null | undefined): string {
  if (!value) return 'Date inconnue';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date inconnue';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'En attente',
    accepted: 'Acceptée',
    confirmed: 'Confirmée',
    preparing: 'En préparation',
    ready: 'Prête',
    delivered: 'Livrée',
    cancelled: 'Annulée',
  };
  return labels[status] ?? status.replaceAll('_', ' ');
}

export function nextOrderStatus(status: string): 'accepted' | 'preparing' | 'ready' | null {
  if (status === 'pending') return 'accepted';
  if (status === 'accepted' || status === 'confirmed') return 'preparing';
  if (status === 'preparing') return 'ready';
  return null;
}