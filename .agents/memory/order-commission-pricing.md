---
name: Order commission pricing
description: Durable pricing rule for restaurant-specific Jatek commissions and customer totals.
---

JATEK's fee is a restaurant-specific percentage applied to the product subtotal after percentage/fixed product discounts, never to delivery charges. Product prices are TTC, so the customer total is discounted products + delivery + the JATEK fee, without adding a second VAT layer.

**Why:** The business example defines a 20% fee on 50 MAD of products as 10 MAD, with a 15 MAD delivery charge and a 75 MAD customer total. Applying tax again or including delivery in the base overcharges the customer.

**How to apply:** Store the restaurant rate as a decimal (0.20), display/edit it as a percentage (20%), and show it on every shop record. Admins may edit any shop; owners may edit only their own. Snapshot the rate and fee on each order, and keep merchant, driver, JATEK, and customer amounts separate in reports.