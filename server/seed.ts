import { randomUUID } from "node:crypto";
import { DEMO_CATEGORY_PRODUCTS, SAMPLE_SUBCATEGORY_BY_PRODUCT_ID } from "../src/data/demo-products";
import { withTransaction } from "./db";

const categories = [
  ["vegetables", "الخضروات", "Sparkles"],
  ["fruits", "الفاكهة", "Sparkles"],
  ["dairy", "الألبان والجبن", "Tag"],
  ["meat-poultry", "اللحوم والدواجن", "Flame"],
  ["fish", "الأسماك", "Store"],
  ["grocery", "البقالة", "ShoppingCart"],
  ["rice-pasta", "الأرز والمكرونة", "Tag"],
  ["oils", "الزيوت والسمن", "Tag"],
  ["canned-food", "المعلبات", "Store"],
  ["beverages", "المشروبات", "Sparkles"],
  ["bakery", "المخبوزات", "Store"],
  ["frozen", "المجمدات", "Store"],
  ["snacks", "الحلويات والسناكس", "Sparkles"],
  ["cleaning", "المنظفات", "ShieldCheck"],
  ["personal-care", "العناية الشخصية", "User"],
  ["household", "مستلزمات المنزل", "Store"],
] as const;

const originalDemoProducts = [
  { id: "prod-1", slug: "fresh-tomatoes", nameAr: "طماطم طازجة ممتازة", brand: "بيانات تجريبية", categoryId: "vegetables", unit: "كجم", packageSize: "1 كجم", price: 18.5, originalPrice: 22, stockQuantity: 150, image: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=600&q=80", discountPercentage: 16, offerDescription: "عرض تجريبي", isFeatured: true, isBestSeller: true, isVariableWeight: true },
  { id: "prod-2", slug: "fresh-bananas", nameAr: "موز طازج", brand: "بيانات تجريبية", categoryId: "fruits", unit: "كجم", packageSize: "1 كجم", price: 32, originalPrice: 38, stockQuantity: 95, image: "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=600&q=80", discountPercentage: 15, offerDescription: "عرض تجريبي", isFeatured: true, isBestSeller: true, isVariableWeight: true },
  { id: "prod-3", slug: "juhayna-milk-full-cream", nameAr: "حليب كامل الدسم 1 لتر", brand: "بيانات تجريبية", categoryId: "dairy", unit: "لتر", packageSize: "1 لتر", price: 42, originalPrice: 45, stockQuantity: 200, image: "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80", discountPercentage: 6, offerDescription: "عرض تجريبي", isFeatured: true, isBestSeller: true, isVariableWeight: false },
  { id: "prod-4", slug: "egyptian-rice-el-malika", nameAr: "أرز مصري فاخر 5 كجم", brand: "بيانات تجريبية", categoryId: "rice-pasta", unit: "كيس", packageSize: "5 كجم", price: 145, originalPrice: 160, stockQuantity: 80, image: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80", discountPercentage: 9, offerDescription: "عرض تجريبي", isFeatured: false, isBestSeller: true, isVariableWeight: false },
  { id: "prod-5", slug: "sunflower-oil", nameAr: "زيت عباد الشمس 2.2 لتر", brand: "بيانات تجريبية", categoryId: "oils", unit: "زجاجة", packageSize: "2.2 لتر", price: 185, originalPrice: 200, stockQuantity: 60, image: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80", discountPercentage: 7, offerDescription: "عرض تجريبي", isFeatured: true, isBestSeller: true, isVariableWeight: false },
  { id: "prod-6", slug: "whole-chicken", nameAr: "دجاج كامل مبرد", brand: "بيانات تجريبية", categoryId: "meat-poultry", unit: "قطعة", packageSize: "1–1.1 كجم", price: 110, originalPrice: 125, stockQuantity: 40, image: "https://images.unsplash.com/photo-1587593810167-a84920ea0781?auto=format&fit=crop&w=600&q=80", discountPercentage: 12, offerDescription: "عرض تجريبي", isFeatured: true, isBestSeller: true, isVariableWeight: true },
  { id: "prod-7", slug: "laundry-detergent", nameAr: "منظف ملابس 3 لتر", brand: "بيانات تجريبية", categoryId: "cleaning", unit: "عبوة", packageSize: "3 لتر", price: 195, originalPrice: 220, stockQuantity: 50, image: "https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?auto=format&fit=crop&w=600&q=80", discountPercentage: 11, offerDescription: "عرض تجريبي", isFeatured: false, isBestSeller: true, isVariableWeight: false },
  { id: "prod-8", slug: "white-cheese", nameAr: "جبنة بيضاء 1 كجم", brand: "بيانات تجريبية", categoryId: "dairy", unit: "عبوة", packageSize: "1 كجم", price: 65, originalPrice: 72, stockQuantity: 110, image: "https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?auto=format&fit=crop&w=600&q=80", discountPercentage: 9, offerDescription: "", isFeatured: false, isBestSeller: false, isVariableWeight: false },
  { id: "prod-9", slug: "cola-can-330ml", nameAr: "مشروب غازي 330 مل", brand: "بيانات تجريبية", categoryId: "beverages", unit: "كان", packageSize: "330 مل", price: 12, originalPrice: 14, stockQuantity: 300, image: "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?auto=format&fit=crop&w=600&q=80", discountPercentage: 14, offerDescription: "عرض تجريبي", isFeatured: false, isBestSeller: true, isVariableWeight: false },
  { id: "prod-10", slug: "red-apples", nameAr: "تفاح أحمر", brand: "بيانات تجريبية", categoryId: "fruits", unit: "كجم", packageSize: "1 كجم", price: 55, originalPrice: 65, stockQuantity: 75, image: "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=600&q=80", discountPercentage: 15, offerDescription: "عرض تجريبي", isFeatured: true, isBestSeller: false, isVariableWeight: true },
];

export async function seedCatalog() {
  await withTransaction(async (client) => {
    const marker = await client.query(
      "SELECT key FROM store_seed_meta WHERE key = $1",
      ["catalog-demo-v1"],
    );
    if (marker.rowCount) return;

    for (const [index, [id, nameAr, icon]] of categories.entries()) {
      await client.query(
        `INSERT INTO store_categories (id, name_ar, icon, sort_order)
         VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
        [id, nameAr, icon, index],
      );
    }

    const products = [
      ...originalDemoProducts.map((product) => ({
        ...product,
        subcategoryAr: SAMPLE_SUBCATEGORY_BY_PRODUCT_ID[product.id] || "",
        shortDescription: "بيانات منتج توضيحية. راجع المتجر لتأكيد السعر والتوفر.",
        fullDescription: "هذا الصنف جزء من كتالوج العرض التجريبي، وليس تأكيدًا لمخزون المتجر أو أسعاره.",
        isAvailable: true,
      })),
      ...DEMO_CATEGORY_PRODUCTS,
    ];

    for (const product of products) {
      await client.query(
        `INSERT INTO store_products (
          id, slug, name_ar, brand, category_id, subcategory_ar,
          short_description, full_description, image_url, unit, package_size,
          price, original_price, discount_percentage, offer_description,
          stock_quantity, is_available, is_featured, is_best_seller,
          is_variable_weight, is_demo, is_active
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,TRUE,TRUE
        ) ON CONFLICT (id) DO NOTHING`,
        [
          product.id,
          product.slug,
          product.nameAr,
          product.brand || "بيانات تجريبية",
          product.categoryId,
          product.subcategoryAr || "",
          product.shortDescription || "",
          product.fullDescription || "",
          product.image || "",
          product.unit || "قطعة",
          product.packageSize || "",
          product.price,
          product.originalPrice ?? product.price,
          product.discountPercentage || 0,
          product.offerDescription || "",
          product.stockQuantity || 0,
          product.isAvailable !== false,
          product.isFeatured || false,
          product.isBestSeller || false,
          product.isVariableWeight || false,
        ],
      );
    }

    await client.query(
      "INSERT INTO store_seed_meta (key) VALUES ($1) ON CONFLICT (key) DO NOTHING",
      ["catalog-demo-v1"],
    );
  });
}

if (process.argv[1]?.endsWith("seed.ts")) {
  await seedCatalog();
  console.log(`Inserted ${originalDemoProducts.length + DEMO_CATEGORY_PRODUCTS.length} demo products.`);
  process.exit(0);
}

