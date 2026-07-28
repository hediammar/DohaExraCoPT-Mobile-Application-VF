# Versioning & Updates Guide

## Overview

The app uses **EAS Build** for creating APKs and **EAS Update** for Over-The-Air (OTA) updates.

- **Full Builds (APK)**: Required for native code changes, new dependencies, or major updates
- **OTA Updates**: Push JavaScript/React changes instantly without reinstalling

## Version Management

### Current Version Structure
- **App Version**: 1.1.0 (semantic versioning: major.minor.patch)
- **Android versionCode**: 2 (integer that must increment)
- **iOS buildNumber**: 2 (string that must increment)

### Increment Version

Before building or updating, increment the version:

```bash
# For bug fixes (1.1.0 → 1.1.1)
npm run version:patch

# For new features (1.1.0 → 1.2.0)
npm run version:minor

# For breaking changes (1.1.0 → 2.0.0)
npm run version:major
```

This automatically updates:
- App version in app.json
- Android versionCode
- iOS buildNumber

## Building Full APK

### When to Build a New APK:
- First release
- Native code changes (permissions, plugins, etc.)
- New native dependencies
- Major version bumps
- Changes to app.json configuration

### Build Commands:

```bash
# 1. Increment version
npm run version:patch

# 2. Build for testing
npm run build:android

# 3. Or build for production
npm run build:android:prod
```

### Build Process:
1. EAS builds the APK (10-20 minutes)
2. You get a download link
3. Users install the new APK

## Pushing OTA Updates

### When to Use OTA Updates:
- JavaScript/TypeScript code changes
- React component updates
- UI/styling changes
- Bug fixes (no native code)
- Database logic changes

### Update Commands:

```bash
# Push update to preview channel
npm run update:preview "Fixed login bug"

# Push update to production channel
npm run update:production "Added new features"
```

### How OTA Updates Work:
1. You push the update to EAS
2. Apps with matching runtime version check for updates on launch
3. Update downloads in background
4. Update applies automatically on next app restart
5. **No reinstall required!**

## Update Flow

### Scenario 1: Bug Fix (OTA Update)
```bash
# 1. Make code changes
# 2. Push update (no version bump needed)
npm run update:preview "Fixed panel display issue"
# 3. Users automatically get update on next launch
```

### Scenario 2: New Feature (OTA Update)
```bash
# 1. Make code changes
# 2. Optional: bump version for tracking
npm run version:minor
# 3. Push update
npm run update:preview "Added panel filtering"
# 4. Users automatically get update
```

### Scenario 3: Native Changes (Full Build)
```bash
# 1. Make changes (e.g., add new plugin)
# 2. Increment version
npm run version:minor
# 3. Build new APK
npm run build:android
# 4. Users must install new APK
```

## Automatic Updates Configuration

The app is configured to:
- ✅ Check for updates on app launch (`checkAutomatically: "ON_LOAD"`)
- ✅ Download updates in background
- ✅ Apply updates on next app restart
- ✅ Fall back to cached version if update fails

## Channels

- **preview**: For testing and internal distribution
- **production**: For production/public releases

## Version Compatibility

The `runtimeVersion` is set to `"appVersion"`, meaning:
- Updates only apply to apps with the same version number
- Example: An app on v1.1.0 will only receive updates published for v1.1.0
- If you increment the version, you need a new build

## Quick Reference

| Task | Command |
|------|---------|
| Bump patch version | `npm run version:patch` |
| Bump minor version | `npm run version:minor` |
| Bump major version | `npm run version:major` |
| Build preview APK | `npm run build:android` |
| Build production APK | `npm run build:android:prod` |
| Push preview update | `npm run update:preview "message"` |
| Push production update | `npm run update:production "message"` |

## Best Practices

1. **Always test updates** on preview channel before production
2. **Increment version** before building APKs
3. **Use OTA updates** for quick fixes and code changes
4. **Build new APK** when adding dependencies or changing native config
5. **Document changes** in update messages
6. **Test on device** before pushing updates

## Install expo-updates

Before your first update, install the package:
```bash
npm install
```

This will install `expo-updates@~0.27.0` added to package.json.
