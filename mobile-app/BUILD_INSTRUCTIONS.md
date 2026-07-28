# Building & Publishing (Android)

## Prerequisites

1. Install EAS CLI:
   ```bash
   npm install -g eas-cli
   ```

2. Log in to Expo:
   ```bash
   eas login
   ```

3. Install dependencies:
   ```bash
   cd mobile-app
   npm install
   ```

---

## Google Play Store (Production)

Google Play requires an **AAB (Android App Bundle)**, not an APK. The `production` profile is configured for Play Store upload.

### 1. Pre-flight checks

```bash
npm run prebuild:play
```

### 2. Create Google Play Console app (one-time)

1. Open [Google Play Console](https://play.google.com/console)
2. Create app: **DohaExtraCo PT**
3. Package name must match: `com.dohaextraco.pt`
4. Complete required store listing:
   - Short & full description
   - App icon (512×512)
   - Feature graphic (1024×500)
   - Screenshots (phone)
   - Privacy policy URL (required)
   - Content rating questionnaire
   - Data safety form (declare camera, location, account data)

### 3. Set up Play API access for automated upload (one-time)

1. Play Console → **Setup** → **API access**
2. Link a Google Cloud project
3. Create a **service account** with Play Console access
4. Grant the service account **Release manager** (or Admin) on your app
5. Download JSON key and save as:
   ```
   mobile-app/credentials/google-play-service-account.json
   ```
   (Use `credentials/google-play-service-account.json.example` as reference — do not commit the real key.)

### 4. Configure EAS Android credentials (one-time)

```bash
cd mobile-app
eas credentials
```

Choose Android → production. EAS can generate and manage your upload keystore for Play App Signing.

### 5. Bump version before each release

```bash
npm run version:patch
```

This updates `version`, `android.versionCode`, and `ios.buildNumber`.

### 6. Build release AAB

```bash
npm run build:play
```

Equivalent command:
```bash
eas build --platform android --profile production
```

- Output: `.aab` (Android App Bundle)
- `autoIncrement` is enabled for remote version codes on EAS

### 7. Submit to Google Play

After the build completes:

```bash
npm run submit:play
```

Equivalent command:
```bash
eas submit --platform android --profile production --latest
```

Default submit track in `eas.json` is **`internal`** (closed testing). When ready for public release, change `submit.production.android.track` in `eas.json` to `production`.

### 8. Promote release in Play Console

1. Play Console → **Release** → **Testing** (or **Production**)
2. Review the uploaded AAB
3. Complete any policy checks
4. Roll out to testers or production

---

## Internal testing APK (optional)

For sideloading / QA without Play Store:

```bash
npm run build:android
# eas build --platform android --profile preview
```

Preview profile builds an **APK** for direct install.

---

## Build profiles summary

| Profile      | Output | Use case                          |
|-------------|--------|-----------------------------------|
| `preview`   | APK    | Internal QA, sideload             |
| `production`| AAB    | Google Play Store                 |

---

## Quick reference

| Task                    | Command                    |
|-------------------------|----------------------------|
| Play pre-check          | `npm run prebuild:play`    |
| Play Store AAB build    | `npm run build:play`       |
| Upload to Play          | `npm run submit:play`      |
| Version bump (patch)    | `npm run version:patch`    |
| QA APK                  | `npm run build:android`    |

---

## Notes

- **Package ID**: `com.dohaextraco.pt` — cannot be changed after first Play upload
- **versionCode** must increase on every Play upload
- Service account JSON must never be committed (see `.gitignore`)
- Play builds use `app-bundle`; preview builds use `apk`
- Monitor builds: https://expo.dev → your project → Builds
