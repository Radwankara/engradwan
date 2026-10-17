import { useEffect, useState } from "react";
import { ArrowLeft, Clock3, PackageCheck, Save, UserRound } from "lucide-react";
import { storeApi, type AppUser, type StoreOrder } from "../lib/store-api";

interface AccountDashboardProps {
  user: AppUser;
  onUserUpdated: (user: AppUser) => void;
  onBrowseProducts: () => void;
  onSignOut: () => void;
}

const statusLabels: Record<string, string> = {
  pending: "بانتظار مراجعة المتجر",
  confirmed: "تم تأكيد الطلب",
  preparing: "جاري تجهيز الطلب",
  out_for_delivery: "الطلب في الطريق إليك",
  delivered: "تم التسليم",
  cancelled: "تم إلغاء الطلب",
};

const fieldClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15";

export default function AccountDashboard({
  user,
  onUserUpdated,
  onBrowseProducts,
  onSignOut,
}: AccountDashboardProps) {
  const [activeSection, setActiveSection] = useState<"profile" | "orders">("profile");
  const [profile, setProfile] = useState({
    fullName: user.fullName || "",
    phone: user.phone || "",
    whatsappPhone: user.whatsappPhone || "",
    governorate: user.governorate || "",
    city: user.city || "",
    address: user.address || "",
    landmark: user.landmark || "",
  });
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setProfile({
      fullName: user.fullName || "",
      phone: user.phone || "",
      whatsappPhone: user.whatsappPhone || "",
      governorate: user.governorate || "",
      city: user.city || "",
      address: user.address || "",
      landmark: user.landmark || "",
    });
  }, [user]);

  useEffect(() => {
    if (activeSection !== "orders") return;
    setOrdersLoading(true);
    storeApi
      .getMyOrders()
      .then(({ orders: loaded }) => setOrders(loaded))
      .catch((reason) => setError(reason instanceof Error ? reason.message : "تعذر تحميل الطلبات."))
      .finally(() => setOrdersLoading(false));
  }, [activeSection]);

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await storeApi.saveProfile(profile);
      onUserUpdated(result.user);
      setNotice("تم حفظ بيانات حسابك.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر حفظ البيانات.");
    } finally {
      setBusy(false);
    }
  };

  const cancelOrder = async (orderId: string) => {
    setBusy(true);
    setError("");
    try {
      await storeApi.cancelOrder(orderId);
      const { orders: refreshed } = await storeApi.getMyOrders();
      setOrders(refreshed);
      setNotice("تم إلغاء الطلب وإرجاع الكمية للمخزون.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر إلغاء الطلب.");
    } finally {
      setBusy(false);
    }
  };

  const updateField = (key: keyof typeof profile, value: string) =>
    setProfile((current) => ({ ...current, [key]: value }));

  return (
    <section className="mx-auto max-w-5xl space-y-6" dir="rtl">
      <header className="flex flex-wrap items-start justify-between gap-4 rounded-3xl bg-emerald-950 p-6 text-white sm:p-8">
        <div>
          <p className="text-xs font-bold text-emerald-200">حسابك في سوبر ماركت أبو عمار</p>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">
            أهلاً {user.fullName || user.email}
          </h1>
          <p className="mt-2 text-sm text-emerald-100/80">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={onBrowseProducts}
          className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-3 text-sm font-bold text-emerald-950 transition hover:bg-amber-300"
        >
          ابدأ التسوق <ArrowLeft className="h-4 w-4" />
        </button>
      </header>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveSection("profile")}
          className={`rounded-xl px-4 py-2.5 text-sm font-bold ${
            activeSection === "profile" ? "bg-emerald-700 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"
          }`}
        >
          <UserRound className="ml-2 inline h-4 w-4" /> بياناتي
        </button>
        <button
          type="button"
          onClick={() => setActiveSection("orders")}
          className={`rounded-xl px-4 py-2.5 text-sm font-bold ${
            activeSection === "orders" ? "bg-emerald-700 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"
          }`}
        >
          <PackageCheck className="ml-2 inline h-4 w-4" /> طلباتي
        </button>
      </div>

      {(notice || error) && (
        <div
          role={error ? "alert" : "status"}
          className={`rounded-xl border px-4 py-3 text-sm ${
            error ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-900"
          }`}
        >
          {error || notice}
        </div>
      )}

      {activeSection === "profile" ? (
        <form onSubmit={saveProfile} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <div className="mb-6">
            <h2 className="text-xl font-black text-slate-900">بيانات التوصيل</h2>
            <p className="mt-1 text-sm text-slate-500">احفظ بياناتك مرة واحدة لتسهيل الطلبات القادمة.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm font-bold text-slate-700">
              الاسم بالكامل
              <input required maxLength={120} className={fieldClass} value={profile.fullName} onChange={(e) => updateField("fullName", e.target.value)} />
            </label>
            <label className="space-y-1.5 text-sm font-bold text-slate-700">
              رقم الهاتف
              <input required type="tel" inputMode="tel" maxLength={20} placeholder="01012345678" className={fieldClass} value={profile.phone} onChange={(e) => updateField("phone", e.target.value)} />
            </label>
            <label className="space-y-1.5 text-sm font-bold text-slate-700">
              رقم واتساب إن كان مختلفًا
              <input type="tel" inputMode="tel" maxLength={20} placeholder="01012345678" className={fieldClass} value={profile.whatsappPhone} onChange={(e) => updateField("whatsappPhone", e.target.value)} />
            </label>
            <label className="space-y-1.5 text-sm font-bold text-slate-700">
              المحافظة
              <input required maxLength={100} className={fieldClass} value={profile.governorate} onChange={(e) => updateField("governorate", e.target.value)} />
            </label>
            <label className="space-y-1.5 text-sm font-bold text-slate-700">
              المدينة أو المنطقة
              <input required maxLength={120} className={fieldClass} value={profile.city} onChange={(e) => updateField("city", e.target.value)} />
            </label>
            <label className="space-y-1.5 text-sm font-bold text-slate-700 sm:col-span-2">
              العنوان بالتفصيل
              <textarea required rows={3} maxLength={240} className={fieldClass} value={profile.address} onChange={(e) => updateField("address", e.target.value)} />
            </label>
            <label className="space-y-1.5 text-sm font-bold text-slate-700 sm:col-span-2">
              علامة مميزة (اختياري)
              <input maxLength={160} className={fieldClass} value={profile.landmark} onChange={(e) => updateField("landmark", e.target.value)} />
            </label>
          </div>
          <div className="mt-6 flex flex-wrap justify-between gap-3">
            <button disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:opacity-50">
              <Save className="h-4 w-4" /> {busy ? "جاري الحفظ…" : "حفظ البيانات"}
            </button>
            <button type="button" onClick={onSignOut} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50">
              تسجيل الخروج
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          {ordersLoading ? (
            <div className="rounded-2xl bg-white p-10 text-center text-slate-500">جاري تحميل طلباتك…</div>
          ) : orders.length ? (
            orders.map((order) => (
              <article key={order.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-900">{order.orderNumber}</p>
                    <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500">
                      <Clock3 className="h-3.5 w-3.5" />
                      {new Date(order.createdAt).toLocaleString("ar-EG")}
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">
                    {statusLabels[order.status] || order.status}
                  </span>
                </div>
                <div className="my-4 space-y-2 border-y border-slate-100 py-3">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex justify-between gap-4 text-sm text-slate-600">
                      <span>{item.nameAr}{item.variantName ? ` — ${item.variantName}` : ""} ({item.packageSize}) × {item.quantity}</span>
                      <span className="shrink-0 font-bold text-slate-800">{item.lineTotal.toFixed(2)} ج.م</span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-black text-slate-900">
                    المنتجات: {order.subtotal.toFixed(2)} ج.م
                    {order.deliveryFee === null && <span className="mr-2 text-xs font-medium text-slate-500">رسوم التوصيل يحددها المتجر</span>}
                  </p>
                  {order.status === "pending" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => cancelOrder(order.id)}
                      className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      إلغاء الطلب
                    </button>
                  )}
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
              <PackageCheck className="mx-auto h-10 w-10 text-slate-300" />
              <h3 className="mt-3 font-bold text-slate-900">لسه مفيش طلبات</h3>
              <p className="mt-1 text-sm text-slate-500">طلباتك المؤكدة هتظهر هنا وتقدر تتابع حالتها.</p>
              <button type="button" onClick={onBrowseProducts} className="mt-4 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white">
                تصفح المنتجات
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
