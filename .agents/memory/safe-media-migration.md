---
name: Safe media migration
description: Rules for safely moving managed Jatek media out of legacy storage prefixes.
---

Media references must be migrated in the order **copy → verify content → update every database reference → perform a final live-reference scan → delete**. New writes must reject the retired path prefix before cleanup starts.

**Why:** A destination that merely exists can contain unrelated bytes, and a stale client can otherwise recreate an old reference after the final scan. Either case can lead to broken media or deletion of the only valid object.

**How to apply:** Keep third-party URLs unchanged. For managed media, require a byte-for-byte destination check, confirm each database update affected its row, and retain any object still referenced or not fully verified.