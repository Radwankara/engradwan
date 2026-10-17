import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Boxes,
  CheckCircle2,
  CircleAlert,
  Info,
  PackageCheck,
  Search,
  Send,
  Store,
  Tag,
} from "lucide-react";
import "./ProductAvailabilityAssistant.css";

export interface ProductAvailabilityAssistantProduct {
  id: string;
  nameAr: string;
  brand: string;
  categoryId: string;
  price: number;
  packageSize: string;
  stockQuantity: number;
  isAvailable: boolean;
}

export interface ProductAvailabilityAssistantProps {
  /** Local catalog records to search. When omitted, the component uses its bundled demo catalog. */
  products?: ProductAvailabilityAssistantProduct[];
}

interface SearchTurn {
  id: number;
  query: string;
  matches: ProductAvailabilityAssistantProduct[];
}

const CATEGORY_LABELS: Record<string, string> = {
  vegetables: "الخضروات",
  fruits: "الفاكهة",
  dairy: "الألبان والجبن",
  "meat-poultry": "اللحوم والدواجن",
  fish: "الأسماك",
  grocery: "البقالة",
  "rice-pasta": "الأرز والمكرونة",
  oils: "الزيوت والسمن",
  "canned-food": "المعلبات",
  beverages: "المشروبات",
  bakery: "المخبوزات",
  frozen: "المجمدات",
  snacks: "الحلويات والسناكس",
  cleaning: "المنظفات",
  "personal-care": "العناية الشخصية",
  household: "مستلزمات المنزل",
};

const CATEGORY_SEARCH_TERMS: Record<string, string> = {
  vegetables: "خضار خضروات",
  fruits: "فاكهة فواكه",
  dairy: "لبن حليب جبن جبنة اجبان",
  "meat-poultry": "لحمة لحوم فراخ دجاج دواجن",
  fish: "سمك سمك",
  grocery: "بقالة",
  "rice-pasta": "رز أرز مكرونة",
  oils: "زيت زيوت سمن",
  "canned-food": "معلبات",
  beverages: "مشروبات عصير مياه",
  bakery: "مخبوزات عيش خبز",
  frozen: "مجمدات",
  snacks: "حلويات سناكس",
  cleaning: "منظفات",
  "personal-care": "عناية شخصية",
  household: "منزل أدوات منزلية",
};

const DEMO_PRODUCTS: ProductAvailabilityAssistantProduct[] = [
  {
    id: "prod-1",
    nameAr: "طماطم طازجة ممتازة",
    brand: "أبو عمار فريش",
    categoryId: "vegetables",
    price: 18.5,
    packageSize: "1 كجم",
    stockQuantity: 150,
    isAvailable: true,
  },
  {
    id: "prod-2",
    nameAr: "موز طازج استثماري",
    brand: "مزارع الوادي",
    categoryId: "fruits",
    price: 32,
    packageSize: "1 كجم",
    stockQuantity: 95,
    isAvailable: true,
  },
  {
    id: "prod-3",
    nameAr: "حليب جهينة كامل الدسم 1 لتر",
    brand: "جهينة",
    categoryId: "dairy",
    price: 42,
    packageSize: "1 لتر",
    stockQuantity: 200,
    isAvailable: true,
  },
  {
    id: "prod-4",
    nameAr: "أرز الملكة المصري الفاخر 5 كجم",
    brand: "الملكة",
    categoryId: "rice-pasta",
    price: 145,
    packageSize: "5 كجم",
    stockQuantity: 80,
    isAvailable: true,
  },
  {
    id: "prod-5",
    nameAr: "زيت عباد الشمس كريستال 2.2 لتر",
    brand: "كريستال",
    categoryId: "oils",
    price: 185,
    packageSize: "2.2 لتر",
    stockQuantity: 60,
    isAvailable: true,
  },
  {
    id: "prod-6",
    nameAr: "دجاج كامل طازج مبرد",
    brand: "أبو عمار فريش",
    categoryId: "meat-poultry",
    price: 110,
    packageSize: "1000–1100 جم",
    stockQuantity: 40,
    isAvailable: true,
  },
  {
    id: "prod-7",
    nameAr: "جل برسيل للغسالات الأوتوماتيك 3 لتر",
    brand: "برسيل",
    categoryId: "cleaning",
    price: 195,
    packageSize: "3 لتر",
    stockQuantity: 50,
    isAvailable: true,
  },
  {
    id: "prod-8",
    nameAr: "جبنة دومتي بيضاء فيتا 1 كجم",
    brand: "دومتي",
    categoryId: "dairy",
    price: 65,
    packageSize: "1 كجم",
    stockQuantity: 110,
    isAvailable: true,
  },
  {
    id: "prod-9",
    nameAr: "مشروب غازي بيبسي كان 330 مل",
    brand: "بيبسي",
    categoryId: "beverages",
    price: 12,
    packageSize: "330 مل",
    stockQuantity: 300,
    isAvailable: true,
  },
  {
    id: "prod-10",
    nameAr: "تفاح أحمر مستورد فاخر",
    brand: "أبو عمار فريش",
    categoryId: "fruits",
    price: 55,
    packageSize: "1 كجم",
    stockQuantity: 75,
    isAvailable: true,
  },
];

const QUICK_PROMPTS = ["لبن جهينة", "طماطم", "جبنة دومتي", "أرز"];

function normalizeArabic(value: string): string {
  return value
    .toLocaleLowerCase("ar")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findProducts(
  query: string,
  products: ProductAvailabilityAssistantProduct[],
): ProductAvailabilityAssistantProduct[] {
  const normalizedQuery = normalizeArabic(query);
  if (!normalizedQuery) return [];
  const stopWords = new Set([
    "هل", "في", "فيه", "موجود", "موجوده", "متوفر", "متوفره", "عندكم", "عندك",
    "لو", "سمحت", "من", "فضلك", "عايز", "عاوزه", "محتاج", "محتاجه",
    "ممكن", "المنتج", "المنتجات", "منتج", "صنف", "عند", "ولا", "بكام",
    "مش", "لا", "عارف", "اعرف", "انت", "انتم",
  ]);
  const queryTerms = normalizedQuery
    .split(" ")
    .map((term) => term.startsWith("ال") ? term.slice(2) : term)
    .filter((term) => term && !stopWords.has(term));
  if (queryTerms.length === 0) return [];
  const synonyms: Record<string, string[]> = {
    لبن: ["حليب"],
    حليب: ["لبن"],
    جبنة: ["جبن"],
    جبن: ["جبنة"],
    رز: ["ارز"],
    فراخ: ["دجاج"],
    دجاج: ["فراخ"],
  };

  return products.filter((product) => {
    const category = normalizeArabic(CATEGORY_LABELS[product.categoryId] ?? "");
    const categoryTerms = normalizeArabic(CATEGORY_SEARCH_TERMS[product.categoryId] ?? "");
    const searchable = normalizeArabic(
      `${product.nameAr} ${product.brand} ${product.categoryId} ${category} ${categoryTerms} ${product.packageSize}`,
    );
    return queryTerms.every(
      (term) =>
        searchable.includes(term) ||
        (synonyms[term] || []).some((synonym) => searchable.includes(synonym)),
    );
  });
}

function formatPrice(price: number): string {
  const amount = new Intl.NumberFormat("ar-EG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
  return `${amount} جنيه`;
}

function ProductCard({ product }: { product: ProductAvailabilityAssistantProduct }) {
  const available = product.isAvailable && product.stockQuantity > 0;
  const category = CATEGORY_LABELS[product.categoryId] ?? "منتجات أخرى";

  return (
    <article className="paa__product" aria-label={`نتيجة المنتج: ${product.nameAr}`}>
      <div className="paa__product-top">
        <div>
          <h4 className="paa__product-name">{product.nameAr}</h4>
          <p className="paa__product-brand">{product.brand}</p>
        </div>
        <span className={`paa__availability${available ? "" : " paa__availability--out"}`}>
          {available ? <CheckCircle2 aria-hidden="true" /> : <CircleAlert aria-hidden="true" />}
          {available ? "متاح في بيانات العينة" : "غير متاح في بيانات العينة"}
        </span>
      </div>
      <div className="paa__product-meta">
        <span><Tag aria-hidden="true" />{category}</span>
        <span className="paa__product-price"><PackageCheck aria-hidden="true" />{formatPrice(product.price)} · {product.packageSize}</span>
        <span><Boxes aria-hidden="true" />الكمية بالعينة: {product.stockQuantity}</span>
      </div>
    </article>
  );
}

export default function ProductAvailabilityAssistant({
  products = DEMO_PRODUCTS,
}: ProductAvailabilityAssistantProps) {
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<SearchTurn[]>([]);
  const conversationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (turns.length === 0 || !conversationRef.current) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    conversationRef.current.scrollTo({
      top: conversationRef.current.scrollHeight,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }, [turns]);

  function submitQuery(rawQuery: string) {
    const query = rawQuery.trim();
    if (!query) return;

    setTurns((current) => [
      ...current,
      { id: current.length + 1, query, matches: findProducts(query, products) },
    ]);
    setInput("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitQuery(input);
  }

  return (
    <section className="paa" aria-labelledby="paa-title">
      <div className="paa__shell">
        <header className="paa__header">
          <div className="paa__heading">
            <p className="paa__eyebrow">
              <span className="paa__eyebrow-mark"><Store aria-hidden="true" /></span>
              سوبر ماركت أبو عمار
            </p>
            <h2 className="paa__title" id="paa-title">ناقصك حاجة من البيت؟</h2>
            <p className="paa__subtitle">
              اكتب اسم المنتج أو القسم، وهنبحث لك في كتالوجنا التجريبي المحلي.
            </p>
          </div>
          <div className="paa__demo-stamp" aria-label="مساعد كتالوج تجريبي">
            <span className="paa__demo-dot" aria-hidden="true" />
            مساعد كتالوج تجريبي
          </div>
        </header>

        <div className="paa__body">
          <div
            className="paa__conversation"
            ref={conversationRef}
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            aria-label="محادثة البحث عن توفر المنتجات"
          >
            <div className="paa__intro">
              <span className="paa__avatar"><Store aria-hidden="true" /></span>
              <div className="paa__intro-copy">
                <strong>أهلاً بيك في أبو عمار</strong>
                <p>اسأل عن منتج، وهقولك اللي ظاهر في عينة الكتالوج.</p>
              </div>
            </div>

            {turns.map((turn) => (
              <div className="paa__turn" key={turn.id}>
                <div className="paa__question">{turn.query}</div>
                <div className="paa__answer">
                  <span className="paa__avatar"><Store aria-hidden="true" /></span>
                  <div className="paa__answer-content">
                    <span className="paa__answer-label">نتيجة بحث محلي · بيانات تجريبية</span>
                    {turn.matches.length > 0 ? (
                      <>
                        <p className="paa__answer-note">
                          لاقينا {turn.matches.length === 1 ? "المنتج ده" : "المنتجات دي"} في كتالوج العينة:
                        </p>
                        <div className="paa__results">
                          {turn.matches.map((product) => (
                            <ProductCard key={product.id} product={product} />
                          ))}
                        </div>
                        <p className="paa__answer-note" style={{ marginTop: 8 }}>
                          الأسعار والتوفر هنا من بيانات عينة فقط، ومش تأكيد للمخزون الحالي في الفرع.
                        </p>
                      </>
                    ) : (
                      <div className="paa__unknown">
                        <strong>ما نقدرش نأكد توفره من كتالوج العينة.</strong>
                        مش لاقيين الاسم في البيانات التجريبية. جرّب كتابة الاسم بطريقة تانية أو اكتب اسم القسم.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="paa__composer">
            <form className="paa__form" onSubmit={handleSubmit} role="search">
              <Search className="paa__input-icon" aria-hidden="true" />
              <label className="paa__sr-only" htmlFor="paa-product-query">
                اكتب اسم المنتج أو القسم
              </label>
              <input
                className="paa__input"
                id="paa-product-query"
                type="search"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="مثال: لبن جهينة أو خضروات"
                autoComplete="off"
                aria-label="اكتب اسم المنتج أو القسم"
              />
              <button className="paa__send" type="submit" aria-label="ابحث في كتالوج العينة">
                <Send aria-hidden="true" />
                <span>ابحث</span>
              </button>
            </form>
            <div className="paa__suggestions" aria-label="اقتراحات للبحث">
              <span className="paa__suggestions-label">جرّب تسأل عن:</span>
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  className="paa__chip"
                  key={prompt}
                  type="button"
                  onClick={() => submitQuery(prompt)}
                  aria-label={`ابحث عن ${prompt}`}
                >
                  {prompt}
                </button>
              ))}
            </div>
            <p className="paa__footnote">
              <Info aria-hidden="true" />
              الردود مبنية على بيانات عينة محلية فقط؛ لا يوجد ربط بمخزون حي أو تأكيد لحالة المنتجات في الفرع.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
