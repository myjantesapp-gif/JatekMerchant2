---
name: EAS GitHub source selection
description: Identify the correct GitHub repository and ref for merchant EAS builds when workspace mirrors diverge.
---

When multiple GitHub repositories contain copies of the Jatek workspace, do not assume the current Replit branch or a repository containing an old matching commit is the EAS source. Resolve a recent EAS build's `gitCommitHash` through GitHub, confirm which repository's current build ref produced it, and create preview-only changes from that repository.

**Why:** The merchant EAS project has diverging GitHub mirrors. A valid commit in the wrong mirror is not a valid EAS ref and can silently resolve a preview build to stale mobile code.

**How to apply:** Before syncing or building, verify the source repository from recent EAS build metadata, compare its current ref, and confirm the new build's commit hash matches the intended mobile-only revision.