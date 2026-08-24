# PDF Unlocker

## Overview

An Expo React Native app focused on unlocking PDF files and sharing the unlocked copy. The web target processes PDFs in the browser, and native targets use the device document picker and share sheet.

## Tech Stack

- **Framework**: Expo SDK 54 with Expo Router
- **Language**: TypeScript
- **PDF processing**: Android PDFBox native module with `pdf-lib` fallback on web
- **Platforms**: iOS, Android, Web
- **Theme**: Light, dark, and automatic system theme preferences

## Running the App

The web preview runs on port 5000 through the `Start application` workflow:

```bash
PORT=5000 npx expo start --web --port 5000
```

Android builds use the generated `android/` project and the native `PdfUnlocker` bridge. A local Android build requires a JDK, Android SDK, and Gradle toolchain. The native engine accepts an optional password, removes PDF security, and returns a temporary shareable file.

## Privacy

PDF data is handled only during the active unlock flow. The web output uses a temporary Blob URL; native output uses the cache directory for sharing. The app clears its temporary output when the user starts over or leaves the session.