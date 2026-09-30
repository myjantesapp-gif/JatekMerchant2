---
name: Merchant employee screen flow
description: User-confirmed navigation and order-detail behavior for employee accounts.
---

Employees should have only Orders, Menu, and Profile, with Orders as the initial screen. Incoming-order alerts should appear over Orders, and tapping any listed order should present its details as a modal. Merchant and admin navigation should keep its existing full-screen order-detail behavior. Keep employee sign-out in Profile; do not expose the Shop parameters tab to employees.

**Why:** The user clarified the screen list after an earlier correction; the latest confirmed choice is Orders, Menu, and Profile, with both incoming-order alerts and tap-to-open order-detail modals.

**How to apply:** Preserve role-specific tab visibility and route guards. Employees may use Orders, Menu, Profile, and order-detail modals only; keep Reviews, account Settings, shop-profile, and Shop parameters merchant-only.