# PDF Unlocker

## Overview

An Expo React Native app focused on unlocking PDF files and sharing the unlocked copy. The web target processes PDFs in the browser, and native targets use the device document picker and share sheet.

## Tech Stack

- **Framework**: Expo SDK 54 with Expo Router
- **Language**: TypeScript
- **PDF processing**: `pdf-lib`
- **Platforms**: iOS, Android, Web
- **Theme**: Light, dark, and automatic system theme preferences

## Running the App

The app runs on port 5000 through the `Start application` workflow:

```bash
PORT=5000 npx expo start --web --port 5000
```

## Privacy

PDF data is handled only during the active unlock flow. The web output uses a temporary Blob URL; native output uses the cache directory for sharing. The app clears its temporary output when the user starts over or leaves the session.