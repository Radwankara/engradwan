import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useClerk, useUser } from '@clerk/react';
import { 
  ShoppingCart, Search, User, Phone, MapPin, Menu, X, ChevronDown, 
  Star, Heart, Plus, Minus, Trash2, CheckCircle2, ArrowRight, ShieldCheck, 
  Clock, Truck, RefreshCw, Filter, Sparkles, AlertCircle, ExternalLink, 
  Store, Tag, Percent, Flame, Check, Info, ChevronLeft, ShoppingBag
} from 'lucide-react';
import { DEMO_CATEGORY_PRODUCTS, CATEGORY_SUBCATEGORIES, SAMPLE_SUBCATEGORY_BY_PRODUCT_ID } from './src/data/demo-products';
import ProductAvailabilityAssistant from './src/components/ProductAvailabilityAssistant';
import AdminDashboard from './src/components/AdminDashboard';
import AccountDashboard from './src/components/AccountDashboard';
import { storeApi, type AppUser, type StoreCategory, type StoreProduct } from './src/lib/store-api';

// ==========================================
// CONFIGURATION & MOCK DATA (Sample Data)
// ==========================================
const STORE_CONFIG = {
  nameAr: "سوبر ماركت أبو عمار",
  taglineAr: "كل احتياجات بيتك في مكان واحد",
  phone: "",
  whatsappNumber: (import.meta.env.VITE_STORE_WHATSAPP || "").replace(/\D/g, ""),
  addressAr: "تُضاف بيانات العنوان من المتجر",
  workingHoursAr: "تُضاف مواعيد العمل من المتجر"
};

const CATEGORIES = [
  { id: 'all', nameAr: 'كل المنتجات', icon: 'Store', slug: 'all' },
  { id: 'vegetables', nameAr: 'الخضروات', icon: 'Sparkles', slug: 'vegetables' },
  { id: 'fruits', nameAr: 'الفاكهة', icon: 'Sparkles', slug: 'fruits' },
  { id: 'dairy', nameAr: 'الألبان والجبن', icon: 'Tag', slug: 'dairy' },
  { id: 'meat-poultry', nameAr: 'اللحوم والدواجن', icon: 'Flame', slug: 'meat-poultry' },
  { id: 'fish', nameAr: 'الأسماك', icon: 'Store', slug: 'fish' },
  { id: 'grocery', nameAr: 'البقالة', icon: 'ShoppingCart', slug: 'grocery' },
  { id: 'rice-pasta', nameAr: 'الأرز والمكرونة', icon: 'Tag', slug: 'rice-pasta' },
  { id: 'oils', nameAr: 'الزيوت والسمن', icon: 'Tag', slug: 'oils' },
  { id: 'canned-food', nameAr: 'المعلبات', icon: 'Store', slug: 'canned-food' },
  { id: 'beverages', nameAr: 'المشروبات', icon: 'Sparkles', slug: 'beverages' },
  { id: 'bakery', nameAr: 'المخبوزات', icon: 'Store', slug: 'bakery' },
  { id: 'frozen', nameAr: 'المجمدات', icon: 'Store', slug: 'frozen' },
  { id: 'snacks', nameAr: 'الحلويات والسناكس', icon: 'Sparkles', slug: 'snacks' },
  { id: 'cleaning', nameAr: 'المنظفات', icon: 'ShieldCheck', slug: 'cleaning' },
  { id: 'personal-care', nameAr: 'العناية الشخصية', icon: 'User', slug: 'personal-care' },
  { id: 'household', nameAr: 'مستلزمات المنزل', icon: 'Store', slug: 'household' }
];

const INITIAL_PRODUCTS = [
  {
    id: 'prod-1',
    slug: 'fresh-tomatoes',
    nameAr: 'طماطم طازجة ممتازة',
    brand: 'أبو عمار فريش',
    categoryId: 'vegetables',
    shortDescription: 'طماطم بلدية طازجة من أراضي مصرية نقية، مفروزة بعناية فائقة.',
    fullDescription: 'طماطم طازجة وعضوية تم قطفها حديثاً من أجود المزارع المصرية لتمنح طعامك الطعم الطبيعي الغني. مثالية للسلطات والصلصات والطبخ اليومي.',
    image: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=600&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=600&q=80'
    ],
    unit: 'كجم',
    packageSize: '1 كجم',
    price: 18.50,
    originalPrice: 22.00,
    discountPercentage: 16,
    offerDescription: 'عرض اليوم الطازج',
    stockQuantity: 150,
    isAvailable: true,
    isFeatured: true,
    isBestSeller: true,
    isVariableWeight: true,
    createdAt: '2026-01-01'
  },
  {
    id: 'prod-2',
    slug: 'fresh-bananas',
    nameAr: 'موز طازج استثماري',
    brand: 'مزارع الوادي',
    categoryId: 'fruits',
    shortDescription: 'موز حلو المذاق وطازج، غني بالطاقة والفيتامينات.',
    fullDescription: 'موز طازج عالي الجودة غني بالبوتاسيوم والطاقة الطبيعية. وجبة خفيفة مثالية وممتازة لتحضير العصائر.',
    image: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=600&q=80',
    gallery: ['https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=600&q=80'],
    unit: 'كجم',
    packageSize: '1 كجم',
    price: 32.00,
    originalPrice: 38.00,
    discountPercentage: 15,
    offerDescription: '',
    stockQuantity: 95,
    isAvailable: true,
    isFeatured: true,
    isBestSeller: true,
    isVariableWeight: true,
    createdAt: '2026-01-02'
  },
  {
    id: 'prod-3',
    slug: 'juhayna-milk-full-cream',
    nameAr: 'حليب جهينة كامل الدسم 1 لتر',
    brand: 'جهينة',
    categoryId: 'dairy',
    shortDescription: 'حليب طبيعي 100% طازج ومعقم كامل الدسم.',
    fullDescription: 'حليب جهينة طبيعي 100% غني بالكالسيوم والفيتامينات الأساسية لصحة العائلة. معقم بجودة عالية ليحافظ على الطعم الطازج والقيمة الغذائية.',
    image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80',
    gallery: ['https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80'],
    unit: 'لتر',
    packageSize: '1 لتر',
    price: 42.00,
    originalPrice: 45.00,
    discountPercentage: 6,
    offerDescription: 'عرض الأسبوع',
    stockQuantity: 200,
    isAvailable: true,
    isFeatured: true,
    isBestSeller: true,
    isVariableWeight: false,
    createdAt: '2026-01-03'
  },
  {
    id: 'prod-4',
    slug: 'egyptian-rice-el-malika',
    nameAr: 'أرز الملكة المصري الفاخر 5 كجم',
    brand: 'الملكة',
    categoryId: 'rice-pasta',
    shortDescription: 'أرز حبة متوسطة مصري ممتاز، مفلور ونظيف.',
    fullDescription: 'أرز الملكة المصري المختار بعناية فائقة. حبات متناسقة بيضاء ونقية تضمن لك أفضل طعم ومظهر في الأطباق المصرية الأصيلة.',
    image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80',
    gallery: ['https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80'],
    unit: 'كيس',
    packageSize: '5 كجم',
    price: 145.00,
    originalPrice: 160.00,
    discountPercentage: 9,
    offerDescription: 'خصم خاص',
    stockQuantity: 80,
    isAvailable: true,
    isFeatured: false,
    isBestSeller: true,
    isVariableWeight: false,
    createdAt: '2026-01-04'
  },
  {
    id: 'prod-5',
    slug: 'sunflower-oil-crystel',
    nameAr: 'زيت عباد الشمس كريستال 2.2 لتر',
    brand: 'كريستال',
    categoryId: 'oils',
    shortDescription: 'زيت نقي وصحي للقلي والطهي، صافي 100%.',
    fullDescription: 'زيت عباد الشمس كريستال نقي ومصفى بعناية، مثالي لكل أنواع الطهي والقلي والسلطات. خفيف وصحي ومناسب لعائلتك.',
    image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80',
    gallery: ['https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80'],
    unit: 'زجاجة',
    packageSize: '2.2 لتر',
    price: 185.00,
    originalPrice: 200.00,
    discountPercentage: 7,
    offerDescription: 'الأكثر طلباً',
    stockQuantity: 60,
    isAvailable: true,
    isFeatured: true,
    isBestSeller: true,
    isVariableWeight: false,
    createdAt: '2026-01-05'
  },
  {
    id: 'prod-6',
    slug: 'fresh-chicken-whole',
    nameAr: 'دجاج كامل طازج مبرد (1 كجم - 1.1 كجم)',
    brand: 'أبو عمار فريش',
    categoryId: 'meat-poultry',
    shortDescription: 'دجاج مبرد مذبوح على الشريعة الإسلامية يومياً.',
    fullDescription: 'دجاج طازج ومبرد بمعايير نظافة وجودة صارمة. مذبوح بعناية ومغلف لتضمن أقصى درجات النضارة والجودة لغذائك.',
    image: 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?auto=format&fit=crop&w=600&q=80',
    gallery: ['https://images.unsplash.com/photo-1587593810167-a84920ea0781?auto=format&fit=crop&w=600&q=80'],
    unit: 'قطعة',
    packageSize: '1000-1100 جم',
    price: 110.00,
    originalPrice: 125.00,
    discountPercentage: 12,
    offerDescription: 'طازج يومياً',
    stockQuantity: 40,
    isAvailable: true,
    isFeatured: true,
    isBestSeller: true,
    isVariableWeight: true,
    createdAt: '2026-01-06'
  },
  {
    id: 'prod-7',
    slug: 'persil-gel-detergent',
    nameAr: 'جل برسيل للغسالات الأوتوماتيك 3 لتر',
    brand: 'برسيل',
    categoryId: 'cleaning',
    shortDescription: 'قوة تنظيف فائقة ورائحة منعشة تدوم طويلاً.',
    fullDescription: 'جل برسيل المتطور لإزالة أصعب البقع والحفاظ على ألوان وبريق الملابس مع عطر منعش يدوم طويلاً طوال اليوم.',
    image: 'https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?auto=format&fit=crop&w=600&q=80',
    gallery: ['https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?auto=format&fit=crop&w=600&q=80'],
    unit: 'عبوة',
    packageSize: '3 لتر',
    price: 195.00,
    originalPrice: 220.00,
    discountPercentage: 11,
    offerDescription: 'عرض التوفير',
    stockQuantity: 50,
    isAvailable: true,
    isFeatured: false,
    isBestSeller: true,
    isVariableWeight: false,
    createdAt: '2026-01-07'
  },
  {
    id: 'prod-8',
    slug: 'domty-white-cheese',
    nameAr: 'جبنة تيدوم / دومتي بيضاء فيتا 1 كجم',
    brand: 'دومتي',
    categoryId: 'dairy',
    shortDescription: 'جبنة بيضاء طبيعية غنية بالكريمة والطعم الأصيل.',
    fullDescription: 'جبنة دومتي البيضاء المفضلة في كل منزل مصري، ناعمة المذاق وغنية بالكالسيوم، مثالية للفطور والعشاء.',
    image: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?auto=format&fit=crop&w=600&q=80',
    gallery: ['https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?auto=format&fit=crop&w=600&q=80'],
    unit: 'عبوة',
    packageSize: '1 كجم',
    price: 65.00,
    originalPrice: 72.00,
    discountPercentage: 9,
    offerDescription: '',
    stockQuantity: 110,
    isAvailable: true,
    isFeatured: false,
    isBestSeller: false,
    isVariableWeight: false,
    createdAt: '2026-01-08'
  },
  {
    id: 'prod-9',
    slug: 'pepsi-can-330ml',
    nameAr: 'مشروب غازي بيبسي كان 330 مل',
    brand: 'بيبسي',
    categoryId: 'beverages',
    shortDescription: 'مشروب منعش ومثالي لكل الأوقات والوجبات.',
    fullDescription: 'بيبسي المنعش بالفقاعات الغازية والمذاق الرائع الذي يروي عطشك ويضفي بهجة على طعامك وعزوماتك.',
    image: 'https://images.unsplash.com/photo-1629203851122-3726ecdf080e?auto=format&fit=crop&w=600&q=80',
    gallery: ['https://images.unsplash.com/photo-1629203851122-3726ecdf080e?auto=format&fit=crop&w=600&q=80'],
    unit: 'كان',
    packageSize: '330 مل',
    price: 12.00,
    originalPrice: 14.00,
    discountPercentage: 14,
    offerDescription: 'سقعه واروي عطشك',
    stockQuantity: 300,
    isAvailable: true,
    isFeatured: false,
    isBestSeller: true,
    isVariableWeight: false,
    createdAt: '2026-01-09'
  },
  {
    id: 'prod-10',
    slug: 'fresh-apples-red',
    nameAr: 'تفاح أحمر مستورد فاخر',
    brand: 'أبو عمار فريش',
    categoryId: 'fruits',
    shortDescription: 'تفاح أحمر مقرمش حلو وحامض بنكهة استثنائية.',
    fullDescription: 'تفاح أحمر طازج ومختار بعناية من أجود المحاصيل العالمية والمحلية، قرمشة لا تُقاوم وفيتامينات كاملة لصحتك.',
    image: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=600&q=80',
    gallery: ['https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=600&q=80'],
    unit: 'كجم',
    packageSize: '1 كجم',
    price: 55.00,
    originalPrice: 65.00,
    discountPercentage: 15,
    offerDescription: 'طازج وحلو',
    stockQuantity: 75,
    isAvailable: true,
    isFeatured: true,
    isBestSeller: false,
    isVariableWeight: true,
    createdAt: '2026-01-10'
  }
];

const CATALOG_PRODUCTS = [
  ...INITIAL_PRODUCTS.map(product => ({
    ...product,
    subcategoryAr: SAMPLE_SUBCATEGORY_BY_PRODUCT_ID[product.id] || "أصناف متنوعة"
  })),
  ...DEMO_CATEGORY_PRODUCTS
];

const normalizeArabic = (value) => value
  .normalize('NFKD')
  .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
  .replace(/[أإآٱ]/g, 'ا')
  .replace(/ى/g, 'ي')
  .replace(/ة/g, 'ه')
  .toLowerCase()
  .trim();

const makeWhatsAppUrl = (number, message) => {
  const digits = (number || '').replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : '';
};

export default function AbuAmmarApp() {
  const { isLoaded, isSignedIn, user: clerkUser } = useUser();
  const { signOut } = useClerk();
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [accountError, setAccountError] = useState('');
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([
    { id: 'all', nameAr: 'كل المنتجات', icon: 'Store', slug: 'all', sortOrder: -1 }
  ]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [orderError, setOrderError] = useState('');

  const refreshCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError('');
    try {
      const catalog = await storeApi.getCatalog();
      setCategories([
        { id: 'all', nameAr: 'كل المنتجات', icon: 'Store', slug: 'all', sortOrder: -1 },
        ...catalog.categories,
      ]);
      setProducts(catalog.products);
    } catch (error) {
      setCatalogError(error instanceof Error ? error.message : 'تعذر تحميل كتالوج المتجر.');
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCatalog();
  }, [refreshCatalog]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn || !clerkUser?.id) {
      setCurrentUser(null);
      setAccountError('');
      return;
    }
    let cancelled = false;
    setAccountError('');
    storeApi.getMe()
      .then(({ user }) => {
        if (!cancelled) setCurrentUser(user);
      })
      .catch((error) => {
        if (!cancelled) {
          setCurrentUser(null);
          setAccountError(error instanceof Error ? error.message : 'تعذر تحميل بيانات الحساب.');
        }
      });
    return () => { cancelled = true; };
  }, [isLoaded, isSignedIn, clerkUser?.id]);

  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem('abu_ammar_cart');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem('abu_ammar_favs');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [activeTab, setActiveTab] = useState('home'); // home | offers | products | cart | checkout | success | account | admin
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSubcategory, setSelectedSubcategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('popular');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null); // For Product Detail Modal
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notification, setNotification] = useState(null);
  const [lastOrderDetails, setLastOrderDetails] = useState(null);

  useEffect(() => {
    setSelectedSubcategory('all');
    setSelectedBrand('all');
  }, [selectedCategory]);

  useEffect(() => {
    if (!products.length) return;
    setCart((current) => current
      .map((item) => {
        const productId = item.productId || String(item.id).split('::')[0];
        const latest = products.find((product) => product.id === productId);
        if (!latest) return null;
        if (item.variantId) {
          const variant = (latest.variants || []).find((entry) => entry.id === item.variantId);
          if (!variant) return null;
          return {
            ...latest,
            id: `${productId}::${variant.id}`,
            productId,
            variantId: variant.id,
            variantName: variant.nameAr,
            packageSize: variant.packageSize,
            price: variant.price,
            stockQuantity: variant.stockQuantity,
            isAvailable: latest.isAvailable && variant.isAvailable,
            quantity: item.quantity,
          };
        }
        return { ...latest, id: productId, productId, variantId: '', quantity: item.quantity };
      })
      .filter(Boolean));
  }, [products]);

  // Sync Cart & Favorites with LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem('abu_ammar_cart', JSON.stringify(cart));
    } catch (e) {}
  }, [cart]);

  useEffect(() => {
    try {
      localStorage.setItem('abu_ammar_favs', JSON.stringify(favorites));
    } catch (e) {}
  }, [favorites]);

  // Toast Notification helper
  const showToast = (message) => {
    setNotification(message);
    setTimeout(() => {
      setNotification(null);
    }, 3500);
  };

  // Cart Handlers
  const addToCart = (product, qty = 1, variant = null) => {
    const productId = product.productId || product.id;
    if ((product.variants || []).length && !variant) {
      showToast('اختر نوع المنتج وحجمه أولاً');
      setSelectedProduct(product);
      return;
    }
    const cartProduct = variant ? {
      ...product,
      id: `${productId}::${variant.id}`,
      productId,
      variantId: variant.id,
      variantName: variant.nameAr,
      packageSize: variant.packageSize,
      price: variant.price,
      stockQuantity: variant.stockQuantity,
      isAvailable: product.isAvailable && variant.isAvailable,
    } : { ...product, id: productId, productId, variantId: '' };
    if (!cartProduct.isAvailable || cartProduct.stockQuantity <= 0) {
      showToast('هذا الخيار غير متاح حاليًا');
      return;
    }
    setCart(prev => {
      const existing = prev.find(item => item.id === cartProduct.id);
      const currentQuantity = existing?.quantity || 0;
      const allowedAddition = Math.min(qty, Math.max(0, cartProduct.stockQuantity - currentQuantity));
      if (allowedAddition === 0) {
        showToast('وصلت للكمية المتاحة من هذا الخيار');
        return prev;
      }
      if (existing) {
        return prev.map(item => 
          item.id === cartProduct.id ? { ...item, quantity: item.quantity + allowedAddition } : item
        );
      }
      return [...prev, { ...cartProduct, quantity: allowedAddition }];
    });
    showToast(`تمت إضافة "${product.nameAr}${variant ? ` — ${variant.nameAr}` : ''}" إلى السلة`);
  };

  const updateCartQuantity = (productId, delta) => {
    const item = cart.find(entry => entry.id === productId);
    if (!item) return;
    if (delta > 0 && item.quantity + delta > item.stockQuantity) {
      showToast('لا يمكن تجاوز الكمية الظاهرة في بيانات العرض');
      return;
    }
    setCart(prev => {
      return prev.map(item => {
        if (item.id === productId) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : null;
        }
        return item;
      }).filter(Boolean);
    });
  };

  const removeFromCart = (productId) => {
    setCart(prev => prev.filter(item => item.id !== productId));
    showToast("تم إزالة المنتج من السلة");
  };

  const clearCart = () => {
    setCart([]);
  };

  // Toggle Favorites
  const toggleFavorite = (productId) => {
    setFavorites(prev => {
      if (prev.includes(productId)) {
        showToast("تم الإزالة من المفضلة");
        return prev.filter(id => id !== productId);
      } else {
        showToast("تم الإضافة إلى المفضلة");
        return [...prev, productId];
      }
    });
  };

  const cartItemCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }, [cart]);

  // These are display-only demo values until the store supplies verified delivery pricing.
  const deliveryFee = cartSubtotal > 300 || cartSubtotal === 0 ? 0 : 25;
  const cartTotal = cartSubtotal + (cartSubtotal > 0 ? deliveryFee : 0);

  const visibleProducts = useMemo(() => products.filter(product => {
    const matchesCategory = selectedCategory === 'all' || product.categoryId === selectedCategory;
    const matchesSubcategory = selectedSubcategory === 'all' || product.subcategoryAr === selectedSubcategory;
    const matchesBrand = selectedBrand === 'all' || product.brand === selectedBrand;
    const matchesAvailability = !availableOnly || (product.isAvailable && product.stockQuantity > 0);
    const categoryName = categories.find(category => category.id === product.categoryId)?.nameAr || '';
    const searchable = normalizeArabic(`${product.nameAr} ${product.brand} ${categoryName} ${product.shortDescription} ${product.subcategoryAr}`);
    const matchesSearch = searchQuery === '' || searchable.includes(normalizeArabic(searchQuery));
    return matchesCategory && matchesSubcategory && matchesBrand && matchesAvailability && matchesSearch;
  }).sort((a, b) => {
    if (sortBy === 'price-asc') return a.price - b.price;
    if (sortBy === 'price-desc') return b.price - a.price;
    if (sortBy === 'newest') return String(b.createdAt).localeCompare(String(a.createdAt));
    return Number(b.isBestSeller) - Number(a.isBestSeller);
  }), [products, categories, selectedCategory, selectedSubcategory, selectedBrand, availableOnly, searchQuery, sortBy]);

  const availableBrands = Array.from(new Set(
    products
      .filter(product => selectedCategory === 'all' || product.categoryId === selectedCategory)
      .map(product => product.brand)
  ));
  const selectedSubcategories = Array.from(new Set(
    products
      .filter(product => product.categoryId === selectedCategory)
      .map(product => product.subcategoryAr)
      .filter(Boolean)
  ));
  const hasDemoProducts = products.some((product) => product.isDemo);
  const dailyOffers = useMemo(
    () => products.filter((product) => product.isActive && product.discountPercentage > 0),
    [products],
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans selection:bg-emerald-600 selection:text-white" dir="rtl">
      
      {/* Toast Notification Banner */}
      {notification && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-emerald-500 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-sm font-medium">{notification}</span>
        </div>
      )}

      {/* TOP NOTIFICATION BAR */}
      <div className="bg-emerald-900 text-emerald-50 text-xs py-2 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 bg-emerald-800 px-2.5 py-0.5 rounded-full">
              <Info className="w-3.5 h-3.5 text-amber-300" />
              عرض تجريبي — الأسعار والمخزون غير مؤكدين
            </span>
          </div>
          <div className="flex items-center gap-4">
            {STORE_CONFIG.whatsappNumber ? <a 
              href={makeWhatsAppUrl(STORE_CONFIG.whatsappNumber, "مرحباً، أريد الاستفسار عن منتجات سوبر ماركت أبو عمار")}
              target="_blank" 
              rel="noreferrer"
              className="text-emerald-200 hover:text-white flex items-center gap-1 transition-colors"
            >
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
              تواصل عبر واتساب
            </a> : <span className="text-emerald-200/80">رقم التواصل يُضاف من إعدادات المتجر</span>}
          </div>
        </div>
      </div>

      {/* HEADER */}
      {}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between gap-4">
          
          {/* Mobile Menu Button */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-slate-700 hover:bg-slate-150 transition-colors"
            aria-label="القائمة الرئيسية"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>

          {/* Brand Logo */}
          <div 
            onClick={() => setActiveTab('home')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-11 h-11 bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-xl flex items-center justify-center text-white shadow-md shadow-emerald-600/30 group-hover:scale-105 transition-transform">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-emerald-950 tracking-tight leading-none">
                سوبر ماركت أبو عمار
              </h1>
              <p className="text-xs text-emerald-700 font-medium mt-1">الجودة والأسعار اللي تفرحك</p>
            </div>
          </div>

          {/* Search Bar (Desktop) */}
          <div className="hidden md:flex flex-1 max-w-xl mx-4">
            <div className="relative w-full">
              <input 
                type="text"
                placeholder="بتدور على إيه؟ (ابحث عن منتج، ماركة، أو قسم...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if(e.key === 'Enter') setActiveTab('products'); }}
                className="w-full bg-slate-100 border border-slate-200 rounded-full py-2.5 pr-11 pl-28 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600/50 focus:bg-white transition-all shadow-inner"
              />
              <Search className="absolute right-4 top-3 w-4 h-4 text-slate-400" />
              <button 
                onClick={() => setActiveTab('products')}
                className="absolute left-1.5 top-1.5 bottom-1.5 bg-emerald-700 hover:bg-emerald-800 text-white px-5 rounded-full text-xs font-semibold transition-colors shadow-sm"
              >
                بحث
              </button>
            </div>
          </div>

          {/* Header Action Icons */}
          <div className="flex items-center gap-2 sm:gap-4">
            
            {/* WhatsApp Quick Link */}
            {STORE_CONFIG.whatsappNumber && <a 
              href={makeWhatsAppUrl(STORE_CONFIG.whatsappNumber, "مرحباً، أريد الاستفسار عن الطلبات")}
              target="_blank"
              rel="noreferrer"
              className="hidden lg:flex items-center gap-2 bg-emerald-50 text-emerald-800 px-3.5 py-2 rounded-xl text-xs font-semibold hover:bg-emerald-100 transition-colors border border-emerald-200"
            >
              <Phone className="w-4 h-4 text-emerald-600" />
              <span>واتساب</span>
            </a>}

            {isLoaded && (isSignedIn ? (
              <div className="hidden sm:flex items-center gap-2">
                <button onClick={() => setActiveTab('account')} className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100">
                  <User className="w-4 h-4 text-emerald-700" /><span>حسابي</span>
                </button>
                {currentUser?.role === 'admin' && <button onClick={() => setActiveTab('admin')} className="rounded-xl bg-amber-100 px-3 py-2 text-xs font-bold text-amber-950 hover:bg-amber-200">الإدارة</button>}
                <button onClick={() => void signOut({ redirectUrl: '/' })} className="rounded-xl px-2 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100">خروج</button>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-2">
                <a href="/sign-in" className="rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100">دخول</a>
                <a href="/sign-up" className="rounded-xl bg-amber-400 px-3 py-2 text-xs font-black text-slate-950 hover:bg-amber-300">حساب جديد</a>
              </div>
            ))}

            <button
              onClick={() => setActiveTab('assistant')}
              className="hidden md:flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition-colors"
            >
              <Search className="w-4 h-4" />
              اسأل عن منتج
            </button>

            {/* Shopping Cart Button */}
            <button 
              onClick={() => setActiveTab('cart')}
              className="relative flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-emerald-700/20 transition-all hover:scale-105"
            >
              <ShoppingCart className="w-5 h-5" />
              <span className="hidden sm:inline">السلة</span>
              {cartItemCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-amber-400 text-slate-950 font-black text-xs w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow animate-pulse">
                  {cartItemCount}
                </span>
              )}
            </button>

          </div>
        </div>

        {/* Mobile Search Bar */}
        <div className="md:hidden px-4 pb-3">
          <div className="relative w-full">
            <input 
              type="text"
              placeholder="بتدور على إيه؟..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if(e.key === 'Enter') setActiveTab('products'); }}
              className="w-full bg-slate-100 border border-slate-200 rounded-xl py-2 pr-10 pl-20 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600/50"
            />
            <Search className="absolute right-3.5 top-2.5 w-4 h-4 text-slate-400" />
            <button 
              onClick={() => setActiveTab('products')}
              className="absolute left-1 top-1 bottom-1 bg-emerald-700 text-white px-3 rounded-lg text-xs font-medium"
            >
              بحث
            </button>
          </div>
        </div>

        {/* Categories Navigation Bar */}
        <div className="bg-slate-50 border-t border-slate-200 overflow-x-auto scrollbar-none">
          <div className="max-w-7xl mx-auto px-4 flex items-center gap-1 sm:gap-2 py-2 whitespace-nowrap">
            <button 
              onClick={() => { setActiveTab('home'); setSelectedCategory('all'); }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'home' && selectedCategory === 'all'
                  ? 'bg-emerald-700 text-white shadow-sm' 
                  : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              الرئيسية
            </button>
            <button 
              onClick={() => { setActiveTab('products'); setSelectedCategory('all'); }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'products' && selectedCategory === 'all'
                  ? 'bg-emerald-700 text-white shadow-sm' 
                  : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              كل المنتجات
            </button>

            <button
              onClick={() => setActiveTab('offers')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'offers' ? 'bg-amber-400 text-slate-950 shadow-sm' : 'text-slate-700 hover:bg-amber-50'}`}
            >
              العروض اليومية
            </button>

            {categories.filter(c => c.id !== 'all').map(cat => (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setActiveTab('products');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedCategory === cat.id && activeTab === 'products'
                    ? 'bg-emerald-700 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                {cat.nameAr}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* MOBILE DRAWER MENU */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex justify-start md:hidden animate-fadeIn">
          <div className="w-80 bg-white h-full shadow-2xl flex flex-col p-6 overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-emerald-700 rounded-xl flex items-center justify-center text-white">
                  <Store className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900">سوبر ماركت أبو عمار</h3>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-slate-500 hover:text-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-6 flex flex-col gap-2">
              <button 
                onClick={() => { setActiveTab('home'); setSelectedCategory('all'); setMobileMenuOpen(false); }}
                className="text-right py-2.5 px-3 rounded-xl hover:bg-emerald-50 text-slate-800 font-semibold text-sm flex items-center gap-3"
              >
                <Store className="w-4 h-4 text-emerald-600" />
                الرئيسية
              </button>
              <button 
                onClick={() => { setActiveTab('products'); setSelectedCategory('all'); setMobileMenuOpen(false); }}
                className="text-right py-2.5 px-3 rounded-xl hover:bg-emerald-50 text-slate-800 font-semibold text-sm flex items-center gap-3"
              >
                <ShoppingBag className="w-4 h-4 text-emerald-600" />
                كل المنتجات والعروض
              </button>
              <button
                onClick={() => { setActiveTab('offers'); setMobileMenuOpen(false); }}
                className="text-right py-2.5 px-3 rounded-xl hover:bg-amber-50 text-slate-800 font-semibold text-sm flex items-center gap-3"
              >
                <Percent className="w-4 h-4 text-amber-600" />
                العروض اليومية
              </button>
              <button 
                onClick={() => { setActiveTab('account'); setMobileMenuOpen(false); }}
                className="text-right py-2.5 px-3 rounded-xl hover:bg-emerald-50 text-slate-800 font-semibold text-sm flex items-center gap-3"
              >
                <User className="w-4 h-4 text-emerald-600" />
                {isSignedIn ? 'حسابي وطلباتي' : 'تسجيل الدخول / حساب جديد'}
              </button>
              {currentUser?.role === 'admin' && <button onClick={() => { setActiveTab('admin'); setMobileMenuOpen(false); }} className="text-right py-2.5 px-3 rounded-xl hover:bg-amber-50 text-slate-800 font-semibold text-sm flex items-center gap-3"><ShieldCheck className="w-4 h-4 text-amber-600" />لوحة الإدارة</button>}
              {isSignedIn && <button onClick={() => { void signOut({ redirectUrl: '/' }); setMobileMenuOpen(false); }} className="text-right py-2.5 px-3 rounded-xl text-slate-500 hover:bg-slate-100 text-sm">تسجيل الخروج</button>}
              <button
                onClick={() => { setActiveTab('assistant'); setMobileMenuOpen(false); }}
                className="text-right py-2.5 px-3 rounded-xl hover:bg-emerald-50 text-slate-800 font-semibold text-sm flex items-center gap-3"
              >
                <Search className="w-4 h-4 text-emerald-600" />
                اسأل عن توفر منتج
              </button>

              <div className="my-4 border-t border-slate-200 pt-4">
                <p className="text-xs font-bold text-slate-400 mb-2 px-3">أقسام التسوق</p>
                {categories.filter(c => c.id !== 'all').map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      setActiveTab('products');
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-right py-2 px-3 rounded-lg hover:bg-slate-100 text-xs font-medium text-slate-600"
                  >
                    {cat.nameAr}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MAIN BODY CONTENT */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        
        {/* ========================================== */}
        {/* 1. HOMEPAGE VIEW                           */}
        {/* ========================================== */}
        {activeTab === 'home' && (
          <div className="space-y-10 animate-fadeIn">
            
            {/* A. Hero Banner */}
            {}
            <div className="relative bg-gradient-to-r from-emerald-900 via-emerald-800 to-emerald-950 text-white rounded-3xl p-6 sm:p-12 shadow-2xl overflow-hidden">
              <div className="absolute left-0 bottom-0 opacity-15 translate-x-10 translate-y-10 pointer-events-none">
                <Store className="w-96 h-96" />
              </div>
              <div className="relative z-10 max-w-2xl space-y-4">
                <span className="inline-flex items-center gap-1.5 bg-amber-400 text-slate-950 font-bold px-3.5 py-1 rounded-full text-xs shadow-sm">
                  <Sparkles className="w-3.5 h-3.5" />
                  كتالوج تجريبي قابل للتحديث
                </span>
                <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
                  كل احتياجات بيتك في مكان واحد
                </h2>
                <p className="text-emerald-100 text-sm sm:text-base leading-relaxed">
                  استكشف أقسام المنتجات، ابحث عن صنف، وجرّب إرسال ملخص طلب عبر واتساب. بيانات العرض والأسعار والتوفر الحالية أمثلة فقط.
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button 
                    onClick={() => { setActiveTab('products'); setSelectedCategory('all'); }}
                    className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-black px-7 py-3 rounded-xl text-sm shadow-lg shadow-amber-400/20 transition-all hover:scale-105 flex items-center gap-2"
                  >
                    <span>تسوق الآن</span>
                    <ArrowRight className="w-4 h-4 rotate-180" />
                  </button>
                  <button 
                    onClick={() => { setActiveTab('products'); setSelectedCategory('vegetables'); }}
                    className="bg-white/10 hover:bg-white/20 text-white border border-white/20 font-semibold px-6 py-3 rounded-xl text-sm transition-all"
                  >
                  استكشف الخضروات
                  </button>
                </div>
              </div>
            </div>

            {/* B. Featured Offers & Discounts */}
            {}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center font-bold">
                    <Flame className="w-5 h-5" />
                  </div>
                   <h3 className="text-xl font-bold text-slate-900">عروض أبو عمّار اليومية</h3>
                </div>
                <button 
                   onClick={() => setActiveTab('offers')} 
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                >
                  عرض الكل <ChevronLeft className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {dailyOffers.slice(0, 4).map(product => (
                  <ProductCard 
                    key={product.id} 
                    product={product} 
                    onAddToCart={addToCart} 
                    onToggleFavorite={toggleFavorite}
                    isFavorite={favorites.includes(product.id)}
                    onSelectProduct={setSelectedProduct}
                  />
                ))}
                {!dailyOffers.length && <p className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">العروض الجديدة ستظهر هنا عند إضافتها من لوحة الإدارة.</p>}
              </div>
            </div>

            {/* C. Shop by Category Grid */}
            {}
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-slate-900">تسوق حسب الأقسام</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                 {categories.filter(c => c.id !== 'all').map(cat => (
                  <div
                    key={cat.id}
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      setSelectedSubcategory('all');
                      setActiveTab('products');
                    }}
                    className="group bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-emerald-500 cursor-pointer transition-all flex flex-col items-center text-center gap-2"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center group-hover:bg-emerald-700 group-hover:text-white transition-colors shadow-inner">
                      <ShoppingBag className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">
                      {cat.nameAr}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* D. Best Sellers Grid */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                    <Star className="w-5 h-5 fill-amber-500 text-amber-500" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">اختيارات من الكتالوج التجريبي</h3>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {products.filter(p => p.isBestSeller).slice(0, 4).map(product => (
                  <ProductCard 
                    key={product.id} 
                    product={product} 
                    onAddToCart={addToCart} 
                    onToggleFavorite={toggleFavorite}
                    isFavorite={favorites.includes(product.id)}
                    onSelectProduct={setSelectedProduct}
                  />
                ))}
              </div>
            </div>

            {/* E. Why Shop with Abu Ammar */}
            {}
            <div className="bg-emerald-900/5 border border-emerald-900/10 rounded-3xl p-6 sm:p-8">
              <h3 className="text-xl font-bold text-emerald-950 text-center mb-8">ليه تختار تسوقك من سوبر ماركت أبو عمار؟</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                <div className="flex flex-col items-center text-center gap-3 p-4 bg-white rounded-2xl shadow-sm border border-slate-100">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Truck className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">كتالوج سهل التصفح</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">استكشف المنتجات بحسب القسم والنوع، وابحث عن المنتج أو العلامة التجارية.</p>
                </div>

                <div className="flex flex-col items-center text-center gap-3 p-4 bg-white rounded-2xl shadow-sm border border-slate-100">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">تفاصيل واضحة</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">تظهر وحدة القياس والعبوة بجانب كل صنف لتسهيل المقارنة.</p>
                </div>

                <div className="flex flex-col items-center text-center gap-3 p-4 bg-white rounded-2xl shadow-sm border border-slate-100">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Tag className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">بحث داخل المنتجات</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">اسأل مساعد الكتالوج إن كان الصنف ظاهرًا ضمن بيانات العرض التجريبية.</p>
                </div>

                <div className="flex flex-col items-center text-center gap-3 p-4 bg-white rounded-2xl shadow-sm border border-slate-100">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">واتساب برسالة جاهزة</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">جهّز ملخص الطلب في واتساب، ثم راجعه واضغط إرسال بنفسك.</p>
                </div>
              </div>
            </div>

          </div>
        )}

        {activeTab === 'offers' && (
          <section className="space-y-6 animate-fadeIn">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-l from-amber-300 via-amber-200 to-orange-100 p-7 sm:p-10">
              <div className="absolute -left-8 -top-10 h-56 w-56 rounded-full border-[34px] border-white/30" />
              <div className="relative max-w-2xl">
                <span className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-3 py-1 text-xs font-bold text-amber-200"><Flame className="h-4 w-4" /> عروض متجددة من أبو عمّار</span>
                <h2 className="mt-4 text-3xl font-black text-slate-950 sm:text-4xl">عروض اليوم</h2>
                <p className="mt-2 max-w-xl text-sm leading-7 text-slate-700">تابع الأسعار المخفّضة والاختيارات المميزة. تظهر العروض التي يحددها فريق المتجر من لوحة الإدارة.</p>
                <p className="mt-4 text-xs font-bold text-slate-600">{new Intl.NumberFormat('ar-EG').format(dailyOffers.length)} عرض متاح في الكتالوج</p>
              </div>
            </div>
            {dailyOffers.length ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {dailyOffers.map((product) => <ProductCard key={product.id} product={product} onAddToCart={addToCart} onToggleFavorite={toggleFavorite} isFavorite={favorites.includes(product.id)} onSelectProduct={setSelectedProduct} />)}
              </div>
            ) : <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center"><Percent className="mx-auto h-10 w-10 text-amber-500" /><h3 className="mt-3 text-lg font-bold text-slate-900">لا توجد عروض مفعّلة الآن</h3><p className="mt-1 text-sm text-slate-500">سيتم عرض أي منتج بخصم بمجرد تفعيله من لوحة الإدارة.</p></div>}
          </section>
        )}

        {/* ========================================== */}
        {/* 2. PRODUCTS & CATEGORY CATALOG VIEW        */}
        {/* ========================================== */}
        {activeTab === 'products' && (
          <div className="space-y-6 animate-fadeIn">
            
            {/* Catalog Header & Filters Bar */}
            <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {selectedCategory === 'all' ? 'جميع منتجات السوبر ماركت' : categories.find(c => c.id === selectedCategory)?.nameAr}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  بيانات هذا العرض تجريبية، ولا تؤكد المخزون أو الأسعار الفعلية في المتجر.
                </p>
              </div>

              {/* Category pills filter */}
              <div className="flex flex-wrap gap-1.5 justify-start md:justify-end">
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      selectedCategory === cat.id
                        ? 'bg-emerald-700 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {cat.nameAr}
                  </button>
                ))}
              </div>
            </div>

            {selectedCategory !== 'all' && selectedSubcategories.length > 0 && (
              <div className="bg-white px-4 py-3 rounded-2xl border border-slate-200 flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-500 ml-1">أنواع القسم:</span>
                {['all', ...selectedSubcategories].map(subcategory => (
                  <button
                    key={subcategory}
                    onClick={() => setSelectedSubcategory(subcategory)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                      selectedSubcategory === subcategory
                        ? 'bg-emerald-700 text-white'
                        : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                    }`}
                  >
                    {subcategory === 'all' ? 'كل الأنواع' : subcategory}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 px-1">
              <span className="text-xs text-slate-500">{visibleProducts.length} صنف تجريبي</span>
              <div className="flex flex-wrap items-center gap-3">
                {availableBrands.length > 1 && (
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    العلامة التجارية
                    <select value={selectedBrand} onChange={event => setSelectedBrand(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
                      <option value="all">كل العلامات</option>
                      {availableBrands.map(brand => <option key={brand} value={brand}>{brand}</option>)}
                    </select>
                  </label>
                )}
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input type="checkbox" checked={availableOnly} onChange={event => setAvailableOnly(event.target.checked)} />
                  المتاح في بيانات العينة فقط
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  ترتيب حسب
                  <select
                    value={sortBy}
                    onChange={event => setSortBy(event.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                  >
                    <option value="popular">الاقتراحات</option>
                    <option value="price-asc">السعر: الأقل أولاً</option>
                    <option value="price-desc">السعر: الأعلى أولاً</option>
                    <option value="newest">الأحدث</option>
                  </select>
                </label>
              </div>
            </div>

            {/* Products Grid */}
            {visibleProducts.length === 0 ? (
                  <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm space-y-4">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                      <Search className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">عذراً، لم نتمكن من العثور على منتجات مطابقة لبحثك</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      جرب البحث بكلمات أخرى أو اختر قسماً مختلفاً من أقسام سوبر ماركت أبو عمار.
                    </p>
                    <button 
                      onClick={() => { setSearchQuery(''); setSelectedCategory('all'); setSelectedSubcategory('all'); setSelectedBrand('all'); setAvailableOnly(false); }}
                      className="bg-emerald-700 text-white px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-emerald-800 transition-colors"
                    >
                      إعادة ضبط الفلاتر وبحث جديد
                    </button>
                  </div>
                ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {visibleProducts.map(product => (
                    <ProductCard 
                      key={product.id} 
                      product={product} 
                      onAddToCart={addToCart} 
                      onToggleFavorite={toggleFavorite}
                      isFavorite={favorites.includes(product.id)}
                      onSelectProduct={setSelectedProduct}
                    />
                  ))}
                </div>
              )}

          </div>
        )}

        {activeTab === 'assistant' && (
          <div className="max-w-4xl mx-auto py-4 sm:py-8 animate-fadeIn">
            <ProductAvailabilityAssistant products={products} />
            <p className="text-center text-xs text-slate-500 mt-4">
              المساعد الحالي يبحث محليًا في بيانات العرض فقط، وليس نموذج ذكاء اصطناعي أو مخزونًا مباشرًا.
            </p>
          </div>
        )}

        {activeTab === 'account' && (
          currentUser ? (
            <AccountDashboard
              user={currentUser}
              onUserUpdated={setCurrentUser}
              onBrowseProducts={() => setActiveTab('products')}
              onSignOut={() => void signOut({ redirectUrl: '/' })}
            />
          ) : (
            <section className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <User className="mx-auto h-10 w-10 text-emerald-700" />
              <h2 className="mt-4 text-xl font-black text-slate-900">{isSignedIn ? 'جارٍ تجهيز حسابك' : 'سجّل الدخول لمتابعة حسابك'}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">{accountError || 'من حسابك تقدر تراجع طلباتك وتحفظ بيانات التوصيل.'}</p>
              {!isSignedIn && <div className="mt-5 flex justify-center gap-3"><a href="/sign-in" className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white">تسجيل الدخول</a><a href="/sign-up" className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700">إنشاء حساب</a></div>}
            </section>
          )
        )}

        {/* ========================================== */}
        {/* 3. SHOPPING CART VIEW                      */}
        {/* ========================================== */}
        {}
        {activeTab === 'cart' && (
          <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn">
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between pb-6 border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                    <ShoppingCart className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900">سلة التسوق الخاصة بك</h2>
                    <p className="text-xs text-slate-500">لديك {cartItemCount} منتج في السلة</p>
                  </div>
                </div>
                {cart.length > 0 && (
                  <button 
                    onClick={clearCart}
                    className="text-red-600 hover:text-red-700 text-xs font-bold flex items-center gap-1 bg-red-50 px-3 py-2 rounded-xl transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    إفراغ السلة
                  </button>
                )}
              </div>

              {cart.length === 0 ? (
                <div className="text-center py-16 space-y-4">
                  <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                    <ShoppingBag className="w-10 h-10" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">سلة التسوق فارغة حالياً</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    لم تقم بإضافة أي منتجات إلى سلتك بعد. تصفح الأقسام واختر ما تحتاجه لبيتك بكل سهولة.
                  </p>
                  <button 
                    onClick={() => setActiveTab('products')}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-8 py-3 rounded-xl text-sm shadow-lg shadow-emerald-700/20 transition-all"
                  >
                    ابدأ التسوق الآن
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-6">
                  
                  {/* Cart Items List */}
                  <div className="lg:col-span-2 space-y-4">
                    {cart.map(item => (
                      <div key={item.id} className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:border-emerald-500/50 transition-colors">
                        {item.image ? <img 
                          src={item.image} 
                          alt={item.nameAr} 
                          className="w-20 h-20 object-cover rounded-xl shrink-0 bg-white"
                          onError={(e) => { e.target.src = 'https://placehold.co/100x100/e2e8f0/1e293b?text=منتج'; }}
                        /> : <div className="w-20 h-20 rounded-xl shrink-0 bg-gradient-to-br from-emerald-50 to-amber-50 text-emerald-800 flex items-center justify-center"><ShoppingBag className="w-7 h-7" /></div>}
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md">
                            {item.brand}
                          </span>
                          <h4 className="font-bold text-slate-900 text-sm mt-1 truncate">{item.nameAr}</h4>
                          <p className="text-xs text-slate-500">{item.packageSize}</p>
                          <div className="text-emerald-700 font-black text-sm mt-1">
                            {item.price.toFixed(2)} ج.م
                            {item.isVariableWeight && <span className="text-[10px] text-slate-400 font-normal mr-1">(تقريبي للوزن)</span>}
                          </div>
                          <span className="text-[10px] text-amber-700">سعر تجريبي</span>
                        </div>

                        {/* Quantity controls */}
                        <div className="flex flex-col sm:flex-row items-center gap-2">
                          <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden shadow-inner">
                            <button 
                              onClick={() => updateCartQuantity(item.id, 1)}
                              className="p-2 hover:bg-slate-100 text-slate-700 transition-colors"
                              aria-label="زيادة الكمية"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-8 text-center text-xs font-bold text-slate-900">{item.quantity}</span>
                            <button 
                              onClick={() => updateCartQuantity(item.id, -1)}
                              className="p-2 hover:bg-slate-100 text-slate-700 transition-colors"
                              aria-label="تقليل الكمية"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <button 
                            onClick={() => removeFromCart(item.id)}
                            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors"
                            aria-label="حذف المنتج"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Cart Summary Card */}
                  <div className="bg-emerald-900/5 p-6 rounded-3xl border border-emerald-900/10 space-y-4 h-fit">
                    <h3 className="font-bold text-slate-900 border-b border-slate-200 pb-3">ملخص الفاتورة</h3>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-slate-600">
                        <span>إجمالي المنتجات:</span>
                        <span className="font-bold text-slate-900">{cartSubtotal.toFixed(2)} ج.م</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>رسوم التوصيل:</span>
                        <span className="font-bold text-emerald-700">
                          {deliveryFee === 0 ? '0.00 ج.م' : `${deliveryFee} ج.م`}
                        </span>
                      </div>
                      <div className="border-t border-slate-200 pt-3 flex justify-between text-base font-black text-slate-900">
                        <span>المبلغ الإجمالي:</span>
                        <span className="text-emerald-700">{cartTotal.toFixed(2)} ج.م</span>
                      </div>
                    </div>

                    <button 
                      onClick={() => setActiveTab('checkout')}
                      className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3.5 rounded-2xl text-sm shadow-lg shadow-emerald-700/20 transition-all flex items-center justify-center gap-2"
                    >
                      <span>إتمام الطلب والدفع</span>
                      <ArrowRight className="w-4 h-4 rotate-180" />
                    </button>

                    <button 
                      onClick={() => setActiveTab('products')}
                      className="w-full bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold py-2.5 rounded-2xl text-xs transition-colors"
                    >
                      متابعة التسوق
                    </button>
                  </div>

                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* 4. CHECKOUT VIEW                           */}
        {/* ========================================== */}
        {}
        {activeTab === 'checkout' && (
          <CheckoutView 
            cart={cart} 
            cartSubtotal={cartSubtotal} 
            deliveryFee={deliveryFee} 
            cartTotal={cartTotal} 
            user={currentUser}
            isSignedIn={Boolean(isSignedIn)}
            authLoaded={isLoaded}
            onOrderSuccess={(orderData) => {
              setLastOrderDetails(orderData);
              clearCart();
              setActiveTab('success');
            }}
            onBackToCart={() => setActiveTab('cart')}
          />
        )}

        {/* ========================================== */}
        {/* 5. ORDER SUCCESS & WHATSAPP CONFIRMATION   */}
        {/* ========================================== */}
        {activeTab === 'success' && lastOrderDetails && (
          <div className="max-w-2xl mx-auto bg-white p-8 sm:p-12 rounded-3xl border border-slate-200 shadow-xl text-center space-y-6 animate-fadeIn">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <span className="bg-emerald-50 text-emerald-800 font-bold px-3.5 py-1 rounded-full text-xs border border-emerald-200">
                رقم الطلب: {lastOrderDetails.orderId}
              </span>
              <h2 className="text-2xl font-black text-slate-900 mt-2">ملخص الطلب جاهز</h2>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                تم تسجيل الطلب في حسابك. افتح مسودة واتساب لمراجعة التفاصيل وإرسالها يدويًا للمتجر.
              </p>
            </div>

            {/* WhatsApp Send Button */}
            <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-2xl space-y-3">
              <h4 className="font-bold text-slate-900 text-sm">إرسال ملخص الطلب عبر واتساب</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                {STORE_CONFIG.whatsappNumber ? 'افتح رسالة الطلب المعبأة إلى المتجر، راجع البيانات والأسعار، ثم اضغط إرسال داخل واتساب.' : 'أضف رقم واتساب المتجر الدولي في VITE_STORE_WHATSAPP لتفعيل رابط الرسالة.'}
              </p>
              
              {STORE_CONFIG.whatsappNumber && <a 
                href={makeWhatsAppUrl(STORE_CONFIG.whatsappNumber, lastOrderDetails.whatsappMessage)}
                target="_blank"
                rel="noreferrer"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl text-sm shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2"
              >
                <Phone className="w-5 h-5" />
                <span>إرسال الطلب عبر واتساب الآن</span>
                <ExternalLink className="w-4 h-4" />
              </a>}
              <p className="text-[10px] text-amber-700">
                الرابط يفتح مسودة فقط ولا يرسلها تلقائياً. الطلب يظل غير مؤكد حتى يراجعه المتجر ويرد عليك.
              </p>
            </div>

            <div className="pt-4 flex justify-center gap-4">
              <button 
                onClick={() => setActiveTab('home')}
                className="bg-slate-900 text-white font-bold px-8 py-3 rounded-xl text-xs hover:bg-slate-800 transition-colors"
              >
                العودة للرئيسية
              </button>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* 6. ADMIN DEMO VIEW                         */}
        {/* ========================================== */}
        {activeTab === 'admin' && (
          currentUser?.role === 'admin' ? (
            <AdminDashboard user={currentUser} onCatalogChanged={() => { void refreshCatalog(); }} />
          ) : (
            <section className="mx-auto max-w-xl rounded-3xl border border-amber-200 bg-white p-8 text-center shadow-sm">
              <ShieldCheck className="mx-auto h-10 w-10 text-amber-600" />
              <h2 className="mt-4 text-xl font-black text-slate-900">لوحة الإدارة مخصصة لفريق المتجر</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">{isSignedIn ? 'هذا الحساب لديه صلاحية التسوق ومتابعة الطلبات فقط.' : 'سجّل الدخول بحساب مسؤول معتمد للوصول إلى إدارة المتجر.'}</p>
              {!isSignedIn && <a href="/sign-in" className="mt-5 inline-flex rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white">تسجيل دخول المسؤول</a>}
              <button onClick={() => setActiveTab('home')} className="mt-5 block w-full text-sm font-bold text-emerald-700">العودة إلى المتجر</button>
            </section>
          )
        )}

      </main>

      {/* PRODUCT DETAIL MODAL */}
      {selectedProduct && (
        <ProductDetailModal 
          product={selectedProduct} 
          onClose={() => setSelectedProduct(null)} 
          onAddToCart={addToCart}
          onToggleFavorite={toggleFavorite}
          isFavorite={favorites.includes(selectedProduct.id)}
        />
      )}

      {/* FOOTER */}
      {}
      <footer className="bg-emerald-950 text-emerald-50 mt-16 pt-12 pb-8 border-t border-emerald-900">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8 pb-12 border-b border-emerald-900/60">
          
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white">
                <Store className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg text-white">سوبر ماركت أبو عمار</h3>
            </div>
            <p className="text-xs text-emerald-200/80 leading-relaxed">
              واجهة تجريبية لاستكشاف أقسام المنتجات وتجربة البحث والسلة. بيانات الأسعار والتوفر ليست مخزوناً حقيقياً.
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="font-bold text-white text-sm">أقسام التسوق السريع</h4>
            <ul className="space-y-2 text-xs text-emerald-200/80">
              <li><button onClick={() => { setSelectedCategory('vegetables'); setActiveTab('products'); }} className="hover:text-white transition-colors">الخضروات والفاكهة</button></li>
              <li><button onClick={() => { setSelectedCategory('dairy'); setActiveTab('products'); }} className="hover:text-white transition-colors">الألبان والجبن</button></li>
              <li><button onClick={() => { setSelectedCategory('meat-poultry'); setActiveTab('products'); }} className="hover:text-white transition-colors">اللحوم والدواجن</button></li>
              <li><button onClick={() => { setSelectedCategory('grocery'); setActiveTab('products'); }} className="hover:text-white transition-colors">البقالة العامة والأرز</button></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="font-bold text-white text-sm">معلومات التواصل</h4>
            <ul className="space-y-2 text-xs text-emerald-200/80">
              <li className="flex items-center gap-2"><MapPin className="w-4 h-4 text-emerald-400" /> {STORE_CONFIG.addressAr}</li>
              {STORE_CONFIG.phone && <li className="flex items-center gap-2"><Phone className="w-4 h-4 text-emerald-400" /> {STORE_CONFIG.phone}</li>}
              <li className="flex items-center gap-2"><Clock className="w-4 h-4 text-emerald-400" /> {STORE_CONFIG.workingHoursAr}</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="font-bold text-white text-sm">التواصل عبر واتساب</h4>
            <p className="text-xs text-emerald-200/80 leading-relaxed">
              {STORE_CONFIG.whatsappNumber ? 'افتح محادثة واتساب برسالة جاهزة، ثم اضغط إرسال داخل التطبيق.' : 'أضف رقم واتساب الرسمي للمتجر لتفعيل رابط التواصل.'}
            </p>
            {STORE_CONFIG.whatsappNumber && <a 
              href={makeWhatsAppUrl(STORE_CONFIG.whatsappNumber, "مرحباً، أريد الاستفسار عن منتجات سوبر ماركت أبو عمار")}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md"
            >
              <Phone className="w-4 h-4" />
              <span>راسلنا الآن</span>
            </a>}
          </div>

        </div>

        <div className="max-w-7xl mx-auto px-4 pt-6 flex flex-col sm:flex-row justify-between items-center text-xs text-emerald-300/60 gap-4">
          <p>© 2026 سوبر ماركت أبو عمار — نسخة تجريبية</p>
          <p>الأسعار والمخزون المعروض بيانات توضيحية وليست تأكيداً من المتجر.</p>
        </div>
      </footer>

    </div>
  );
}

// ==========================================
// PRODUCT CARD COMPONENT
// ==========================================
function ProductCard({ product, onAddToCart, onToggleFavorite, isFavorite, onSelectProduct }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-lg hover:border-emerald-500/50 transition-all flex flex-col overflow-hidden group">
      
      {/* Top Image Container */}
      <div className="relative bg-slate-100 h-44 overflow-hidden cursor-pointer" onClick={() => onSelectProduct(product)}>
        {product.image ? <img 
          src={product.image} 
          alt={product.nameAr}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => { e.target.src = 'https://placehold.co/400x300/e2e8f0/1e293b?text=منتج+أبو+عمار'; }}
        /> : <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-emerald-50 to-amber-50 text-emerald-800">
          <ShoppingBag className="w-9 h-9 opacity-70" />
          <span className="text-xs font-bold">{product.subcategoryAr || 'منتج تجريبي'}</span>
        </div>}
        
        {/* Discount Badge */}
        {product.discountPercentage > 0 && (
          <span className="absolute top-2.5 right-2.5 bg-red-600 text-white font-black text-[10px] px-2.5 py-1 rounded-lg shadow">
            خصم {product.discountPercentage}%
          </span>
        )}

        {/* Favorite Button */}
        <button 
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(product.id); }}
          className={`absolute top-2.5 left-2.5 p-2 rounded-xl backdrop-blur-md transition-colors ${
            isFavorite ? 'bg-red-50 text-red-600' : 'bg-white/80 text-slate-600 hover:text-red-600'
          }`}
          aria-label="إضافة للمفضلة"
        >
          <Heart className={`w-4 h-4 ${isFavorite ? 'fill-red-600' : ''}`} />
        </button>

        {product.offerDescription && (
          <span className="absolute bottom-2 right-2 bg-emerald-900/80 backdrop-blur-sm text-white font-medium text-[10px] px-2 py-0.5 rounded">
            {product.offerDescription}
          </span>
        )}
        <span className="absolute bottom-2 left-2 bg-slate-950/75 text-white font-bold text-[9px] px-2 py-1 rounded-md">
          {product.isAvailable && product.stockQuantity > 0 ? 'ظاهر في العينة' : 'غير متاح في العينة'}
        </span>
      </div>

      {/* Content Container */}
      <div className="p-4 flex flex-col flex-1 justify-between gap-3">
        <div className="space-y-1 cursor-pointer" onClick={() => onSelectProduct(product)}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
              {product.brand}
            </span>
            <span className="text-[10px] text-slate-400">{product.packageSize}</span>
          </div>

          <h4 className="font-bold text-slate-900 text-sm line-clamp-1 group-hover:text-emerald-700 transition-colors">
            {product.nameAr}
          </h4>
          <span className="inline-flex text-[9px] text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full">{product.subcategoryAr || 'أصناف متنوعة'}</span>

          <p className="text-xs text-slate-500 line-clamp-1">
            {product.shortDescription}
          </p>
        </div>

        {/* Price & Add to Cart */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-black text-emerald-800">{product.price.toFixed(2)}</span>
              <span className="text-xs text-slate-500">ج.م</span>
            </div>
            <span className="text-[10px] text-amber-700">سعر عرض تجريبي</span>
            {product.originalPrice > product.price && (
              <span className="text-[11px] text-slate-400 line-through">
                {product.originalPrice.toFixed(2)} ج.م
              </span>
            )}
          </div>

          <button 
            onClick={() => (product.variants?.length ? onSelectProduct(product) : onAddToCart(product))}
            disabled={!product.isAvailable || product.stockQuantity <= 0}
            className="bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-md shadow-emerald-700/20 transition-all flex items-center gap-1.5 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{product.variants?.length ? 'اختر النوع' : 'أضف للسلة'}</span>
          </button>
        </div>

      </div>

    </div>
  );
}

// ==========================================
// PRODUCT DETAIL MODAL COMPONENT
// ==========================================
function ProductDetailModal({ product, onClose, onAddToCart, onToggleFavorite, isFavorite }) {
  const [qty, setQty] = useState(1);
  const variants = product.variants || [];
  const availableVariants = variants.filter((variant) => variant.isAvailable && variant.stockQuantity > 0);
  const [selectedVariantId, setSelectedVariantId] = useState(availableVariants[0]?.id || '');
  const selectedVariant = variants.find((variant) => variant.id === selectedVariantId) || null;
  const selectedPrice = selectedVariant?.price ?? product.price;
  const selectedOriginalPrice = selectedVariant?.originalPrice ?? product.originalPrice;
  const selectedPackageSize = selectedVariant?.packageSize || product.packageSize;
  const selectedStock = selectedVariant?.stockQuantity ?? product.stockQuantity;
  const mediaItems = product.media?.length
    ? product.media
    : [
      ...(product.gallery || []).map((url, index) => ({ id: `gallery-${index}`, mediaType: 'image', url })),
      ...(product.videos || []),
    ];
  if (!mediaItems.length && product.image) mediaItems.push({ id: 'main-image', mediaType: 'image', url: product.image });
  const [activeMediaId, setActiveMediaId] = useState(mediaItems[0]?.id || '');
  const activeMedia = mediaItems.find((item) => item.id === activeMediaId) || mediaItems[0];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]">
        
        {/* Product Image section */}
        <div className="md:w-1/2 bg-slate-100 relative p-6 flex items-center justify-center">
          {activeMedia?.mediaType === 'video' ? <video
            src={activeMedia.url}
            controls
            playsInline
            className="w-full h-64 md:h-full object-contain rounded-2xl bg-slate-950"
            aria-label={`فيديو ${product.nameAr}`}
          /> : activeMedia?.url ? <img 
            src={activeMedia.url} 
            alt={product.nameAr}
            className="w-full h-64 md:h-full object-cover rounded-2xl"
            onError={(e) => { e.target.src = 'https://placehold.co/400x400/e2e8f0/1e293b?text=صورة+المنتج'; }}
          /> : <div className="w-full h-64 md:h-full min-h-64 rounded-2xl bg-gradient-to-br from-emerald-50 to-amber-50 flex flex-col items-center justify-center gap-3 text-emerald-800">
            <ShoppingBag className="w-12 h-12 opacity-70" />
            <span className="text-sm font-bold">{product.subcategoryAr || 'منتج تجريبي'}</span>
          </div>}
          {mediaItems.length > 1 && <div className="absolute bottom-4 inset-x-4 flex gap-2 overflow-x-auto rounded-xl bg-white/85 p-2 backdrop-blur">
            {mediaItems.map((item, index) => <button key={item.id} onClick={() => setActiveMediaId(item.id)} className={`h-12 w-12 shrink-0 overflow-hidden rounded-lg border-2 ${activeMedia?.id === item.id ? 'border-emerald-700' : 'border-transparent'}`} aria-label={`عرض الوسيط ${index + 1}`}>
              {item.mediaType === 'video' ? <span className="grid h-full w-full place-items-center bg-slate-900 text-[9px] font-bold text-white">فيديو</span> : <img src={item.url} alt="" className="h-full w-full object-cover" />}
            </button>)}
          </div>}
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 md:hidden bg-white p-2 rounded-full shadow"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Details section */}
        <div className="md:w-1/2 p-6 md:p-8 flex flex-col justify-between overflow-y-auto space-y-4">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md">
                {product.brand}
              </span>
              <button 
                onClick={onClose}
                className="hidden md:flex p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <h3 className="text-xl font-black text-slate-900">{product.nameAr}</h3>
            <p className="text-xs text-slate-500">القسم: {product.categoryNameAr || 'أصناف متنوعة'} · النوع: {product.subcategoryAr || 'أصناف متنوعة'}</p>
            {variants.length > 0 && <div className="space-y-2 pt-1">
              <p className="text-xs font-bold text-slate-700">اختار النوع والحجم</p>
              <div className="grid grid-cols-2 gap-2">
                {variants.map((variant) => {
                  const unavailable = !variant.isAvailable || variant.stockQuantity < 1;
                  return <button key={variant.id} type="button" disabled={unavailable} onClick={() => { setSelectedVariantId(variant.id); setQty(1); }} className={`rounded-xl border p-3 text-right transition-colors ${selectedVariantId === variant.id ? 'border-emerald-700 bg-emerald-50 ring-1 ring-emerald-700' : 'border-slate-200 bg-white hover:border-emerald-400'} disabled:cursor-not-allowed disabled:opacity-45`}>
                    <span className="block text-xs font-bold text-slate-900">{variant.nameAr}</span>
                    <span className="mt-1 block text-[10px] text-slate-500">{variant.packageSize} · {variant.price.toFixed(2)} ج.م</span>
                    {unavailable && <span className="mt-1 block text-[10px] font-bold text-red-600">غير متاح</span>}
                  </button>;
                })}
              </div>
            </div>}
            
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-800">{selectedPrice.toFixed(2)} ج.م</span>
              {selectedOriginalPrice > selectedPrice && (
                <span className="text-sm text-slate-400 line-through">{selectedOriginalPrice.toFixed(2)} ج.م</span>
              )}
              <span className="text-xs text-slate-500">({selectedPackageSize})</span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {product.fullDescription}
            </p>

            {product.isVariableWeight && (
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-[11px] text-amber-800">
                * منتج متغير الوزن: يتم تقدير السعر مبدئياً بناءً على الحجم المحدد، وقد يختلف السعر النهائي قليلاً حسب الوزن الفعلي عند التحضير.
              </div>
            )}
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-200">
            {/* Quantity selector */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">الكمية المطلوبة:</span>
              <div className="flex items-center bg-slate-100 rounded-xl border border-slate-200 overflow-hidden">
                <button 
                  onClick={() => setQty(Math.max(1, qty - 1))}
                  className="px-3 py-1.5 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  -
                </button>
                <span className="w-10 text-center font-bold text-sm">{qty}</span>
                <button 
                  onClick={() => setQty(Math.min(selectedStock, qty + 1))}
                  className="px-3 py-1.5 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                disabled={!product.isAvailable || selectedStock <= 0 || (variants.length > 0 && !selectedVariant)}
                onClick={() => {
                  onAddToCart(product, qty, selectedVariant);
                  onClose();
                }}
                className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white py-3 rounded-xl text-sm font-bold shadow-lg shadow-emerald-700/20 transition-all flex items-center justify-center gap-2"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>إضافة إلى السلة ({ (selectedPrice * qty).toFixed(2) } ج.م)</span>
              </button>
              <button 
                onClick={() => onToggleFavorite(product.id)}
                className={`p-3 rounded-xl border transition-colors ${isFavorite ? 'bg-red-50 border-red-200 text-red-600' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}`}
                aria-label="المفضلة"
              >
                <Heart className={`w-5 h-5 ${isFavorite ? 'fill-red-600' : ''}`} />
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

// ==========================================
// CHECKOUT VIEW COMPONENT
// ==========================================
function CheckoutView({ cart, cartSubtotal, deliveryFee, cartTotal, user, isSignedIn, authLoaded, onOrderSuccess, onBackToCart }) {
  const [formData, setFormData] = useState({
    fullName: user?.fullName || '',
    phone: user?.phone || '',
    whatsappPhone: user?.whatsappPhone || '',
    governorate: user?.governorate || '',
    city: user?.city || '',
    address: user?.address || '',
    landmark: user?.landmark || '',
    fulfillmentMethod: 'delivery',
    paymentMethod: 'cash_on_delivery',
    notes: ''
  });

  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!user) return;
    setFormData((current) => ({
      ...current,
      fullName: current.fullName || user.fullName || '',
      phone: current.phone || user.phone || '',
      whatsappPhone: current.whatsappPhone || user.whatsappPhone || '',
      governorate: current.governorate || user.governorate || '',
      city: current.city || user.city || '',
      address: current.address || user.address || '',
      landmark: current.landmark || user.landmark || '',
    }));
  }, [user]);

  const validateEgyptianPhone = (phone) => {
    const clean = phone.replace(/[^\d]/g, '');
    return /^01[0125][0-9]{8}$/.test(clean);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    const newErrors: Record<string, string> = {};

    if (!formData.fullName.trim()) newErrors.fullName = 'الاسم بالكامل مطلوب';
    if (!validateEgyptianPhone(formData.phone)) newErrors.phone = 'رقم الهاتف المصري غير صحيح (مثال: 01012345678)';
    if (formData.whatsappPhone && !validateEgyptianPhone(formData.whatsappPhone)) newErrors.whatsappPhone = 'رقم واتساب المصري غير صحيح (مثال: 01012345678)';
    if (!formData.governorate) newErrors.governorate = 'اختر المحافظة';
    if (!formData.city.trim()) newErrors.city = 'المنطقة أو المدينة مطلوبة';
    if (!formData.address.trim()) newErrors.address = 'العنوان بالتفصيل مطلوب';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSaving(true);
    try {
      const { order } = await storeApi.createOrder({
        items: cart.map((item) => ({
          productId: item.productId || item.id,
          ...(item.variantId ? { variantId: item.variantId } : {}),
          quantity: item.quantity,
        })),
        fullName: formData.fullName,
        phone: formData.phone,
        whatsappPhone: formData.whatsappPhone,
        governorate: formData.governorate,
        city: formData.city,
        address: formData.address,
        landmark: formData.landmark,
        notes: formData.notes,
      });
      let msg = `طلب جديد من سوبر ماركت أبو عمار\nرقم الطلب: ${order.orderNumber}\n\n`;
      msg += `الاسم: ${formData.fullName}\nالهاتف: ${formData.phone}\n`;
      if (formData.whatsappPhone) msg += `واتساب: ${formData.whatsappPhone}\n`;
      msg += `العنوان: ${formData.governorate} - ${formData.city} - ${formData.address}\n`;
      if (formData.landmark) msg += `علامة مميزة: ${formData.landmark}\n`;
      msg += `\nالمنتجات المطلوبة:\n`;
      cart.forEach((item, index) => {
        msg += `${index + 1}. ${item.nameAr}${item.variantName ? ` — ${item.variantName}` : ''} (${item.packageSize}) × ${item.quantity} = ${(item.price * item.quantity).toFixed(2)} ج.م\n`;
      });
      msg += `\nإجمالي المنتجات: ${order.subtotal.toFixed(2)} ج.م\n`;
      msg += `رسوم التوصيل يحددها المتجر عند التأكيد.\nالإجمالي النهائي يحدد بعد مراجعة الطلب.\n`;
      if (formData.notes) msg += `\nملاحظات: ${formData.notes}\n`;
      onOrderSuccess({ orderId: order.orderNumber, formData, whatsappMessage: msg });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'تعذر تسجيل الطلب. حاول مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  if (!authLoaded) {
    return <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-600">جارٍ التحقق من تسجيل الدخول…</div>;
  }
  if (!isSignedIn || !user) {
    return <section className="mx-auto max-w-xl rounded-3xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
      <User className="mx-auto h-10 w-10 text-emerald-700" />
      <h2 className="mt-4 text-xl font-black text-slate-900">سجّل الدخول لتثبيت طلبك</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">تسجيل الدخول يحفظ الطلب في حسابك ويتيح لك متابعته. منتجات العرض التجريبي لن تُقبل كطلب قبل اعتماد أسعارها من المتجر.</p>
      <div className="mt-5 flex justify-center gap-3"><a href="/sign-in" className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white">تسجيل الدخول</a><a href="/sign-up" className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700">إنشاء حساب</a></div>
    </section>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn">
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between pb-6 border-b border-slate-200">
          <div>
            <h2 className="text-xl font-black text-slate-900">إتمام الطلب وتأكيد البيانات</h2>
            <p className="text-xs text-slate-500">سيُحفظ الطلب في حسابك. رسوم التوصيل النهائية يؤكدها المتجر عند مراجعة الطلب.</p>
          </div>
          <button 
            onClick={onBackToCart}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-3.5 py-2 rounded-xl transition-colors"
          >
            العودة للسلة
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
          {submitError && <div className="md:col-span-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{submitError}</div>}
          
          {/* Left / Top Form Inputs */}
          <div className="space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">بيانات العميل والتوصيل</h3>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">الاسم بالكامل *</label>
              <input 
                type="text"
                value={formData.fullName}
                onChange={e => setFormData({...formData, fullName: e.target.value})}
                placeholder="أدخل اسمك الثلاثي"
                className={`w-full bg-slate-50 border rounded-xl py-2.5 px-4 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600/50 ${errors.fullName ? 'border-red-500' : 'border-slate-200'}`}
              />
              {errors.fullName && <span className="text-[10px] text-red-500 mt-1 block">{errors.fullName}</span>}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف (محمول مصري) *</label>
              <input 
                type="tel"
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
                placeholder="01012345678"
                className={`w-full bg-slate-50 border rounded-xl py-2.5 px-4 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600/50 ${errors.phone ? 'border-red-500' : 'border-slate-200'}`}
              />
              {errors.phone && <span className="text-[10px] text-red-500 mt-1 block">{errors.phone}</span>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">المحافظة *</label>
                <select 
                  value={formData.governorate}
                  onChange={e => setFormData({...formData, governorate: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600/50"
                >
                  <option value="">اختر المحافظة</option>
                  <option value="القاهرة">القاهرة</option>
                  <option value="الجيزة">الجيزة</option>
                  <option value="الإسكندرية">الإسكندرية</option>
                  <option value="القليوبية">القليوبية</option>
                </select>
                {errors.governorate && <span className="text-[10px] text-red-500 mt-1 block">{errors.governorate}</span>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">المنطقة أو المدينة *</label>
                <input 
                  type="text"
                  value={formData.city}
                  onChange={e => setFormData({...formData, city: e.target.value})}
                  placeholder="مثال: مدينة نصر، المعادي..."
                  className={`w-full bg-slate-50 border rounded-xl py-2.5 px-4 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600/50 ${errors.city ? 'border-red-500' : 'border-slate-200'}`}
                />
                {errors.city && <span className="text-[10px] text-red-500 mt-1 block">{errors.city}</span>}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">رقم واتساب (لو مختلف عن الهاتف — اختياري)</label>
              <input
                type="tel"
                value={formData.whatsappPhone}
                onChange={e => setFormData({...formData, whatsappPhone: e.target.value})}
                placeholder="01012345678"
                className={`w-full bg-slate-50 border rounded-xl py-2.5 px-4 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600/50 ${errors.whatsappPhone ? 'border-red-500' : 'border-slate-200'}`}
              />
              {errors.whatsappPhone && <span className="text-[10px] text-red-500 mt-1 block">{errors.whatsappPhone}</span>}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">العنوان بالتفصيل (اسم الشارع، رقم العلبة، الشقة) *</label>
              <textarea 
                rows="2"
                value={formData.address}
                onChange={e => setFormData({...formData, address: e.target.value})}
                placeholder="شارع كذا، بناء كذا، الدور..."
                className={`w-full bg-slate-50 border rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600/50 ${errors.address ? 'border-red-500' : 'border-slate-200'}`}
              />
              {errors.address && <span className="text-[10px] text-red-500 mt-1 block">{errors.address}</span>}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">علامة مميزة (اختياري)</label>
              <input 
                type="text"
                value={formData.landmark}
                onChange={e => setFormData({...formData, landmark: e.target.value})}
                placeholder="بجوار مسجد كذا / صيدلية كذا..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600/50"
              />
            </div>
          </div>

          {/* Right / Order Summary & Payment */}
          <div className="space-y-4">
            <div className="bg-emerald-900/5 p-6 rounded-3xl border border-emerald-900/10 space-y-4">
              <h3 className="font-bold text-slate-900 text-sm border-b border-slate-200 pb-3">ملخص الطلب النهائي</h3>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {cart.map(item => (
                  <div key={item.id} className="flex justify-between items-center text-xs text-slate-600">
                    <span className="truncate max-w-[180px]">{item.nameAr} × {item.quantity}</span>
                    <span className="font-bold text-slate-900">{(item.price * item.quantity).toFixed(2)} ج.م</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-200 pt-3 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>المجموع الفرعي:</span>
                  <span className="font-bold text-slate-900">{cartSubtotal.toFixed(2)} ج.م</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>رسوم التوصيل:</span>
                  <span className="font-bold text-emerald-700">يحددها المتجر</span>
                </div>
                <div className="border-t border-slate-200 pt-2 flex justify-between text-sm font-black text-slate-900">
                  <span>إجمالي المنتجات:</span>
                  <span className="text-emerald-700">{cartSubtotal.toFixed(2)} ج.م</span>
                </div>
              </div>

              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">طريقة الدفع</label>
                <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs font-semibold text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>الدفع عند الاستلام (اختيار تجريبي — غير مؤكد من المتجر)</span>
                </div>
              </div>

              <button 
                type="submit"
                disabled={saving}
                className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60 text-white font-bold py-3.5 rounded-2xl text-sm shadow-lg shadow-emerald-700/20 transition-all flex items-center justify-center gap-2"
              >
                <span>{saving ? 'جارٍ حفظ الطلب…' : 'تأكيد الطلب'}</span>
                <ArrowRight className="w-4 h-4 rotate-180" />
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
}

function normalizeEgyptianWhatsApp(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('20')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return /^1[0125]\d{8}$/.test(digits) ? `20${digits}` : '';
}

function ManualCustomerUpdate() {
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderReference, setOrderReference] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    const destination = normalizeEgyptianWhatsApp(customerPhone);
    if (!destination) {
      setError('أدخل رقم واتساب مصري صحيحًا مثل 01012345678');
      return;
    }
    if (!orderReference.trim()) {
      setError('أدخل رقم الطلب الذي وصلك من العميل');
      return;
    }

    setError('');
    const message = `تحديث من سوبر ماركت أبو عمار بشأن طلبك رقم ${orderReference.trim()}:\nطلبك قادم إليك في أقرب وقت.`;
    window.open(makeWhatsAppUrl(destination, message), '_blank', 'noopener,noreferrer');
  };

  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 sm:p-6 space-y-4" aria-labelledby="manual-update-title">
      <div>
        <h3 id="manual-update-title" className="font-bold text-slate-900 text-base">تجهيز تحديث واتساب للعميل</h3>
        <p className="mt-1 text-xs leading-6 text-slate-600">
          بعد استلام رسالة الطلب ومراجعة حالته، أدخل رقم العميل ورقم الطلب لفتح مسودة تقول إن الطلب قادم إليه.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="text-xs font-bold text-slate-700">
          رقم واتساب العميل
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={customerPhone}
            onChange={event => setCustomerPhone(event.target.value)}
            placeholder="01012345678"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal"
          />
        </label>
        <label className="text-xs font-bold text-slate-700">
          رقم الطلب
          <input
            type="text"
            value={orderReference}
            onChange={event => setOrderReference(event.target.value)}
            placeholder="ABU-123456"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal"
          />
        </label>
        <div className="sm:col-span-2 flex flex-col items-start gap-2">
          <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-800">
            <Phone className="w-4 h-4" />
            افتح رسالة «طلبك قادم إليك»
          </button>
          {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
          <p className="text-[11px] leading-5 text-amber-800">
            واتساب يفتح مسودة فقط؛ راجعها واضغط إرسال بنفسك. لا يوجد سجل طلبات مشترك، ولا يُرسل تنبيه تلقائي.
          </p>
        </div>
      </form>
    </section>
  );
}

// EOF Marker