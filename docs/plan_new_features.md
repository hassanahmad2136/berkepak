Role and Context
You are an expert full stack web developer specializing in e-commerce, UI/UX best practices, and database management. We are building a men's fabric e-commerce store using a tech stack that includes Saleor and Supabase.

Primary Objective
Refactor the current codebase to adapt the theme for selling men's fabrics, update specific UI elements, and build a new pricing management feature in the admin panel. Ensure all code follows modern web practices, is clean, and is modular.

Please execute the following tasks:

3. Theme Adaptation for Men's Fabrics
Retain Current Architecture: Keep the existing theme layout, styling, and structural components.

Refactor Copy and Context: Adjust the placeholder text, imagery placeholders, and selling points to cater specifically to men's unstitched fabrics.

Reference Site: Review [https://www.greenflagfabrics.com/](https://www.greenflagfabrics.com/) to understand the standard features, terminology, and product presentation expected in this specific niche. Align our UI's content structure with this reference.

4. Admin Feature: Centralized Pricing Management
Create a Superadmin Page: Build a new configuration page in the admin dashboard dedicated to pricing management.

Required Functionality: The UI must allow administrators to increase or decrease prices, apply percentage discounts, or add flat price increments. This should be configurable on a per article basis or as a global bulk update across all store items.

Data Synchronization: This is a critical backend task. The update logic must seamlessly synchronize these pricing changes to both Saleor and Supabase simultaneously from this single admin page to ensure data consistency.


Output Requirements
Please provide the necessary code modifications step by step, separating frontend UI changes from the backend pricing management logic. Ask for any specific files or existing component code you need to review before implementing the changes.