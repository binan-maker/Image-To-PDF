---
name: PDF processing in Expo web
description: Compatibility constraint for client-side PDF processing in this Expo SDK 54 app.
---

The Expo web bundle must resolve `pdf-lib` through its CommonJS build; Metro package exports currently route its `tslib` dependency to an incompatible ESM path.

**Why:** The default Expo Metro resolver crashed at runtime while importing pdf-lib, before the app rendered.

**How to apply:** Keep Metro package exports disabled unless the Expo/pdf-lib dependency versions are upgraded and verified together.

Expo's built-in document picker, file system, and sharing APIs do not decrypt or remove PDF security. A true password-encrypted PDF needs a dedicated native/WASM/server PDF security engine; sharing the original bytes is not an unlock.