export interface StoreCategory {
  id: string;
  nameAr: string;
  icon: string;
  slug: string;
  sortOrder: number;
}

export interface ProductMedia {
  id: string;
  mediaType: "image" | "video";
  mimeType: string;
  originalName: string;
  sortOrder: number;
  url: string;
}

export interface ProductVariant {
  id: string;
  nameAr: string;
  packageSize: string;
  price: number;
  originalPrice: number | null;
  stockQuantity: number;
  isAvailable: boolean;
}

export interface StoreProduct {
  id: string;
  slug: string;
  nameAr: string;
  brand: string;
  categoryId: string;
  categoryNameAr: string;
  subcategoryAr: string;
  shortDescription: string;
  fullDescription: string;
  image: string;
  gallery: string[];
  videos: ProductMedia[];
  media: ProductMedia[];
  variants: ProductVariant[];
  unit: string;
  packageSize: string;
  price: number;
  originalPrice: number;
  discountPercentage: number;
  offerDescription: string;
  stockQuantity: number;
  isAvailable: boolean;
  isFeatured: boolean;
  isBestSeller: boolean;
  isVariableWeight: boolean;
  isDemo: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface AppUser {
  clerkUserId: string;
  email: string;
  fullName: string;
  phone: string;
  whatsappPhone: string;
  governorate: string;
  city: string;
  address: string;
  landmark: string;
  role: "customer" | "admin";
  createdAt: string;
}

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export interface StoreOrderItem {
  id: string;
  productId: string | null;
  variantId: string;
  variantName: string;
  nameAr: string;
  packageSize: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface StoreOrder {
  id: string;
  orderNumber: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  phone: string;
  whatsappPhone: string;
  governorate: string;
  city: string;
  address: string;
  landmark: string;
  notes: string;
  status: OrderStatus;
  fulfillmentMethod: string;
  paymentMethod: string;
  subtotal: number;
  deliveryFee: number | null;
  total: number;
  createdAt: string;
  items: StoreOrderItem[];
}

export interface ProductInput {
  nameAr: string;
  brand: string;
  categoryId: string;
  subcategoryAr: string;
  shortDescription: string;
  fullDescription: string;
  unit: string;
  packageSize: string;
  price: number;
  originalPrice: number | null;
  discountPercentage: number;
  offerDescription: string;
  stockQuantity: number;
  variants: ProductVariant[];
  isAvailable: boolean;
  isFeatured: boolean;
  isBestSeller: boolean;
  isVariableWeight: boolean;
  isDemo: boolean;
  isActive: boolean;
}

export interface AdminAccount {
  clerkUserId: string;
  email: string;
  fullName: string;
  createdAt: string;
}

export interface AdminInvite {
  id: string;
  email: string;
  createdAt: string;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const hasFormData = init.body instanceof FormData;
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: {
      ...(hasFormData ? {} : { "Content-Type": "application/json" }),
      ...init.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "حصل خطأ أثناء الاتصال بالمتجر.") as Error & {
      status?: number;
      code?: string;
    };
    error.status = response.status;
    error.code = data.code;
    throw error;
  }
  return data as T;
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

export const storeApi = {
  getCatalog: () => request<{ categories: StoreCategory[]; products: StoreProduct[] }>("/api/catalog"),

  getMe: () => request<{ user: AppUser }>("/api/me"),
  saveProfile: (profile: Partial<AppUser>) =>
    request<{ user: AppUser }>("/api/me", json("PATCH", profile)),

  createOrder: (order: {
    items: Array<{ productId: string; variantId?: string; quantity: number }>;
    fullName: string;
    phone: string;
    whatsappPhone: string;
    governorate: string;
    city: string;
    address: string;
    landmark: string;
    notes: string;
  }) => request<{ order: Pick<StoreOrder, "id" | "orderNumber" | "subtotal" | "total" | "deliveryFee"> }>(
    "/api/orders",
    json("POST", order),
  ),
  getMyOrders: () => request<{ orders: StoreOrder[] }>("/api/orders"),
  cancelOrder: (orderId: string) =>
    request<{ order: { id: string; status: OrderStatus } }>(
      `/api/orders/${encodeURIComponent(orderId)}/cancel`,
      json("PATCH"),
    ),

  getAdminOrders: (status?: OrderStatus | "all") =>
    request<{ orders: StoreOrder[] }>(
      `/api/admin/orders${status && status !== "all" ? `?status=${encodeURIComponent(status)}` : ""}`,
    ),
  updateOrderStatus: (orderId: string, status: OrderStatus) =>
    request<{ order: { id: string; status: OrderStatus } }>(
      `/api/admin/orders/${encodeURIComponent(orderId)}/status`,
      json("PATCH", { status }),
    ),

  getAdminProducts: () => request<{ products: StoreProduct[] }>("/api/admin/products"),
  saveProduct: (id: string | null, product: ProductInput) =>
    request<{ product: StoreProduct }>(
      id ? `/api/admin/products/${encodeURIComponent(id)}` : "/api/admin/products",
      json(id ? "PATCH" : "POST", product),
    ),
  deleteProduct: (id: string) =>
    request<{ message: string }>(`/api/admin/products/${encodeURIComponent(id)}`, json("DELETE")),

  getAdminCategories: () => request<{ categories: StoreCategory[] }>("/api/admin/categories"),
  saveCategory: (id: string | null, category: Pick<StoreCategory, "nameAr" | "icon">) =>
    request<{ category: StoreCategory }>(
      id ? `/api/admin/categories/${encodeURIComponent(id)}` : "/api/admin/categories",
      json(id ? "PATCH" : "POST", category),
    ),
  deleteCategory: (id: string) =>
    request<{ message: string }>(`/api/admin/categories/${encodeURIComponent(id)}`, json("DELETE")),

  getAdmins: () =>
    request<{ admins: AdminAccount[]; invites: AdminInvite[] }>("/api/admin/admins"),
  inviteAdmin: (email: string) =>
    request<{ message: string; activated: boolean; signUpPath?: string }>(
      "/api/admin/admins",
      json("POST", { email }),
    ),
  removeAdmin: (clerkUserId: string) =>
    request<{ message: string }>(`/api/admin/admins/${encodeURIComponent(clerkUserId)}`, json("DELETE")),
  cancelAdminInvite: (inviteId: string) =>
    request<{ message: string }>(`/api/admin/admin-invites/${encodeURIComponent(inviteId)}`, json("DELETE")),

  uploadProductMedia: async (productId: string, files: File[]) => {
    const form = new FormData();
    files.forEach((file) => form.append("files", file));
    return request<{ media: ProductMedia[] }>(
      `/api/admin/products/${encodeURIComponent(productId)}/media`,
      { method: "POST", body: form },
    );
  },
  deleteMedia: (mediaId: string) =>
    request<{ message: string }>(`/api/admin/media/${encodeURIComponent(mediaId)}`, json("DELETE")),
};
