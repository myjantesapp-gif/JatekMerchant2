---
name: Dashboard component test environment
description: Browser-like test environment requirements for dashboard components using Radix UI controls
---

Use Happy DOM for dashboard component tests that interact with Radix UI Select or other portal/focus-heavy controls. It provides the browser APIs needed for reliable interaction tests in this workspace.

**Why:** jsdom lacks parts of the pointer-capture, scrolling, and focus lifecycle used by Radix Select, causing false hangs or incomplete state updates even when the application works in a browser.

**How to apply:** Configure the dashboard Vitest environment as `happy-dom` before adding tests for interactive Radix controls; keep DOM method shims local to the test only when the component still needs them.