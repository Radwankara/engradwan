import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  storeApi,
  type AdminAccount,
  type AdminInvite,
  type AppUser,
  type OrderStatus,
  type ProductInput,
  type ProductMedia,
  type ProductVariant,
  type StoreCategory,
  type StoreOrder,
  type StoreProduct,
} from "../lib/store-api";
import "./AdminDashboard.css";

type View = "overview" | "orders" | "products" | "categories" | "team";
type ConfirmState = { title: string; message: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void };
type LoadErrors = Partial<Record<"orders" | "products" | "categories" | "team", string>>;

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "قيد الانتظار",
  confirmed: "تم التأكيد",
  preparing: "قيد التجهيز",
  out_for_delivery: "خرج للتوصيل",
  delivered: "تم التسليم",
  cancelled: "ملغي",
};
const STATUSES: OrderStatus[] = ["pending", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"];
const NAV: { id: View; label: string; icon: string }[] = [
  { id: "overview", label: "نظرة عامة", icon: "grid" },
  { id: "orders", label: "الطلبات", icon: "bag" },
  { id: "products", label: "المنتجات", icon: "box" },
  { id: "categories", label: "الأقسام", icon: "layers" },
  { id: "team", label: "فريق الإدارة", icon: "users" },
];
const VIEW_INFO: Record<View, { title: string; eyebrow: string; subtitle: string }> = {
  overview: { title: "صباح الخير، خلّينا نبدأ", eyebrow: "مساحة العمل", subtitle: "ملخص سريع لحركة المتجر وما يحتاج متابعة اليوم." },
  orders: { title: "الطلبات", eyebrow: "خدمة العملاء", subtitle: "تابع الطلبات وحدّث حالتها أولاً بأول." },
  products: { title: "كتالوج المنتجات", eyebrow: "إدارة المتجر", subtitle: "حدّث الأسعار والمخزون ومحتوى المنتجات." },
  categories: { title: "الأقسام", eyebrow: "تنظيم الكتالوج", subtitle: "رتّب أقسام المتجر وسمّها كما تظهر للمتسوقين." },
  team: { title: "فريق الإدارة", eyebrow: "صلاحيات موثوقة", subtitle: "إدارة الحسابات المدعوة وأعضاء الفريق." },
};

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  const paths: Record<string, ReactNode> = {
    grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>,
    bag: <><path d="M5 8h14l1 12H4L5 8Z" /><path d="M9 9V6a3 3 0 0 1 6 0v3" /></>,
    box: <><path d="m4 7 8-4 8 4v10l-8 4-8-4V7Z" /><path d="m4 7 8 4 8-4M12 11v10" /></>,
    layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>,
    users: <><path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20" /><circle cx="9.5" cy="7.5" r="3.5" /><path d="M17 11a3.5 3.5 0 0 0 0-7M21 20v-1.5a4 4 0 0 0-3-3.87" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.2 4.2" /></>,
    edit: <><path d="m14 5 5 5M4 20l4.2-.8L19 8.4a2.1 2.1 0 0 0-3-3L5.2 16.2 4 20Z" /></>,
    trash: <><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    arrow: <><path d="M19 12H5m7 7-7-7 7-7" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    trend: <><path d="m3 16 6-6 4 4 8-9" /><path d="M15 5h6v6" /></>,
    package: <><path d="m4 7 8-4 8 4v10l-8 4-8-4V7Z" /><path d="M4 7l8 4 8-4M12 11v10" /></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.6 9a7 7 0 0 1 11.7-2.4L20 12M4 12l2.7 5.4A7 7 0 0 0 18.4 15" /></>,
    upload: <><path d="M12 16V4m-5 5 5-5 5 5M4 20h16" /></>,
    image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.5" /><path d="m21 15-5-5L5 20" /></>,
    warning: <><path d="m12 3 10 18H2L12 3Z" /><path d="M12 9v5m0 3h.01" /></>,
  };
  return <svg {...common}>{paths[name] || paths.grid}</svg>;
}

function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]).join("") || "؟";
}
function money(value: number | null | undefined) {
  return `${new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 2 }).format(value || 0)} ج.م`;
}
function dateText(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(parsed);
}
function userError(error: unknown) {
  return error instanceof Error ? error.message : "حصل خطأ غير متوقع. حاول مرة أخرى.";
}
function makeProductForm(product?: StoreProduct): ProductInput {
  return product ? {
    nameAr: product.nameAr, brand: product.brand, categoryId: product.categoryId, subcategoryAr: product.subcategoryAr,
    shortDescription: product.shortDescription, fullDescription: product.fullDescription, unit: product.unit,
    packageSize: product.packageSize, price: product.price, originalPrice: product.originalPrice || null,
    discountPercentage: product.discountPercentage, offerDescription: product.offerDescription,
    stockQuantity: product.stockQuantity, isAvailable: product.isAvailable, isFeatured: product.isFeatured,
    isBestSeller: product.isBestSeller, isVariableWeight: product.isVariableWeight,
    isDemo: product.isDemo, isActive: product.isActive,
    variants: (product.variants || []).map((variant) => ({ ...variant })),
  } : {
    nameAr: "", brand: "", categoryId: "", subcategoryAr: "", shortDescription: "", fullDescription: "",
    unit: "قطعة", packageSize: "", price: 0, originalPrice: null, discountPercentage: 0, offerDescription: "",
    stockQuantity: 0, variants: [], isAvailable: true, isFeatured: false, isBestSeller: false, isVariableWeight: false,
    isDemo: false, isActive: true,
  };
}

function StatusPill({ status }: { status: OrderStatus }) {
  return <span className={`aa-status ${status}`}>{STATUS_LABELS[status]}</span>;
}

function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="aa-empty"><span className="aa-empty-mark"><Icon name="package" size={22} /></span><strong>{title}</strong><p>{description}</p>{action && <div style={{ marginTop: 14 }}>{action}</div>}</div>;
}

function ConfirmDialog({ confirm, close, busy }: { confirm: ConfirmState; close: () => void; busy: boolean }) {
  return <div className="aa-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) close(); }}>
    <section className="aa-modal compact" role="alertdialog" aria-modal="true" aria-labelledby="aa-confirm-title">
      <header className="aa-modal-head"><h2 id="aa-confirm-title">{confirm.title}</h2><button className="aa-icon-btn" aria-label="إغلاق" onClick={close} disabled={busy}><Icon name="close" /></button></header>
      <div className="aa-modal-body"><p style={{ margin: 0, color: "var(--muted)" }}>{confirm.message}</p><div className="aa-modal-foot">
        <button className={`aa-btn ${confirm.danger ? "danger" : ""}`} disabled={busy} onClick={confirm.onConfirm}>{busy ? "جارٍ التنفيذ…" : confirm.confirmLabel || "تأكيد"}</button>
        <button className="aa-btn secondary" disabled={busy} onClick={close}>رجوع</button>
      </div></div>
    </section>
  </div>;
}

export default function AdminDashboard({ user, onCatalogChanged }: { user: AppUser; onCatalogChanged: () => void }) {
  const [view, setView] = useState<View>("overview");
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [invites, setInvites] = useState<AdminInvite[]>([]);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<LoadErrors>({});
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [orderSearch, setOrderSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<StoreOrder | null>(null);
  const [productEditor, setProductEditor] = useState<{ product: StoreProduct | null; values: ProductInput } | null>(null);
  const [categoryEditor, setCategoryEditor] = useState<{ category: StoreCategory | null; nameAr: string; icon: string } | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [inviteResult, setInviteResult] = useState<{ email: string; signUpPath?: string } | null>(null);
  const [productPage, setProductPage] = useState(1);
  const [orderPage, setOrderPage] = useState(1);
  const pageSize = 9;

  const setLoading = (key: string, value: boolean) => setBusy((prev) => ({ ...prev, [key]: value }));
  const loadOrders = useCallback(async (status: OrderStatus | "all" = "all") => {
    setLoading("orders", true);
    setErrors((prev) => ({ ...prev, orders: undefined }));
    try { const result = await storeApi.getAdminOrders(status); setOrders(result.orders); }
    catch (error) { setErrors((prev) => ({ ...prev, orders: userError(error) })); }
    finally { setLoading("orders", false); }
  }, []);
  const loadProducts = useCallback(async () => {
    setLoading("products", true);
    setErrors((prev) => ({ ...prev, products: undefined }));
    try { const result = await storeApi.getAdminProducts(); setProducts(result.products); }
    catch (error) { setErrors((prev) => ({ ...prev, products: userError(error) })); }
    finally { setLoading("products", false); }
  }, []);
  const loadCategories = useCallback(async () => {
    setLoading("categories", true);
    setErrors((prev) => ({ ...prev, categories: undefined }));
    try { const result = await storeApi.getAdminCategories(); setCategories(result.categories); }
    catch (error) { setErrors((prev) => ({ ...prev, categories: userError(error) })); }
    finally { setLoading("categories", false); }
  }, []);
  const loadTeam = useCallback(async () => {
    setLoading("team", true);
    setErrors((prev) => ({ ...prev, team: undefined }));
    try { const result = await storeApi.getAdmins(); setAdmins(result.admins); setInvites(result.invites); }
    catch (error) { setErrors((prev) => ({ ...prev, team: userError(error) })); }
    finally { setLoading("team", false); }
  }, []);

  useEffect(() => { void Promise.all([loadOrders(), loadProducts(), loadCategories(), loadTeam()]); }, [loadOrders, loadProducts, loadCategories, loadTeam]);
  useEffect(() => { setOrderPage(1); void loadOrders(statusFilter); }, [statusFilter, loadOrders]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const filteredOrders = useMemo(() => {
    const query = orderSearch.trim().toLowerCase();
    return orders.filter((order) => !query || [order.orderNumber, order.customerName, order.phone, order.city].some((part) => (part || "").toLowerCase().includes(query)));
  }, [orders, orderSearch]);
  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    return products.filter((product) => (categoryFilter === "all" || product.categoryId === categoryFilter) &&
      (!query || [product.nameAr, product.brand, product.categoryNameAr, product.subcategoryAr].some((part) => (part || "").toLowerCase().includes(query))));
  }, [products, productSearch, categoryFilter]);
  const orderCount = orders.length;
  const awaitingCount = orders.filter((order) => order.status === "pending").length;
  const lowStock = products.filter((product) => product.stockQuantity < 6 && product.isActive);
  const demoCount = products.filter((product) => product.isDemo).length;
  const pagedProducts = filteredProducts.slice((productPage - 1) * pageSize, productPage * pageSize);
  const pagedOrders = filteredOrders.slice((orderPage - 1) * pageSize, orderPage * pageSize);

  const changeOrderStatus = (order: StoreOrder, status: OrderStatus) => {
    if (order.status === status) return;
    setConfirm({
      title: "تأكيد تحديث حالة الطلب",
      message: `هل تريد تغيير حالة الطلب ${order.orderNumber} إلى «${STATUS_LABELS[status]}»؟`,
      confirmLabel: "تحديث الحالة",
      onConfirm: async () => {
        setLoading(`status-${order.id}`, true);
        try {
          const result = await storeApi.updateOrderStatus(order.id, status);
          setOrders((prev) => prev.map((item) => item.id === order.id ? { ...item, status: result.order.status } : item));
          setSelectedOrder((prev) => prev?.id === order.id ? { ...prev, status: result.order.status } : prev);
          setNotice({ text: "تم تحديث حالة الطلب." });
          setConfirm(null);
        } catch (error) { setNotice({ text: userError(error), error: true }); }
        finally { setLoading(`status-${order.id}`, false); }
      },
    });
  };

  const saveProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!productEditor) return;
    setLoading("save-product", true);
    try {
      const result = await storeApi.saveProduct(productEditor.product?.id || null, {
        ...productEditor.values,
        originalPrice: productEditor.values.originalPrice === null || Number.isNaN(productEditor.values.originalPrice) ? null : Number(productEditor.values.originalPrice),
        price: Number(productEditor.values.price), stockQuantity: Number(productEditor.values.stockQuantity),
        discountPercentage: Number(productEditor.values.discountPercentage),
      });
      if (pendingFiles.length) {
        try {
          await storeApi.uploadProductMedia(result.product.id, pendingFiles);
        } catch (error) {
          setProductEditor({ product: result.product, values: productEditor.values });
          throw error;
        }
      }
      setProductEditor(null);
      setPendingFiles([]);
      await Promise.all([loadProducts(), loadCategories()]);
      onCatalogChanged();
      setNotice({ text: "تم حفظ بيانات المنتج." });
    } catch (error) { setNotice({ text: userError(error), error: true }); }
    finally { setLoading("save-product", false); }
  };
  const confirmDeleteProduct = (product: StoreProduct) => setConfirm({
    title: "حذف المنتج",
    message: `سيتم حذف «${product.nameAr}» من الكتالوج. لا يمكن التراجع عن هذا الإجراء.`,
    confirmLabel: "حذف المنتج", danger: true,
    onConfirm: async () => {
      setLoading("delete-product", true);
      try { await storeApi.deleteProduct(product.id); setConfirm(null); await loadProducts(); onCatalogChanged(); setNotice({ text: "تم حذف المنتج." }); }
      catch (error) { setNotice({ text: userError(error), error: true }); }
      finally { setLoading("delete-product", false); }
    },
  });
  const saveCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!categoryEditor) return;
    setLoading("save-category", true);
    try {
      await storeApi.saveCategory(categoryEditor.category?.id || null, { nameAr: categoryEditor.nameAr.trim(), icon: categoryEditor.icon.trim() });
      setCategoryEditor(null);
      await Promise.all([loadCategories(), loadProducts()]);
      onCatalogChanged();
      setNotice({ text: "تم حفظ القسم." });
    } catch (error) { setNotice({ text: userError(error), error: true }); }
    finally { setLoading("save-category", false); }
  };
  const confirmDeleteCategory = (category: StoreCategory) => setConfirm({
    title: "حذف القسم",
    message: `هل تريد حذف قسم «${category.nameAr}»؟`,
    confirmLabel: "حذف القسم", danger: true,
    onConfirm: async () => {
      setLoading("delete-category", true);
      try { await storeApi.deleteCategory(category.id); setConfirm(null); await Promise.all([loadCategories(), loadProducts()]); onCatalogChanged(); setNotice({ text: "تم حذف القسم." }); }
      catch (error) { setNotice({ text: userError(error), error: true }); }
      finally { setLoading("delete-category", false); }
    },
  });
  const deleteMedia = (media: ProductMedia) => setConfirm({
    title: "حذف الملف",
    message: `سيتم حذف «${media.originalName}» من وسائط المنتج.`,
    confirmLabel: "حذف الملف", danger: true,
    onConfirm: async () => {
      setLoading(`media-${media.id}`, true);
      try { await storeApi.deleteMedia(media.id); setConfirm(null); await loadProducts(); setNotice({ text: "تم حذف الملف." }); }
      catch (error) { setNotice({ text: userError(error), error: true }); }
      finally { setLoading(`media-${media.id}`, false); }
    },
  });
  const sendInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = inviteEmail.trim();
    if (!email) return;
    setLoading("invite", true);
    setInviteResult(null);
    try {
      const result = await storeApi.inviteAdmin(email);
      setInviteResult({ email, signUpPath: result.signUpPath });
      setInviteEmail("");
      await loadTeam();
      setNotice({ text: result.activated ? "تم تفعيل صلاحية الإدارة للحساب المطابق." : "تم تسجيل الدعوة." });
    } catch (error) { setNotice({ text: userError(error), error: true }); }
    finally { setLoading("invite", false); }
  };
  const removeAdmin = (admin: AdminAccount) => setConfirm({
    title: "إزالة صلاحية الإدارة",
    message: `هل تريد إزالة صلاحية الإدارة عن ${admin.fullName || admin.email}؟`,
    confirmLabel: "إزالة الصلاحية", danger: true,
    onConfirm: async () => {
      setLoading(`remove-${admin.clerkUserId}`, true);
      try { await storeApi.removeAdmin(admin.clerkUserId); setConfirm(null); await loadTeam(); setNotice({ text: "تمت إزالة صلاحية الإدارة." }); }
      catch (error) { setNotice({ text: userError(error), error: true }); }
      finally { setLoading(`remove-${admin.clerkUserId}`, false); }
    },
  });
  const cancelInvite = (invite: AdminInvite) => setConfirm({
    title: "إلغاء الدعوة",
    message: `هل تريد إلغاء الدعوة المرسلة إلى ${invite.email}؟`,
    confirmLabel: "إلغاء الدعوة", danger: true,
    onConfirm: async () => {
      setLoading(`invite-${invite.id}`, true);
      try { await storeApi.cancelAdminInvite(invite.id); setConfirm(null); await loadTeam(); setNotice({ text: "تم إلغاء الدعوة." }); }
      catch (error) { setNotice({ text: userError(error), error: true }); }
      finally { setLoading(`invite-${invite.id}`, false); }
    },
  });

  const startProductEditor = (product: StoreProduct | null) => {
    setPendingFiles([]);
    setProductEditor({ product, values: makeProductForm(product) });
  };
  const updateProductValue = <K extends keyof ProductInput>(key: K, value: ProductInput[K]) => {
    setProductEditor((prev) => prev ? { ...prev, values: { ...prev.values, [key]: value } } : prev);
  };
  const updateVariant = <K extends keyof ProductVariant>(index: number, key: K, value: ProductVariant[K]) => {
    setProductEditor((prev) => {
      if (!prev) return prev;
      const variants = [...prev.values.variants];
      variants[index] = { ...variants[index], [key]: value };
      return { ...prev, values: { ...prev.values, variants } };
    });
  };
  const addVariant = () => setProductEditor((prev) => prev ? {
    ...prev,
    values: {
      ...prev.values,
      variants: [...prev.values.variants, {
        id: crypto.randomUUID(),
        nameAr: "",
        packageSize: "",
        price: 0,
        originalPrice: null,
        stockQuantity: 0,
        isAvailable: true,
      }],
    },
  } : prev);
  const removeVariant = (index: number) => setProductEditor((prev) => prev ? {
    ...prev,
    values: { ...prev.values, variants: prev.values.variants.filter((_, itemIndex) => itemIndex !== index) },
  } : prev);
  const renderProductMedia = (product: StoreProduct) => {
    const media = product.media?.length ? product.media : [...(product.videos || []), ...(product.gallery || []).map((url, index) => ({ id: `gallery-${index}-${product.id}`, mediaType: "image" as const, mimeType: "image/*", originalName: `صورة ${index + 1}`, sortOrder: index, url }))];
    return <div className="aa-media-grid">{media.map((item) => <div className="aa-media-item" key={item.id}>
      {item.mediaType === "video" ? <video src={item.url} controls aria-label={item.originalName} /> : <img src={item.url} alt={item.originalName} />}
      {!item.id.startsWith("gallery-") && <button className="aa-icon-btn danger" aria-label={`حذف ${item.originalName}`} onClick={() => deleteMedia(item)}><Icon name="trash" size={15} /></button>}
    </div>)}</div>;
  };

  const refreshView = () => {
    if (view === "orders" || view === "overview") void loadOrders(statusFilter);
    if (view === "products" || view === "overview") void loadProducts();
    if (view === "categories") void loadCategories();
    if (view === "team") void loadTeam();
  };
  const currentInfo = VIEW_INFO[view];
  const renderOrders = (compact = false) => {
    if (errors.orders) return <div className="aa-empty"><span className="aa-empty-mark"><Icon name="warning" /></span><strong>تعذر تحميل الطلبات</strong><p>{errors.orders}</p><button className="aa-retry" onClick={() => void loadOrders(statusFilter)}><Icon name="refresh" size={15} /> إعادة المحاولة</button></div>;
    if (busy.orders && !orders.length) return <div aria-label="جارٍ تحميل الطلبات"><div className="aa-skeleton" /><div className="aa-skeleton" /><div className="aa-skeleton" /></div>;
    const shown = compact ? orders.slice(0, 5) : pagedOrders;
    if (!orders.length) return <EmptyState title="لسه مفيش طلبات" description="ستظهر الطلبات الجديدة هنا بمجرد وصولها." />;
    if (!shown.length) return <EmptyState title="مفيش نتائج مطابقة" description="جرّب البحث بكلمة مختلفة أو غيّر حالة الطلب." />;
    return compact ? <div className="aa-order-list">{shown.map((order) => <button className="aa-order-row" key={order.id} onClick={() => setSelectedOrder(order)} style={{ width: "100%", textAlign: "right", border: 0, background: "transparent", color: "inherit", font: "inherit" }}>
      <span className="aa-order-id"><strong>{order.orderNumber}</strong><small>{dateText(order.createdAt)}</small></span><span className="aa-order-customer">{order.customerName}</span><StatusPill status={order.status} /><span className="aa-money">{money(order.total)}</span>
    </button>)}</div> : <div className="aa-table-wrap"><table className="aa-table"><thead><tr><th>رقم الطلب</th><th>العميل</th><th>التاريخ</th><th>الإجمالي</th><th>الحالة</th><th>التفاصيل</th></tr></thead><tbody>
      {shown.map((order) => <tr key={order.id}><td><strong dir="ltr">{order.orderNumber}</strong></td><td>{order.customerName}<small style={{ display: "block", color: "var(--muted)", direction: "ltr", textAlign: "right" }}>{order.phone}</small></td><td>{dateText(order.createdAt)}</td><td className="aa-money">{money(order.total)}</td><td><StatusPill status={order.status} /></td><td><button className="aa-btn secondary small" onClick={() => setSelectedOrder(order)}>فتح الطلب</button></td></tr>)}
    </tbody></table><div className="aa-pagination"><span>{filteredOrders.length} طلب</span><div className="aa-inline-actions">
      <button className="aa-icon-btn" aria-label="الصفحة السابقة" disabled={orderPage <= 1} onClick={() => setOrderPage((p) => p - 1)}><Icon name="arrow" size={15} /></button>
      <span>{orderPage} / {Math.max(1, Math.ceil(filteredOrders.length / pageSize))}</span>
      <button className="aa-icon-btn" aria-label="الصفحة التالية" disabled={orderPage >= Math.ceil(filteredOrders.length / pageSize)} onClick={() => setOrderPage((p) => p + 1)} style={{ transform: "rotate(180deg)" }}><Icon name="arrow" size={15} /></button>
    </div></div></div>;
  };

  return <div className="aa-admin">
    <div className="aa-frame">
      <aside className="aa-sidebar" aria-label="التنقل الرئيسي">
        <div className="aa-brand"><span className="aa-brand-mark"><Icon name="bag" size={21} /></span><span><strong>أبو عمّار</strong><small>إدارة السوبر ماركت</small></span></div>
        <div className="aa-nav-label">إدارة المتجر</div>
        <nav className="aa-nav">{NAV.map((item) => <button key={item.id} aria-current={view === item.id ? "page" : undefined} onClick={() => setView(item.id)}><Icon name={item.icon} size={18} />{item.label}</button>)}</nav>
        <div className="aa-sidebar-bottom"><div className="aa-user"><span className="aa-user-avatar">{initials(user.fullName || user.email)}</span><span className="aa-user-copy"><strong>{user.fullName || "مسؤول المتجر"}</strong><small>{user.email}</small></span></div></div>
      </aside>
      <main className="aa-main">
        <header className="aa-topline"><div className="aa-breadcrumb"><span>أبو عمّار</span><span>/</span><strong>{currentInfo.title}</strong></div><span className="aa-live">مساحة الإدارة</span></header>
        <div className="aa-content">
          <div className="aa-page-head"><div><div className="aa-eyebrow">{currentInfo.eyebrow}</div><h1>{currentInfo.title}</h1><p>{currentInfo.subtitle}</p></div>
            <div className="aa-actions">
              {(view === "overview" || view === "orders" || view === "products" || view === "categories" || view === "team") && <button className="aa-btn secondary" onClick={refreshView}><Icon name="refresh" size={16} /> تحديث</button>}
              {view === "products" && <button className="aa-btn" onClick={() => startProductEditor(null)}><Icon name="plus" size={17} /> إضافة منتج</button>}
              {view === "categories" && <button className="aa-btn" onClick={() => setCategoryEditor({ category: null, nameAr: "", icon: "" })}><Icon name="plus" size={17} /> إضافة قسم</button>}
            </div>
          </div>
          {notice && <div className={`aa-notice${notice.error ? " error" : ""}`} role="status">{notice.text}</div>}

          {view === "overview" && <>
            <section className="aa-stat-grid" aria-label="ملخص المتجر">
              <article className="aa-card aa-stat"><div className="aa-stat-top"><span>كل الطلبات</span><span className="aa-stat-icon"><Icon name="bag" size={17} /></span></div><strong className="aa-stat-value">{new Intl.NumberFormat("ar-EG").format(orderCount)}</strong><small className="aa-stat-note">المعروضة من واجهة الإدارة</small></article>
              <article className="aa-card aa-stat"><div className="aa-stat-top"><span>تحتاج تأكيد</span><span className="aa-stat-icon"><Icon name="clock" size={17} /></span></div><strong className="aa-stat-value">{new Intl.NumberFormat("ar-EG").format(awaitingCount)}</strong><small className="aa-stat-note">طلبات بحالة قيد الانتظار</small></article>
              <article className="aa-card aa-stat"><div className="aa-stat-top"><span>منتجات نشطة</span><span className="aa-stat-icon"><Icon name="box" size={17} /></span></div><strong className="aa-stat-value">{new Intl.NumberFormat("ar-EG").format(products.filter((item) => item.isActive).length)}</strong><small className="aa-stat-note">من إجمالي {new Intl.NumberFormat("ar-EG").format(products.length)} منتج</small></article>
              <article className="aa-card aa-stat"><div className="aa-stat-top"><span>مخزون منخفض</span><span className="aa-stat-icon"><Icon name="warning" size={17} /></span></div><strong className="aa-stat-value">{new Intl.NumberFormat("ar-EG").format(lowStock.length)}</strong><small className="aa-stat-note">أقل من ٦ وحدات بالمخزون</small></article>
            </section>
            {demoCount > 0 && <div className="aa-notice" role="status"><strong>تنبيه بيانات تجريبية:</strong> يوجد {new Intl.NumberFormat("ar-EG").format(demoCount)} منتج تجريبي في الكتالوج. راجع الأسعار والمعلومات، وعدّل المنتج وأزل علامة «تجريبي» عندما تتأكد من بياناته.</div>}
            <div className="aa-dashboard-grid">
              <section className="aa-card aa-panel"><div className="aa-panel-head"><h2>أحدث الطلبات</h2><button className="aa-link-button" onClick={() => setView("orders")}>كل الطلبات <Icon name="arrow" size={13} /></button></div>{renderOrders(true)}</section>
              <section className="aa-card aa-panel"><div className="aa-panel-head"><h2>مخزون يحتاج متابعة</h2><button className="aa-link-button" onClick={() => setView("products")}>الكتالوج <Icon name="arrow" size={13} /></button></div>
                {errors.products ? <div className="aa-empty"><p>{errors.products}</p><button className="aa-retry" onClick={() => void loadProducts()}>إعادة المحاولة</button></div> : busy.products && !products.length ? <><div className="aa-skeleton" /><div className="aa-skeleton" /></> : lowStock.length ? <div className="aa-low-stock">{lowStock.slice(0, 6).map((product) => <div className="aa-stock-row" key={product.id}><span><strong>{product.nameAr}</strong><small>{product.categoryNameAr || "بدون قسم"}</small></span><span className="aa-stock-count">{new Intl.NumberFormat("ar-EG").format(product.stockQuantity)} متبقي</span></div>)}</div> : <EmptyState title="المخزون مستقر" description="لا توجد منتجات نشطة بمخزون منخفض." />}
              </section>
            </div>
          </>}

          {view === "orders" && <section className="aa-card aa-panel">
            <div className="aa-toolbar"><div className="aa-search"><Icon name="search" size={17} /><input className="aa-input" value={orderSearch} onChange={(event) => { setOrderSearch(event.target.value); setOrderPage(1); }} aria-label="ابحث عن طلب" placeholder="ابحث برقم الطلب أو اسم العميل…" /></div>
              <select className="aa-select" aria-label="تصفية حسب حالة الطلب" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as OrderStatus | "all")}><option value="all">كل الحالات</option>{STATUSES.map((status) => <option value={status} key={status}>{STATUS_LABELS[status]}</option>)}</select>
            </div>{renderOrders()}
          </section>}

          {view === "products" && <section className="aa-card aa-panel">
            {demoCount > 0 && <div className="aa-notice"><strong>بيانات تجريبية:</strong> عدد {new Intl.NumberFormat("ar-EG").format(demoCount)} منتج يحمل علامة تجريبي. افتح المنتج لتصحيح بياناته وإزالة العلامة بعد المراجعة.</div>}
            {errors.products ? <div className="aa-empty"><span className="aa-empty-mark"><Icon name="warning" /></span><strong>تعذر تحميل المنتجات</strong><p>{errors.products}</p><button className="aa-retry" onClick={() => void loadProducts()}><Icon name="refresh" size={15} /> إعادة المحاولة</button></div> : <>
              <div className="aa-toolbar"><div className="aa-search"><Icon name="search" size={17} /><input className="aa-input" value={productSearch} onChange={(event) => { setProductSearch(event.target.value); setProductPage(1); }} aria-label="ابحث عن منتج" placeholder="اسم المنتج أو العلامة التجارية…" /></div>
                <select className="aa-select" aria-label="تصفية حسب القسم" value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setProductPage(1); }}><option value="all">كل الأقسام</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.nameAr}</option>)}</select>
              </div>
              {busy.products && !products.length ? <div><div className="aa-skeleton" /><div className="aa-skeleton" /><div className="aa-skeleton" /></div> : !filteredProducts.length ? <EmptyState title={products.length ? "مفيش منتجات مطابقة" : "الكتالوج فارغ"} description={products.length ? "جرّب تغيير كلمات البحث أو القسم." : "أضف أول منتج موثّق ليظهر في المتجر."} action={!products.length && <button className="aa-btn" onClick={() => startProductEditor(null)}><Icon name="plus" size={16} /> إضافة منتج</button>} /> :
                <><div className="aa-table-wrap"><table className="aa-table"><thead><tr><th>المنتج</th><th>القسم</th><th>السعر</th><th>المخزون</th><th>مصدر البيانات</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>
                  {pagedProducts.map((product) => <tr key={product.id}><td><div className="aa-product-cell">{product.image ? <img className="aa-product-image" src={product.image} alt="" /> : <span className="aa-product-image aa-image-fallback"><Icon name="image" size={19} /></span>}<span><strong>{product.nameAr}</strong><small>{product.brand || product.packageSize || "—"}</small></span></div></td>
                    <td>{product.categoryNameAr || "بدون قسم"}</td><td className="aa-money">{money(product.price)}</td><td>{new Intl.NumberFormat("ar-EG").format(product.stockQuantity)}</td>
                    <td><span className={`aa-tag ${product.isDemo ? "" : "real"}`}>{product.isDemo ? <><Icon name="warning" size={12} /> تجريبي</> : "مُراجع"}</span></td>
                    <td><span className={`aa-tag ${product.isActive && product.isAvailable ? "real" : "off"}`}>{product.isActive && product.isAvailable ? "ظاهر" : "غير ظاهر"}</span></td>
                    <td><div className="aa-inline-actions"><button className="aa-icon-btn" aria-label={`تعديل ${product.nameAr}`} onClick={() => startProductEditor(product)}><Icon name="edit" size={15} /></button><button className="aa-icon-btn danger" aria-label={`حذف ${product.nameAr}`} onClick={() => confirmDeleteProduct(product)}><Icon name="trash" size={15} /></button></div></td>
                  </tr>)}
                </tbody></table></div><div className="aa-pagination"><span>{new Intl.NumberFormat("ar-EG").format(filteredProducts.length)} منتج</span><div className="aa-inline-actions"><button className="aa-icon-btn" aria-label="الصفحة السابقة" disabled={productPage <= 1} onClick={() => setProductPage((p) => p - 1)}><Icon name="arrow" size={15} /></button><span>{productPage} / {Math.max(1, Math.ceil(filteredProducts.length / pageSize))}</span><button className="aa-icon-btn" aria-label="الصفحة التالية" disabled={productPage >= Math.ceil(filteredProducts.length / pageSize)} onClick={() => setProductPage((p) => p + 1)} style={{ transform: "rotate(180deg)" }}><Icon name="arrow" size={15} /></button></div></div></>}
            </>}
          </section>}

          {view === "categories" && <section>
            {errors.categories ? <div className="aa-card"><div className="aa-empty"><span className="aa-empty-mark"><Icon name="warning" /></span><strong>تعذر تحميل الأقسام</strong><p>{errors.categories}</p><button className="aa-retry" onClick={() => void loadCategories()}><Icon name="refresh" size={15} /> إعادة المحاولة</button></div></div> :
              busy.categories && !categories.length ? <div className="aa-card aa-panel"><div className="aa-skeleton" /><div className="aa-skeleton" /></div> :
              categories.length ? <div className="aa-category-grid">{categories.map((category) => <article className="aa-card aa-category-card" key={category.id}><span className="aa-category-icon" aria-hidden="true">{category.icon || "—"}</span><span className="aa-category-copy"><strong>{category.nameAr}</strong><small>ترتيب العرض: {new Intl.NumberFormat("ar-EG").format(category.sortOrder)}</small></span><span className="aa-category-actions"><button className="aa-icon-btn" aria-label={`تعديل ${category.nameAr}`} onClick={() => setCategoryEditor({ category, nameAr: category.nameAr, icon: category.icon })}><Icon name="edit" size={15} /></button><button className="aa-icon-btn danger" aria-label={`حذف ${category.nameAr}`} onClick={() => confirmDeleteCategory(category)}><Icon name="trash" size={15} /></button></span></article>)}</div> :
                <div className="aa-card"><EmptyState title="مفيش أقسام لسه" description="أضف أقسام واضحة عشان تسهّل تصفح المنتجات." action={<button className="aa-btn" onClick={() => setCategoryEditor({ category: null, nameAr: "", icon: "" })}><Icon name="plus" size={16} /> إضافة قسم</button>} /></div>}
          </section>}

          {view === "team" && <div className="aa-team-grid">
            <section className="aa-card aa-team-card">
              <h2>دعوة مسؤول جديد</h2><p>الدعوة مرتبطة بعنوان البريد الإلكتروني الذي سيستخدمه المسؤول عند إنشاء حسابه.</p>
              <form onSubmit={sendInvite}><div className="aa-field"><label htmlFor="aa-invite-email">البريد الإلكتروني المدعو</label><input id="aa-invite-email" className="aa-input" type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="name@example.com" dir="ltr" required /></div>
                <div className="aa-info-box">لا توجد خدمة لإرسال بريد الدعوة. أخبر الشخص أن ينشئ حساباً باستخدام البريد نفسه، وشاركه رابط التسجيل <bdi dir="ltr">/sign-up</bdi> يدوياً.</div>
                <div style={{ marginTop: 14 }}><button className="aa-btn" disabled={busy.invite || !inviteEmail.trim()}><Icon name="plus" size={16} />{busy.invite ? "جارٍ تسجيل الدعوة…" : "تسجيل الدعوة"}</button></div>
              </form>
              {inviteResult && <div className="aa-notice" role="status" style={{ marginTop: 14 }}>تم تسجيل الدعوة إلى <bdi dir="ltr">{inviteResult.email}</bdi>. شارك رابط <bdi dir="ltr">{inviteResult.signUpPath || "/sign-up"}</bdi> يدوياً، ويجب التسجيل بهذا البريد بالضبط.</div>}
              {errors.team && <div className="aa-notice error">{errors.team} <button className="aa-retry" onClick={() => void loadTeam()}>إعادة المحاولة</button></div>}
            </section>
            <section className="aa-card aa-team-card">
              <h2>المسؤولون الحاليون <span className="aa-tag real">{new Intl.NumberFormat("ar-EG").format(admins.length)}</span></h2>
              {busy.team && !admins.length ? <><div className="aa-skeleton" /><div className="aa-skeleton" /></> : admins.length ? admins.map((admin) => <div className="aa-admin-row" key={admin.clerkUserId}><span className="aa-user-avatar">{initials(admin.fullName || admin.email)}</span><span className="aa-admin-row-copy"><strong>{admin.fullName || "مسؤول"}</strong><small>{admin.email}</small></span>{admin.clerkUserId === user.clerkUserId ? <span className="aa-tag real">حسابك</span> : <button className="aa-icon-btn danger" aria-label={`إزالة ${admin.fullName || admin.email}`} onClick={() => removeAdmin(admin)}><Icon name="trash" size={15} /></button>}</div>) : <EmptyState title="لا يوجد مسؤولون ظاهرون" description="تحقق من الاتصال أو أعد تحميل البيانات." />}
              <hr className="aa-modal-divider" /><h2>دعوات معلّقة <span className="aa-tag">{new Intl.NumberFormat("ar-EG").format(invites.length)}</span></h2>
              {busy.team && !invites.length ? <div className="aa-skeleton" /> : invites.length ? invites.map((invite) => <div className="aa-admin-row" key={invite.id}><span className="aa-user-avatar"><Icon name="clock" size={16} /></span><span className="aa-admin-row-copy"><strong>{invite.email}</strong><small>أُضيفت {dateText(invite.createdAt)}</small></span><button className="aa-icon-btn danger" aria-label={`إلغاء دعوة ${invite.email}`} onClick={() => cancelInvite(invite)}><Icon name="close" size={15} /></button></div>) : <p style={{ color: "var(--muted)", fontSize: 12, margin: "8px 0" }}>لا توجد دعوات معلّقة حالياً.</p>}
            </section>
          </div>}
        </div>
      </main>
    </div>
    <nav className="aa-mobile-nav" aria-label="التنقل الرئيسي للهاتف">{NAV.map((item) => <button key={item.id} aria-current={view === item.id ? "page" : undefined} onClick={() => setView(item.id)}><Icon name={item.icon} size={18} /><span>{item.label}</span></button>)}</nav>

    {productEditor && <div className="aa-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy["save-product"]) setProductEditor(null); }}>
      <section className="aa-modal" role="dialog" aria-modal="true" aria-labelledby="aa-product-title">
        <header className="aa-modal-head"><h2 id="aa-product-title">{productEditor.product ? "تعديل المنتج" : "إضافة منتج"}</h2><button className="aa-icon-btn" aria-label="إغلاق" onClick={() => setProductEditor(null)} disabled={busy["save-product"]}><Icon name="close" /></button></header>
        <form onSubmit={saveProduct}><div className="aa-modal-body">
          <div className="aa-form-grid">
            <div className="aa-field"><label htmlFor="aa-name">اسم المنتج بالعربية *</label><input id="aa-name" className="aa-input" value={productEditor.values.nameAr} onChange={(e) => updateProductValue("nameAr", e.target.value)} required /></div>
            <div className="aa-field"><label htmlFor="aa-brand">العلامة التجارية</label><input id="aa-brand" className="aa-input" value={productEditor.values.brand} onChange={(e) => updateProductValue("brand", e.target.value)} /></div>
            <div className="aa-field"><label htmlFor="aa-category">القسم *</label><select id="aa-category" className="aa-select" value={productEditor.values.categoryId} onChange={(e) => updateProductValue("categoryId", e.target.value)} required><option value="">اختر القسم</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.nameAr}</option>)}</select></div>
            <div className="aa-field"><label htmlFor="aa-subcategory">نوع المنتج / القسم الفرعي</label><input id="aa-subcategory" className="aa-input" value={productEditor.values.subcategoryAr} onChange={(e) => updateProductValue("subcategoryAr", e.target.value)} /></div>
            <div className="aa-field"><label htmlFor="aa-price">السعر بالجنيه *</label><input id="aa-price" className="aa-input" type="number" min="0" step="0.01" value={productEditor.values.price} onChange={(e) => updateProductValue("price", Number(e.target.value))} required /></div>
            <div className="aa-field"><label htmlFor="aa-original-price">السعر قبل الخصم</label><input id="aa-original-price" className="aa-input" type="number" min="0" step="0.01" value={productEditor.values.originalPrice ?? ""} onChange={(e) => updateProductValue("originalPrice", e.target.value === "" ? null : Number(e.target.value))} /></div>
            <div className="aa-field"><label htmlFor="aa-discount">نسبة الخصم %</label><input id="aa-discount" className="aa-input" type="number" min="0" max="100" value={productEditor.values.discountPercentage} onChange={(e) => updateProductValue("discountPercentage", Number(e.target.value))} /></div>
            <div className="aa-field"><label htmlFor="aa-stock">{productEditor.values.variants.length ? "إجمالي مخزون الأنواع (محسوب)" : "الكمية بالمخزون *"}</label><input id="aa-stock" className="aa-input" type="number" min="0" step="1" value={productEditor.values.variants.length ? productEditor.values.variants.reduce((total, variant) => total + Number(variant.stockQuantity || 0), 0) : productEditor.values.stockQuantity} onChange={(e) => updateProductValue("stockQuantity", Number(e.target.value))} disabled={productEditor.values.variants.length > 0} required /></div>
            <div className="aa-field"><label htmlFor="aa-unit">وحدة البيع</label><input id="aa-unit" className="aa-input" value={productEditor.values.unit} onChange={(e) => updateProductValue("unit", e.target.value)} /></div>
            <div className="aa-field"><label htmlFor="aa-package">حجم العبوة</label><input id="aa-package" className="aa-input" value={productEditor.values.packageSize} onChange={(e) => updateProductValue("packageSize", e.target.value)} /></div>
            <div className="aa-field full"><label htmlFor="aa-short">وصف مختصر</label><input id="aa-short" className="aa-input" value={productEditor.values.shortDescription} onChange={(e) => updateProductValue("shortDescription", e.target.value)} /></div>
            <div className="aa-field full"><label htmlFor="aa-full">الوصف الكامل</label><textarea id="aa-full" className="aa-textarea" value={productEditor.values.fullDescription} onChange={(e) => updateProductValue("fullDescription", e.target.value)} /></div>
            <div className="aa-field full">
              <div className="aa-media-heading"><h3>أنواع وأحجام المنتج</h3><button type="button" className="aa-btn secondary small" onClick={addVariant}><Icon name="plus" size={15} /> إضافة نوع</button></div>
              <p className="aa-help">أضف أحجامًا أو نكهات مختلفة؛ لكل نوع سعر ومخزون مستقلان. اترك القائمة فارغة للمنتج ذي الخيار الواحد.</p>
              {productEditor.values.variants.map((variant, index) => <div className="aa-variant-row" key={variant.id}>
                <div className="aa-field"><label>اسم النوع</label><input className="aa-input" value={variant.nameAr} onChange={(event) => updateVariant(index, "nameAr", event.target.value)} placeholder="مثال: كامل الدسم" required /></div>
                <div className="aa-field"><label>الحجم</label><input className="aa-input" value={variant.packageSize} onChange={(event) => updateVariant(index, "packageSize", event.target.value)} placeholder="مثال: 1 لتر" required /></div>
                <div className="aa-field"><label>السعر</label><input className="aa-input" type="number" min="0" step="0.01" value={variant.price} onChange={(event) => updateVariant(index, "price", Number(event.target.value))} required /></div>
                <div className="aa-field"><label>المخزون</label><input className="aa-input" type="number" min="0" step="1" value={variant.stockQuantity} onChange={(event) => updateVariant(index, "stockQuantity", Number(event.target.value))} required /></div>
                <label className="aa-check"><input type="checkbox" checked={variant.isAvailable} onChange={(event) => updateVariant(index, "isAvailable", event.target.checked)} /> متاح</label>
                <button type="button" className="aa-icon-btn danger" aria-label={`حذف النوع ${variant.nameAr || index + 1}`} onClick={() => removeVariant(index)}><Icon name="trash" size={15} /></button>
              </div>)}
            </div>
            <div className="aa-field full"><label htmlFor="aa-offer">وصف العرض</label><input id="aa-offer" className="aa-input" value={productEditor.values.offerDescription} onChange={(e) => updateProductValue("offerDescription", e.target.value)} /></div>
          </div>
          <div className="aa-checks">
            <label className="aa-check"><input type="checkbox" checked={productEditor.values.isActive} onChange={(e) => updateProductValue("isActive", e.target.checked)} /> المنتج مفعّل</label>
            <label className="aa-check"><input type="checkbox" checked={productEditor.values.isAvailable} onChange={(e) => updateProductValue("isAvailable", e.target.checked)} /> متاح للطلب</label>
            <label className="aa-check"><input type="checkbox" checked={productEditor.values.isFeatured} onChange={(e) => updateProductValue("isFeatured", e.target.checked)} /> منتج مميز</label>
            <label className="aa-check"><input type="checkbox" checked={productEditor.values.isBestSeller} onChange={(e) => updateProductValue("isBestSeller", e.target.checked)} /> الأكثر مبيعاً</label>
            <label className="aa-check"><input type="checkbox" checked={productEditor.values.isVariableWeight} onChange={(e) => updateProductValue("isVariableWeight", e.target.checked)} /> وزن متغير</label>
            <label className="aa-check"><input type="checkbox" checked={productEditor.values.isDemo} onChange={(e) => updateProductValue("isDemo", e.target.checked)} /> بيانات تجريبية</label>
          </div>
          {productEditor.values.isDemo && <div className="aa-notice"><strong>هذا منتج تجريبي.</strong> تحقّق من الاسم والسعر والوصف والتوفر. أزل العلامة فقط بعد اعتماد البيانات الفعلية.</div>}
          <hr className="aa-modal-divider" /><div className="aa-media-heading"><h3>صور وفيديوهات المنتج</h3><label className="aa-btn secondary small aa-upload-label"><Icon name="upload" size={15} /> إضافة ملفات<input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" multiple onChange={(e) => setPendingFiles(Array.from(e.target.files || []).slice(0, 5))} /></label></div>
          <p className="aa-help">حتى 5 ملفات في المرة الواحدة: صور JPG وPNG وWebP وGIF، وفيديو MP4 وWebM وMOV.</p>
          {pendingFiles.length > 0 && <p className="aa-help">{pendingFiles.map((file) => file.name).join("، ")}</p>}
          {productEditor.product && renderProductMedia(productEditor.product)}
          <div className="aa-modal-foot"><button className="aa-btn" disabled={busy["save-product"] || !categories.length}>{busy["save-product"] ? "جارٍ الحفظ…" : "حفظ المنتج"}</button><button type="button" className="aa-btn secondary" disabled={busy["save-product"]} onClick={() => setProductEditor(null)}>إلغاء</button></div>
        </div></form>
      </section>
    </div>}

    {categoryEditor && <div className="aa-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy["save-category"]) setCategoryEditor(null); }}>
      <section className="aa-modal compact" role="dialog" aria-modal="true" aria-labelledby="aa-category-title"><header className="aa-modal-head"><h2 id="aa-category-title">{categoryEditor.category ? "تعديل القسم" : "إضافة قسم"}</h2><button className="aa-icon-btn" aria-label="إغلاق" onClick={() => setCategoryEditor(null)}><Icon name="close" /></button></header>
        <form onSubmit={saveCategory}><div className="aa-modal-body"><div className="aa-field"><label htmlFor="aa-category-name">اسم القسم بالعربية *</label><input id="aa-category-name" className="aa-input" value={categoryEditor.nameAr} onChange={(e) => setCategoryEditor((prev) => prev ? { ...prev, nameAr: e.target.value } : prev)} required /></div>
          <div className="aa-field" style={{ marginTop: 13 }}><label htmlFor="aa-category-icon">رمز القسم</label><input id="aa-category-icon" className="aa-input" value={categoryEditor.icon} onChange={(e) => setCategoryEditor((prev) => prev ? { ...prev, icon: e.target.value } : prev)} placeholder="مثال: رمز نصي أو حرف" /><small style={{ color: "var(--muted)" }}>اكتب الرمز الذي يستخدمه المتجر لهذا القسم.</small></div>
          <div className="aa-modal-foot"><button className="aa-btn" disabled={busy["save-category"]}>{busy["save-category"] ? "جارٍ الحفظ…" : "حفظ القسم"}</button><button type="button" className="aa-btn secondary" onClick={() => setCategoryEditor(null)}>إلغاء</button></div>
        </div></form>
      </section>
    </div>}

    {selectedOrder && <div className="aa-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedOrder(null); }}>
      <section className="aa-modal compact" role="dialog" aria-modal="true" aria-labelledby="aa-order-title"><header className="aa-modal-head"><h2 id="aa-order-title">طلب <bdi dir="ltr">{selectedOrder.orderNumber}</bdi></h2><button className="aa-icon-btn" aria-label="إغلاق" onClick={() => setSelectedOrder(null)}><Icon name="close" /></button></header>
        <div className="aa-modal-body"><div className="aa-order-detail-status"><StatusPill status={selectedOrder.status} /><select className="aa-select" aria-label="تحديث حالة الطلب" value={selectedOrder.status} onChange={(event) => changeOrderStatus(selectedOrder, event.target.value as OrderStatus)}>{STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}</select></div>
          <div className="aa-order-detail-grid">
            <div className="aa-detail"><small>اسم العميل</small><strong>{selectedOrder.customerName}</strong></div><div className="aa-detail"><small>تاريخ الطلب</small><strong>{dateText(selectedOrder.createdAt)}</strong></div>
            <div className="aa-detail"><small>الهاتف</small><strong dir="ltr">{selectedOrder.phone || "—"}</strong></div><div className="aa-detail"><small>واتساب</small><strong dir="ltr">{selectedOrder.whatsappPhone || "—"}</strong></div>
            <div className="aa-detail"><small>طريقة الاستلام</small><strong>{selectedOrder.fulfillmentMethod || "—"}</strong></div><div className="aa-detail"><small>طريقة الدفع</small><strong>{selectedOrder.paymentMethod || "—"}</strong></div>
            <div className="aa-detail full"><small>العنوان</small><strong>{[selectedOrder.governorate, selectedOrder.city, selectedOrder.address, selectedOrder.landmark].filter(Boolean).join("، ") || "—"}</strong></div>
            {selectedOrder.notes && <div className="aa-detail full"><small>ملاحظات العميل</small><strong>{selectedOrder.notes}</strong></div>}
          </div>
          <div className="aa-order-items"><strong style={{ fontSize: 12 }}>محتويات الطلب</strong>{selectedOrder.items.map((item) => <div className="aa-order-item" key={item.id}><span>{item.nameAr}{item.variantName ? ` — ${item.variantName}` : ""} {item.packageSize ? `· ${item.packageSize}` : ""} × {new Intl.NumberFormat("ar-EG").format(item.quantity)}</span><strong className="aa-money">{money(item.lineTotal)}</strong></div>)}
            <div className="aa-order-item"><span>المجموع الفرعي</span><strong className="aa-money">{money(selectedOrder.subtotal)}</strong></div><div className="aa-order-item"><span>التوصيل</span><strong className="aa-money">{selectedOrder.deliveryFee === null ? "—" : money(selectedOrder.deliveryFee)}</strong></div><div className="aa-order-item"><strong>الإجمالي</strong><strong className="aa-money">{money(selectedOrder.total)}</strong></div>
          </div><div className="aa-info-box">تحديث الحالة يُحفظ في المتجر. إرسال تحديث واتساب للعميل يتم خارج لوحة الإدارة.</div>
        </div>
      </section>
    </div>}

    {confirm && <ConfirmDialog confirm={confirm} close={() => setConfirm(null)} busy={Object.entries(busy).some(([key, value]) => value && (key.startsWith("delete") || key.startsWith("remove") || key.startsWith("invite-") || key.startsWith("media-") || key.startsWith("status-")))} />}
  </div>;
}
