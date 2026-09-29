---
name: Merchant order-alert context boundary
description: Prevent an import cycle between the global incoming-order alert and order actions.
---

The global incoming-order alert consumes order actions from the shared order context, so compose the alert host as a child alongside the routed app under the provider instead of importing the alert into the provider module.

**Why:** Mounting the previously unused provider activated a circular import from provider to alert and back to the provider hook, which Metro warned about.

**How to apply:** Keep shared context modules independent of components that consume that context; mount those components at the root under the provider.