# Graph Report - .  (2026-05-24)

## Corpus Check
- Large corpus: 173 files · ~684,415 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 753 nodes · 1293 edges · 75 communities (52 shown, 23 thin omitted)
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 153 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Order & Checkout Flow|Order & Checkout Flow]]
- [[_COMMUNITY_Admin Product Management|Admin Product Management]]
- [[_COMMUNITY_Product Catalog & Display|Product Catalog & Display]]
- [[_COMMUNITY_App Layout & Analytics|App Layout & Analytics]]
- [[_COMMUNITY_Build Dependencies|Build Dependencies]]
- [[_COMMUNITY_Supabase Schema & Migration|Supabase Schema & Migration]]
- [[_COMMUNITY_Auth & Account Pages|Auth & Account Pages]]
- [[_COMMUNITY_User Account Management|User Account Management]]
- [[_COMMUNITY_Admin Server Actions|Admin Server Actions]]
- [[_COMMUNITY_Legacy Product Images|Legacy Product Images]]
- [[_COMMUNITY_TypeScript Config|TypeScript Config]]
- [[_COMMUNITY_Authentication Actions|Authentication Actions]]
- [[_COMMUNITY_Admin Dashboard|Admin Dashboard]]
- [[_COMMUNITY_Partner Brand Assets|Partner Brand Assets]]
- [[_COMMUNITY_Saleor Sync Script|Saleor Sync Script]]
- [[_COMMUNITY_Product Category Concepts|Product Category Concepts]]
- [[_COMMUNITY_Live Product Images|Live Product Images]]
- [[_COMMUNITY_Profile & Measurements|Profile & Measurements]]
- [[_COMMUNITY_Legacy Docker Backend|Legacy Docker Backend]]
- [[_COMMUNITY_Cart & Pricing|Cart & Pricing]]
- [[_COMMUNITY_Brand Identity Assets|Brand Identity Assets]]
- [[_COMMUNITY_Scratch DB Tests|Scratch DB Tests]]
- [[_COMMUNITY_Scratch Action Tests|Scratch Action Tests]]
- [[_COMMUNITY_Scratch Newsletter Tests|Scratch Newsletter Tests]]
- [[_COMMUNITY_Scratch SMTP Tests|Scratch SMTP Tests]]
- [[_COMMUNITY_Scratch Supabase Tests|Scratch Supabase Tests]]
- [[_COMMUNITY_Rate List Seeder|Rate List Seeder]]
- [[_COMMUNITY_Account Overview Pages|Account Overview Pages]]
- [[_COMMUNITY_OTP & Receipt Flow|OTP & Receipt Flow]]
- [[_COMMUNITY_Architecture Guidelines|Architecture Guidelines]]
- [[_COMMUNITY_Saleor Cleanup Script|Saleor Cleanup Script]]
- [[_COMMUNITY_Order Placement Functions|Order Placement Functions]]
- [[_COMMUNITY_Saleor Product Listing|Saleor Product Listing]]
- [[_COMMUNITY_Product Colors Test|Product Colors Test]]
- [[_COMMUNITY_Supabase Connection Test|Supabase Connection Test]]
- [[_COMMUNITY_DB Spelling Fix Script|DB Spelling Fix Script]]
- [[_COMMUNITY_Product Query Scripts|Product Query Scripts]]
- [[_COMMUNITY_Supabase Read Scripts|Supabase Read Scripts]]
- [[_COMMUNITY_Receipt Upload Flow|Receipt Upload Flow]]
- [[_COMMUNITY_Storefront Brand Visuals|Storefront Brand Visuals]]
- [[_COMMUNITY_Pricing & Rate Limiting|Pricing & Rate Limiting]]
- [[_COMMUNITY_Next.js Middleware|Next.js Middleware]]
- [[_COMMUNITY_Legacy Apparel Catalog|Legacy Apparel Catalog]]
- [[_COMMUNITY_Next.js Project Config|Next.js Project Config]]
- [[_COMMUNITY_Fashion Brand Logos|Fashion Brand Logos]]
- [[_COMMUNITY_Product Data Generator|Product Data Generator]]
- [[_COMMUNITY_Password Reset Flow|Password Reset Flow]]
- [[_COMMUNITY_Claude Settings|Claude Settings]]
- [[_COMMUNITY_Women's Apparel Products|Women's Apparel Products]]
- [[_COMMUNITY_Accessories Products|Accessories Products]]
- [[_COMMUNITY_Men's Apparel Products|Men's Apparel Products]]
- [[_COMMUNITY_SMTP Email Setup|SMTP Email Setup]]
- [[_COMMUNITY_Next.js Config Module|Next.js Config Module]]
- [[_COMMUNITY_Products Module|Products Module]]
- [[_COMMUNITY_Addresses Migration|Addresses Migration]]
- [[_COMMUNITY_Wishlist Migration|Wishlist Migration]]
- [[_COMMUNITY_OTP Codes Migration|OTP Codes Migration]]
- [[_COMMUNITY_Saleor Checkout Mutations|Saleor Checkout Mutations]]
- [[_COMMUNITY_Saleor Product Node Type|Saleor Product Node Type]]
- [[_COMMUNITY_Saleor Product Response|Saleor Product Response]]
- [[_COMMUNITY_Get Product Colors Action|Get Product Colors Action]]
- [[_COMMUNITY_Toggle Wishlist Action|Toggle Wishlist Action]]
- [[_COMMUNITY_Save Profile Action|Save Profile Action]]
- [[_COMMUNITY_Save Measurements Action|Save Measurements Action]]
- [[_COMMUNITY_Signup Action|Signup Action]]
- [[_COMMUNITY_Login Action|Login Action]]
- [[_COMMUNITY_Logout Action|Logout Action]]
- [[_COMMUNITY_Resend Confirmation Action|Resend Confirmation Action]]
- [[_COMMUNITY_Forgot Password Action|Forgot Password Action]]
- [[_COMMUNITY_Reset Password Action|Reset Password Action]]
- [[_COMMUNITY_Settings JSON|Settings JSON]]

## God Nodes (most connected - your core abstractions)
1. `createSupabaseServer()` - 42 edges
2. `createSupabaseAdmin()` - 29 edges
3. `Supabase Data Layer` - 29 edges
4. `getProducts()` - 27 edges
5. `isSupabaseConfigured()` - 25 edges
6. `formatPKR()` - 20 edges
7. `useCart` - 18 edges
8. `compilerOptions` - 16 edges
9. `CheckoutFlow()` - 16 edges
10. `requireAdmin()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `Shop Page` --references--> `Supabase Data Layer`  [INFERRED]
  web/src/app/shop/page.tsx → .claude/CLAUDE.md
- `HomePage()` --references--> `Supabase Data Layer`  [INFERRED]
  web/src/app/page.tsx → .claude/CLAUDE.md
- `Test Product Colors Scratch Script` --references--> `Supabase Data Layer`  [EXTRACTED]
  web/scratch/test-product-colors.js → .claude/CLAUDE.md
- `Next.js Session Middleware` --references--> `Supabase Data Layer`  [INFERRED]
  web/src/middleware.ts → .claude/CLAUDE.md
- `Signup Form Component` --references--> `Supabase Data Layer`  [INFERRED]
  web/src/app/signup/SignupForm.tsx → .claude/CLAUDE.md

## Hyperedges (group relationships)
- **Saleor to Supabase Migration: Unified Data Layer Strategy** — concept_supabase_migration, concept_saleor_legacy_backend, concept_supabase_data_layer, concept_apollo_client_graphql, concept_supabase_js_sdk [EXTRACTED 1.00]
- **Checkout & Order Processing Flow** — concept_otp_verification, concept_bank_transfer_flow, concept_dual_write_order_logic, concept_orders_table, concept_receipts_table [INFERRED 0.95]
- **Admin Operations Hub** — concept_receipt_approval_hub, concept_centralized_pricing_management, concept_rls_policies [INFERRED 0.75]
- **Core Supabase Schema Tables (init migration)** — migrations_init_profiles_table, migrations_init_measurements_table, migrations_init_addresses_table, migrations_init_orders_table, migrations_init_order_items_table, migrations_init_receipts_table, migrations_init_wishlist_table, migrations_init_otp_codes_table [EXTRACTED 1.00]
- **Product Catalog Schema Tables** — migrations_pricing_products_table, migrations_product_colors_table, migrations_product_details_products_expanded [EXTRACTED 1.00]
- **Saleor-to-Supabase Migration Scratch Scripts** — scratch_query_saleor_script, scratch_list_saleor_products_script, scratch_sync_now_script [EXTRACTED 1.00]
- **Supabase Diagnostics Scratch Scripts** — scratch_test_product_colors_script, scratch_test_newsletter_script, scratch_test_supabase_script, scratch_check_supabase_script, scratch_test_action_script, scratch_check_db_script, scratch_read_supabase_script [INFERRED 0.95]
- **Next.js Build Configuration Files** — web_package_berkepak_web, web_tsconfig_typescript, web_nextconfig_next_config, web_postcss_config [INFERRED 0.95]
- **Admin Section Pages** — admin_admin_layout, admin_admin_overview_page, receipts_admin_receipts_page, orders_admin_orders_page, stock_stock_page, pricing_admin_pricing_page [EXTRACTED 1.00]
- **Product Detail Interactive Flow** — slug_product_page, slug_product_interactive_client, addtocart_add_to_cart [EXTRACTED 1.00]
- **Authentication Flow** — signup_signup_page, signup_signup_form, callback_auth_callback_route, middleware_session_middleware [EXTRACTED 1.00]
- **Pages Depending on Supabase Data Layer** — app_page_homepage, shop_shop_page, admin_admin_overview_page, receipts_admin_receipts_page, orders_admin_orders_page, slug_product_page [EXTRACTED 1.00]
- **Saleor Migration and Cleanup Scripts** — scratch_clean_saleor_script, scratch_query_products_script, concept_saleor_deprecation [EXTRACTED 1.00]
- **Admin Stock and Pricing Management Components** — stock_stock_dashboard_client, stock_stock_page, pricing_pricing_dashboard_client, pricing_admin_pricing_page [EXTRACTED 1.00]
- **Account Section Pages (protected by AccountLayout)** — account_layout_accountlayout, account_page_accountoverviewpage, receipts_page_receiptspage, profile_page_profilepage, addresses_page_addressespage, orders_page_orderspage, wishlist_page_wishlistpage [EXTRACTED 0.95]
- **Authentication Flow Components** — login_loginform_loginform, login_page_loginpage, forgotpassword_forgotpasswordform_forgotpasswordform, forgotpassword_page_forgotpasswordpage, resetpassword_resetpasswordform_resetpasswordform, resetpassword_page_resetpasswordpage [INFERRED 0.95]
- **Checkout Flow Steps (shipping, payment, review)** — checkout_checkoutflow_checkoutflow, checkout_checkoutflow_otp_flow, checkout_checkoutflow_multistep_checkout, checkout_checkoutflow_confirmation [EXTRACTED 1.00]
- **Bank Transfer Payment Flow** — concept_payment_bank_transfer, receipts_receiptuploadform_receiptuploadform, receipts_page_receiptspage, checkout_checkoutflow_confirmation, orders_page_orderspage [INFERRED 0.95]
- **Supabase Server Component Data Fetch Pattern** — checkout_page_checkoutpage, account_layout_accountlayout, account_page_accountoverviewpage, receipts_page_receiptspage, profile_page_profilepage, addresses_page_addressespage, orders_page_orderspage, wishlist_page_wishlistpage, lib_supabase_server_createsupabaseserver [EXTRACTED 1.00]
- **Header Client-Side Interactive Components** — components_headerclient_headerclient, components_searchoverlay_searchoverlay, lib_cart_store_usecart, lib_actions_auth_logoutaction [EXTRACTED 1.00]
- **Product Catalog Data Pipeline** — lib_products_getproducts, lib_saleor_client_saleorfetch, lib_saleor_transforms_transformproducts, lib_products_static_products, lib_products_updatecache [EXTRACTED 0.95]
- **Cart Computation Functions** — lib_cart_store_usecart, lib_cart_store_linesubtotal, lib_cart_store_cartsubtotal, lib_cart_store_cartitemcount [EXTRACTED 0.95]
- **Supabase Client Factories (browser/server/admin)** — lib_supabase_client_createsupabasebrowser, lib_supabase_server_createsupabaseserver, lib_supabase_server_createsupabaseadmin, lib_supabase_middleware_updatesession [EXTRACTED 0.95]
- **Saleor GraphQL Layer** — lib_saleor_client_saleorfetch, lib_saleor_client_saleorconfigured, lib_saleor_queries_products_query, lib_saleor_queries_product_by_slug_query, lib_saleor_transforms_transformproduct, lib_saleor_transforms_transformproducts [EXTRACTED 0.95]
- **Header Server Component Composition** — components_header_header, lib_products_getproducts, lib_admin_iscurrentuseradmin, components_setupnotice_issupabaseconfigured, lib_supabase_server_createsupabaseserver [EXTRACTED 0.95]
- **Product Type System** — lib_types_product, lib_types_fabriccategory, lib_types_fabricweave, lib_types_saleunit, lib_types_stitching, lib_types_cartline [EXTRACTED 0.95]
- **Admin Product CRUD Operations** — actions_admin_create_product, actions_admin_delete_product, actions_admin_toggle_visibility, actions_admin_get_admin_products, actions_admin_update_single_price, actions_admin_bulk_update_prices [INFERRED 0.95]
- **Receipt Upload and Approval Lifecycle** — actions_receipts_upload_receipt, actions_admin_approve_receipt, actions_admin_reject_receipt, actions_admin_send_customer_email [INFERRED 0.90]
- **Authentication Server Actions** — actions_auth_signup, actions_auth_login, actions_auth_logout, actions_auth_resend_confirmation, actions_auth_forgot_password, actions_auth_reset_password [INFERRED 0.95]
- **OTP Send and Verify Actions** — actions_otp_send_otp, actions_otp_verify_otp, actions_otp_generate_code, actions_otp_generate_unique_code [EXTRACTED 1.00]
- **Product Catalog Seed Scripts** — backend_seed_ratelist_main, scratch_extract_rate_list_reader, scratch_generate_products_script, concept_product_catalog_seed [INFERRED 0.85]
- **Inventory Management Actions** — actions_admin_add_product_color, actions_admin_upload_color_image, actions_admin_update_color_stock, actions_admin_get_product_colors_admin, actions_admin_get_product_colors [INFERRED 0.90]

## Communities (75 total, 23 thin omitted)

### Community 0 - "Order & Checkout Flow"
Cohesion: 0.06
Nodes (61): newOrderId(), placeOrder(), PlaceOrderInput, PlaceOrderResult, SaleorBillingAddressResponse, SaleorCheckoutCompleteResponse, SaleorCheckoutCreateResponse, SaleorDeliveryMethodResponse (+53 more)

### Community 1 - "Admin Product Management"
Cohesion: 0.10
Nodes (44): addProductColor(), adminCreateProduct(), adminDeleteProduct(), AdminResult, approveReceipt(), bulkUpdatePrices(), getAdminProducts(), getChannelId() (+36 more)

### Community 2 - "Product Catalog & Display"
Cohesion: 0.07
Nodes (44): HomePage(), BANNERS, HeroSlideshow(), Product Data Access Layer (Saleor+Supabase fallback), createAnonSupabaseClient(), getFeaturedAsync(), getNewArrivalsAsync(), getProductByIdAsync() (+36 more)

### Community 3 - "App Layout & Analytics"
Cohesion: 0.08
Nodes (23): subscribeToNewsletter(), inter, metadata, Analytics(), AuthListener(), Footer(), NewsletterForm(), Provider (+15 more)

### Community 4 - "Build Dependencies"
Cohesion: 0.07
Nodes (28): dependencies, next, nodemailer, react, react-dom, @supabase/ssr, @supabase/supabase-js, twilio (+20 more)

### Community 5 - "Supabase Schema & Migration"
Cohesion: 0.10
Nodes (28): Row Level Security (RLS) Pattern, Saleor GraphQL API (Legacy Backend), Saleor to Supabase Product Migration, handle_new_user() Trigger Function, measurements Table, order_items Table, orders Table, profiles Table (+20 more)

### Community 6 - "Auth & Account Pages"
Cohesion: 0.14
Nodes (17): AccountLayout(), NAV, resetPasswordAction(), AdminOverviewPage(), CheckoutPage(), isSupabaseConfigured(), SetupNotice(), Authentication Guard Pattern (+9 more)

### Community 7 - "User Account Management"
Cohesion: 0.19
Nodes (13): toggleWishlist(), AddressesPage(), AdminHeader(), HEADER_MAP, AdminLayout(), NAV, GET(), Header() (+5 more)

### Community 8 - "Admin Server Actions"
Cohesion: 0.22
Nodes (21): addProductColor, approveReceipt, bulkUpdatePrices, adminCreateProduct, adminDeleteProduct, getAdminProducts, getChannelId, getProductColorsForAdmin (+13 more)

### Community 9 - "Legacy Product Images"
Cohesion: 0.15
Nodes (21): Accessories Product Category, Apparel Product Category, Berke Pak Brand, Bio Polished Finished - Berke Pak Brand Badge Logo, Brand Directory - Fashion Brands, E-Commerce Fashion Platform Assets, Ron Jones Brand Logo, Golden Grid Brand Logo (+13 more)

### Community 10 - "TypeScript Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 11 - "Authentication Actions"
Cohesion: 0.21
Nodes (11): AuthState, forgotPasswordAction(), loginAction(), logoutAction(), normalizePhone(), resendConfirmationAction(), signupAction(), siteOrigin() (+3 more)

### Community 12 - "Admin Dashboard"
Cohesion: 0.15
Nodes (16): Admin Header Component, Admin Layout, Admin Overview Page, Auth Callback Route Handler, Abandoned Cart Reminders, Admin Auth Guard Pattern, Supabase Data Layer, Root App Layout (+8 more)

### Community 13 - "Partner Brand Assets"
Cohesion: 0.17
Nodes (16): David Smith Brand Logo, Ron Jones Brand Logo, Golden Grid Brand Logo, Climb The Mountain (CTM) Brand Logo, Golden Brand Logo (mirrored), Avant Garde Brand Logo, Berke Pak Brand Identity, Partner/Featured Brands on Storefront (+8 more)

### Community 14 - "Saleor Sync Script"
Cohesion: 0.15
Nodes (13): attr(), boolAttr(), { createClient }, env, envContent, envPath, fetchSaleorProducts(), fs (+5 more)

### Community 15 - "Product Category Concepts"
Cohesion: 0.19
Nodes (15): Accessories Category, Apparel Category, Footwear Category, Product P-001 (Footwear + Apparel Set), Product P-003 (Two-Tone Work Jacket), Product P-005 (Watch + Knitwear), Product P-007 (Hooded Blazer), Product P-001-A (Black Leather Oxford Shoes - Front View) (+7 more)

### Community 16 - "Live Product Images"
Cohesion: 0.17
Nodes (15): Category: Accessories, Category: Menswear, Category: Womenswear, Product P-002-A (Two-Tone Baseball Cap - Angle View), Product P-002-B (Two-Tone Baseball Cap - Side View), Product P-002 (Two-Tone Baseball Cap, Cream/Dark Brown), Product P-004-A (Navy Corduroy Shirt - Front View), Product P-004-B (Navy Corduroy Shirt - Alternate View) (+7 more)

### Community 17 - "Profile & Measurements"
Cohesion: 0.22
Nodes (11): saveMeasurements(), saveProfile(), SaveResult, saveMeasurements Server Action, saveProfile Server Action, ProfilePage(), Measurements, MeasurementsSection() (+3 more)

### Community 18 - "Legacy Docker Backend"
Cohesion: 0.24
Nodes (11): Saleor Docker Compose Services, Saleor Backend README, Docker Compose Saleor Stack, Dual-Write Order Logic (Saleor + Supabase), Berke Pak Fabric E-Commerce Platform, Saleor GraphQL Checkout Mutations, Next.js Storefront, Saleor Legacy Backend (Deprecated) (+3 more)

### Community 19 - "Cart & Pricing"
Cohesion: 0.25
Nodes (11): Add To Cart Component, Product Color Inventory Model, Saleor Legacy Deprecation, Admin Pricing Page, Pricing Dashboard Client Component, Clean Saleor Catalog Script, Shop Page, Product Interactive Client Component (+3 more)

### Community 20 - "Brand Identity Assets"
Cohesion: 0.24
Nodes (10): Berke Pak Fabrics Brand, Fabric / Textile Product Category, Fashion / Apparel Product Category, Berke Pak Fabrics Logo (Circular Badge), Berke Pak Fabrics Full Brand Identity Asset, David Smith Brand Logo, Product Image - Grey Full-Zip Knit Cardigan, Fashion Model Banner - Terracotta Draped Top (+2 more)

### Community 21 - "Scratch DB Tests"
Cohesion: 0.20
Nodes (8): { createClient }, env, envContent, envPath, fs, match, path, supabase

### Community 22 - "Scratch Action Tests"
Cohesion: 0.20
Nodes (8): { createClient }, env, envContent, envPath, fs, match, path, supabase

### Community 23 - "Scratch Newsletter Tests"
Cohesion: 0.20
Nodes (8): { createClient }, env, envContent, envPath, fs, match, path, supabase

### Community 24 - "Scratch SMTP Tests"
Cohesion: 0.20
Nodes (9): content, env, envPath, fs, match, nodemailer, path, smtpPort (+1 more)

### Community 25 - "Scratch Supabase Tests"
Cohesion: 0.20
Nodes (8): { createClient }, env, envContent, envPath, fs, match, path, supabase

### Community 26 - "Rate List Seeder"
Cohesion: 0.31
Nodes (8): main(), make_editorjs_description(), MathRoundPrice(), PRODUCTS_DATA (27 products), Product Catalog Seed Data (Rate List 1-1-2026), extract_rate_list PDF reader, generate_products.js script, Static product definitions (27 items)

### Community 27 - "Account Overview Pages"
Cohesion: 0.31
Nodes (8): AccountOverviewPage(), createSupabaseServer Helper, OrdersPage(), STATUS_LABEL, ReceiptsPage(), Supabase orders table, Supabase receipts table, PAYMENT_LABEL

### Community 28 - "OTP & Receipt Flow"
Cohesion: 0.33
Nodes (9): Bank Transfer (Raast/IBAN) Flow, Bespoke Stitching & Measurement Schema, OTP Verification (COD Checkout), Receipt Approval Hub (Admin), receipts Supabase Table, SMS Provider Integration for OTP, Social Auth (Google / Apple), Product Requirements Document (PRD) (+1 more)

### Community 29 - "Architecture Guidelines"
Cohesion: 0.28
Nodes (9): Project Context & Guidelines (CLAUDE.md), Apollo Client / GraphQL (Deprecated), orders Supabase Table, product_catalog Supabase Table, product_colors Supabase Table, Supabase Row Level Security (RLS), Supabase JS SDK Data Fetching, Saleor to Supabase Migration (+1 more)

### Community 30 - "Saleor Cleanup Script"
Cohesion: 0.25
Nodes (8): env, envContent, envPath, fs, main(), match, path, saleorFetch()

### Community 31 - "Order Placement Functions"
Cohesion: 0.25
Nodes (8): placeOrder, PlaceOrderInput, toSaleorAddress, generateSecureCode, generateUniqueSecureCode, sendOtp, verifyOtp, OTP Verification Flow

### Community 32 - "Saleor Product Listing"
Cohesion: 0.25
Nodes (6): env, envContent, envPath, fs, match, path

### Community 33 - "Product Colors Test"
Cohesion: 0.29
Nodes (5): { createClient }, { loadEnvConfig }, path, projectDir, supabase

### Community 34 - "Supabase Connection Test"
Cohesion: 0.29
Nodes (5): { createClient }, { loadEnvConfig }, path, projectDir, supabase

### Community 35 - "DB Spelling Fix Script"
Cohesion: 0.29
Nodes (5): { createClient }, { loadEnvConfig }, path, projectDir, supabase

### Community 36 - "Product Query Scripts"
Cohesion: 0.29
Nodes (5): { createClient }, { loadEnvConfig }, path, projectDir, supabase

### Community 37 - "Supabase Read Scripts"
Cohesion: 0.29
Nodes (5): { createClient }, { loadEnvConfig }, path, projectDir, supabase

### Community 38 - "Receipt Upload Flow"
Cohesion: 0.40
Nodes (3): uploadReceipt(), UploadReceiptResult, STATUS_LABEL

### Community 39 - "Storefront Brand Visuals"
Cohesion: 0.40
Nodes (6): Berke Pak Brand Identity, Berke Pak E-Commerce Storefront, Berke Pak Fabrics Brand Logo, Home Banner 2 - Lifestyle Model (White Background), Home Banner 4 - Lifestyle Model (Peach Background), Payment Methods Logo Strip (Visa, PayPal, Stripe, VeriSign)

### Community 40 - "Pricing & Rate Limiting"
Cohesion: 0.40
Nodes (5): Centralized Pricing Management (Admin), API Rate Limiting, WhatsApp Support & Chatbot, Plan: New Features & Pricing Refactor, General Todo Board

### Community 41 - "Next.js Middleware"
Cohesion: 0.60
Nodes (3): config, middleware(), updateSession()

### Community 42 - "Legacy Apparel Catalog"
Cohesion: 0.67
Nodes (4): Berke Pak Apparel Catalog, Product 71 - Grey Zip-Up Knit Cardigan, Product 73 - Classic Analog Watch (Gold/Brown), Product 8-2 - Dark Grey Hooded Blazer Jacket

### Community 43 - "Next.js Project Config"
Cohesion: 0.50
Nodes (4): Next.js Config (Image Remote Patterns), BerkePak Web Package Manifest, PostCSS Config (Tailwind CSS v4), TypeScript Compiler Config

### Community 44 - "Fashion Brand Logos"
Cohesion: 1.00
Nodes (4): Fashion Brand, Climb The Mountain (CTM) Brand Logo, Golden Brand Logo, Avant Garde Brand Logo

### Community 45 - "Product Data Generator"
Cohesion: 0.50
Nodes (3): fs, mappedProducts, products

### Community 46 - "Password Reset Flow"
Cohesion: 0.67
Nodes (3): resetPasswordAction Server Action, ResetPasswordPage (Server Component), ResetPasswordForm Component

### Community 48 - "Women's Apparel Products"
Cohesion: 1.00
Nodes (3): Women's Apparel, Black Draped Dress Product 7-2, Dark Grey Pleated Belted Dress Product 9

## Ambiguous Edges - Review These
- `SearchOverlay()` → `Footer()`  [AMBIGUOUS]
  web/src/components/Footer.tsx · relation: conceptually_related_to
- `Product 73 - Classic Analog Watch (Gold/Brown)` → `Berke Pak Apparel Catalog`  [AMBIGUOUS]
  images/cover1_files/product-73-grey-1-300x300.jpg · relation: conceptually_related_to
- `Product P-006-A (Classic Analog Watch - Gold/Brown)` → `Product P-006-B (Gray Full-Zip Knit Sweater)`  [AMBIGUOUS]
  web/public/products/p-006-a.jpg · relation: semantically_similar_to
- `Product P-006-B (Gray Full-Zip Knit Sweater)` → `Product P-006 (Mixed: Watch or Knit Sweater)`  [AMBIGUOUS]
  web/public/products/p-006-b.jpg · relation: references

## Knowledge Gaps
- **281 isolated node(s):** `name`, `version`, `private`, `dev`, `build` (+276 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **23 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `SearchOverlay()` and `Footer()`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Product 73 - Classic Analog Watch (Gold/Brown)` and `Berke Pak Apparel Catalog`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Product P-006-A (Classic Analog Watch - Gold/Brown)` and `Product P-006-B (Gray Full-Zip Knit Sweater)`?**
  _Edge tagged AMBIGUOUS (relation: semantically_similar_to) - confidence is low._
- **What is the exact relationship between `Product P-006-B (Gray Full-Zip Knit Sweater)` and `Product P-006 (Mixed: Watch or Knit Sweater)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `Supabase Data Layer` connect `Admin Dashboard` to `Product Catalog & Display`, `Supabase Schema & Migration`, `Pricing & Rate Limiting`, `Next.js Project Config`, `Legacy Docker Backend`, `Cart & Pricing`, `OTP & Receipt Flow`, `Architecture Guidelines`?**
  _High betweenness centrality (0.110) - this node is a cross-community bridge._
- **Why does `HomePage()` connect `Product Catalog & Display` to `Cart & Pricing`, `Admin Dashboard`?**
  _High betweenness centrality (0.107) - this node is a cross-community bridge._
- **Why does `getProducts()` connect `Product Catalog & Display` to `Order & Checkout Flow`, `Admin Product Management`, `User Account Management`?**
  _High betweenness centrality (0.101) - this node is a cross-community bridge._