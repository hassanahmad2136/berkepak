p.p1 {margin: 0.0px 0.0px 6.0px 0.0px; font: 23.0px Times; color: #1f1f1f}
    p.p2 {margin: 0.0px 0.0px 8.0px 0.0px; font: 12.0px Times; color: #1f1f1f}
    p.p3 {margin: 0.0px 0.0px 0.0px 0.0px; font: 12.0px Times; min-height: 14.0px}
    p.p4 {margin: 0.0px 0.0px 6.0px 0.0px; font: 17.0px Times; color: #1f1f1f}
    p.p5 {margin: 0.0px 0.0px 24.0px 0.0px; font: 12.0px Times; color: #1f1f1f}
    p.p6 {margin: 0.0px 0.0px 6.0px 0.0px; font: 13.0px Times; color: #1f1f1f}
    p.p10 {margin: 0.0px 0.0px 26.0px 36.0px; font: 12.0px Times; min-height: 14.0px}
    p.p11 {margin: 0.0px 0.0px 0.0px 30.0px; font: 12.0px Times; min-height: 14.0px}
    li.li7 {margin: 0.0px 0.0px 0.0px 0.0px; font: 12.0px Times; color: #1f1f1f}
    li.li8 {margin: 0.0px 0.0px 26.0px 0.0px; font: 12.0px Times; color: #1f1f1f}
    li.li9 {margin: 0.0px 0.0px 26.0px 0.0px; font: 12.0px 'Arial Unicode MS'; color: #1f1f1f}
    span.s1 {font: 12.0px Times}
    table.t1 {border-collapse: collapse}
    td.td1 {border-style: solid; border-width: 1.0px 1.0px 1.0px 1.0px; border-color: #bfbfbf #bfbfbf #bfbfbf #bfbfbf; padding: 0.0px 5.0px 0.0px 5.0px}
    ul.ul1 {list-style-type: disc}
  

Product Requirements Document: Berke Pak Fabrics Web App (Final Version)

**Document Status:** Production-Ready / Final **Architectural Approach:** Headless E-Commerce **Visual Benchmark:** Zara, Mango, ASOS

## 1. Project Vision & Strategy

The objective is to transition from a legacy WordPress site to a high-performance, minimalist web application that delivers a premium, editorial shopping experience. The platform is designed to handle raw fabrics (sold by suit or meter) and possesses the architectural flexibility to scale into ready-to-wear and bespoke stitched apparel.

## 2. Technical Architecture

| **Component****** | **Technology****** | **Purpose****** |
| --- | --- | --- |
| **Frontend (FE)****** | **Next.js (React)****** | Ensures "instant-load" performance, smooth transitions, and advanced SEO through Server-Side Rendering (SSR). |
| **Backend (BE)****** | **Saleor (Django/Python)****** | A robust e-commerce engine providing a GraphQL API for inventory, orders, and complex product variants. |
| **Database (DB)****** | **Supabase (PostgreSQL)****** | Managed relational storage for high-integrity user data, transaction logs, and product metadata. |
| **Infrastructure****** | **Docker & Vercel****** | Containerized backend services for environment consistency and Vercel for high-availability frontend hosting. |

## 3. User Authentication & Account Management

## 3.1 End-to-End (E2E) Auth Flow
- **Secure Signup**: Collects Name, Email, Mobile Number, and Password.
- **Verification**: Automated email system sends a unique verification link to validate the user's identity.
- **Social Auth**: Integrated "One-Click" registration using Google and Apple ID.
- **JWT Security**: User sessions are authenticated via JSON Web Tokens (JWT) managed by Saleor and persisted in Supabase.

3.2 Customer Dashboard
- **Profile Management**: Interface for updating shipping addresses, tracking order history, and managing a personal "Wishlist".
- **Payment Hub**: A dedicated secure module for users to **upload bank transfer screenshots** for manual verification.

## 4. Frontend (FE) Specification

## 4.1 Visual Identity
- **Minimalist Aesthetic**: High-contrast layouts with bold sans-serif typography and optimized white space.
- **Editorial Media**: High-definition video loops showcasing fabric drape and texture detail instead of static thumbnails.
- **Global Search**: A predictive, minimalist search interface providing real-time product and category suggestions.

4.2 Core Pages
- **Homepage**: Features editorial banners for "New Arrivals" and "Fabric of the Month" storytelling.
- **Product Listing Page (PLP)**: Clean grid layout with AJAX-based filters for thread count, weave, fabric type, and color.
- **Product Detail Page (PDP)**: Includes a "Texture Zoom" video player, price-per-meter logic, and detailed fabric weight (GSM) specifications.
- **Interactive Cart**: A slide-out mini-cart drawer for immediate quantity adjustments without page navigation.
- **Checkout**: A 3-step, mobile-first journey (Shipping → Payment → Review).

## 5. Localized Operational Functions

## 5.1 Cash on Delivery (CoD) + OTP
- **Pre-Verification**: To mitigate fake orders, the system triggers a mobile OTP (via SMS/WhatsApp API) during the final checkout step.
- **Order State**: Orders remain in an "Unconfirmed" state until the user successfully validates the 4-digit code.

5.2 Bank Transfer (Raast/IBAN)
- **Information Flow**: Dynamic display of bank account details on the "Order Success" page.
- **Verification Workflow**: A portal in the User Dashboard allows customers to upload transaction receipts; admins manually verify these before releasing the order to fulfillment.

## 6. Backend (BE) Admin Functions
- **Saleor Dashboard**: A React-based administrative console for real-time sales analytics and inventory control.
- **Receipt Approval Hub**: A custom-built admin view to filter, review, and approve uploaded bank transfer receipts.
- **Fulfillment Engine**: Integrated tools for generating shipping labels and updating tracking information.

## 7. Performance, Marketing & Support (Enhanced)

## 7.1 Performance & SEO
- **Snappy Performance**: Targeted Largest Contentful Paint (LCP) of under 1.5s using Next.js Image Optimization.
- **Dynamic Meta Tags**: Automated SEO tagging for every fabric category to improve Google search visibility.

7.2 Marketing & Support
- **Analytics**: Integrated Meta (Facebook) Pixel and Google Analytics 4 (GA4) for event tracking and retargeting.
- **WhatsApp Support**: A floating API button to facilitate direct customer-to-brand communication.
- **Recovery Logic**: Automated "Abandoned Cart" reminders sent via email/SMS.

## 8. Phase 5: Stitched & Bespoke Scaling

## 8.1 Custom Measurement Schema

To support bespoke tailoring, the database and PDP will be updated to collect:
- **Measurement Profile**: Fields for Chest, Shoulder, Length, Sleeves, and Neck size.
- **Stitching Toggle**: A conditional selector on the PDP to choose between "Unstitched" and "Bespoke Stitching" (+ add-on cost).

## 9. Implementation Roadmap
- **Phase 1 (Infrastructure)**: Provision Supabase PostgreSQL and deploy Saleor BE via Docker.
- **Phase 2 (Auth & Schema)**: Configure JWT authentication and define the fabric-specific product attributes (GSM, Weave, Color).
- **Phase 3 (FE Build)**: Develop the Next.js storefront focusing on editorial animations and minimalist UI.
- **Phase 4 (Localized Logic)**: Integrate the OTP verification and Receipt Upload systems.
- **Phase 5 (Stitched Scaling)**: Implement the measurement collection schema and size-grid functionality.
