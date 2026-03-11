# imgpdf — Image to PDF Converter

## Overview

An Expo React Native app that converts images to PDFs. Runs on web via Expo's web target.

## Tech Stack

- **Framework**: Expo (SDK ~54) with Expo Router (file-based routing)
- **Language**: TypeScript
- **Platforms**: iOS, Android, Web
- **State**: React hooks (local state)
- **Styling**: React Native StyleSheet

## Project Structure

```
app/
  _layout.tsx         # Root layout (Stack navigator)
  modal.tsx           # Modal screen
  (tabs)/
    _layout.tsx       # Tab layout
    index.tsx         # Home tab
    explore.tsx       # Explore tab
components/           # Shared UI components
constants/
  theme.ts            # Theme/color constants
hooks/                # Custom hooks (useColorScheme, etc.)
assets/               # Images, icons, fonts
```

## Running the App

The app runs on port 5000 via the "Start application" workflow:

```bash
PORT=5000 npx expo start --web --port 5000
```

## Key Notes

- Expo web output is configured as "static" in app.json
- React Compiler is enabled (experiments.reactCompiler: true)
- New architecture is enabled (newArchEnabled: true)
- The app supports dark/light mode via useColorScheme hook
