---
name: Offline EAS config validation
description: Validate eas.json without EAS project access or starting a cloud build.
---

When `eas config` cannot run because the installed CLI is older than the `cli.version` constraint or the EAS project denies read access, use the installed `@expo/eas-json` validator locally. Read the complete config with `EasJsonAccessor` and resolve every build profile with `EasJsonUtils`; this validates the full schema without contacting EAS or creating a build.

**Why:** EAS's config display command may need remote project metadata, even though the build-profile JSON can be validated locally.

**How to apply:** Use the EAS JSON library version compatible with the project's declared CLI constraint, and resolve every affected profile/platform to validate merged values as well as syntax.