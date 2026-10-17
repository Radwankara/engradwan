CREATE TABLE IF NOT EXISTS store_users (
  clerk_user_id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  whatsapp_phone TEXT NOT NULL DEFAULT '',
  governorate TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  landmark TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS store_categories (
  id TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'Store',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS store_products (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  brand TEXT NOT NULL DEFAULT '',
  category_id TEXT NOT NULL REFERENCES store_categories(id) ON DELETE RESTRICT,
  subcategory_ar TEXT NOT NULL DEFAULT '',
  short_description TEXT NOT NULL DEFAULT '',
  full_description TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  unit TEXT NOT NULL DEFAULT 'قطعة',
  package_size TEXT NOT NULL DEFAULT '',
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  original_price NUMERIC(10, 2) CHECK (original_price IS NULL OR original_price >= 0),
  discount_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  offer_description TEXT NOT NULL DEFAULT '',
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  variants JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(variants) = 'array'),
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  is_best_seller BOOLEAN NOT NULL DEFAULT FALSE,
  is_variable_weight BOOLEAN NOT NULL DEFAULT FALSE,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_media (
  id UUID PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL UNIQUE,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  mime_type TEXT NOT NULL,
  original_name TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  uploaded_by TEXT NOT NULL REFERENCES store_users(clerk_user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_invites (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  invited_by TEXT NOT NULL REFERENCES store_users(clerk_user_id),
  accepted_by TEXT REFERENCES store_users(clerk_user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS store_orders (
  id UUID PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES store_users(clerk_user_id),
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  whatsapp_phone TEXT NOT NULL DEFAULT '',
  governorate TEXT NOT NULL,
  city TEXT NOT NULL,
  address TEXT NOT NULL,
  landmark TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled')),
  fulfillment_method TEXT NOT NULL DEFAULT 'delivery',
  payment_method TEXT NOT NULL DEFAULT 'cash_on_delivery',
  subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
  delivery_fee NUMERIC(10, 2) CHECK (delivery_fee IS NULL OR delivery_fee >= 0),
  total NUMERIC(10, 2) NOT NULL CHECK (total >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS store_order_items (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES store_orders(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES store_products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  variant_id TEXT NOT NULL DEFAULT '',
  variant_name TEXT NOT NULL DEFAULT '',
  package_size TEXT NOT NULL DEFAULT '',
  unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  line_total NUMERIC(10, 2) NOT NULL CHECK (line_total >= 0)
);

CREATE TABLE IF NOT EXISTS store_seed_meta (
  key TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS store_products_category_idx ON store_products(category_id);
CREATE INDEX IF NOT EXISTS store_products_active_idx ON store_products(is_active, is_available);
CREATE INDEX IF NOT EXISTS store_orders_user_created_idx ON store_orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS store_orders_status_created_idx ON store_orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS product_media_product_idx ON product_media(product_id, sort_order);

ALTER TABLE store_products
  ADD COLUMN IF NOT EXISTS variants JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE store_order_items
  ADD COLUMN IF NOT EXISTS variant_id TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS variant_name TEXT NOT NULL DEFAULT '';
