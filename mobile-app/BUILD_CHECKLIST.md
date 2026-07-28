# Build Success Checklist

## ✅ Pre-Build Validation

Run the pre-build check script before building:
```bash
npm run prebuild
```

This will verify:
- ✅ app.json is valid and complete
- ✅ All required assets exist
- ✅ All dependencies are listed
- ✅ Entry point exists
- ✅ EAS configuration is present

## ✅ Configuration Checklist

### 1. App Configuration (app.json)
- [x] App name: "DohaExtraCo PT"
- [x] Slug: "dohaextraco-pt-mobile"
- [x] Version: "1.0.0"
- [x] Android package: "com.dohaextraco.pt"
- [x] iOS bundle identifier: "com.dohaextraco.pt"
- [x] EAS project ID configured
- [x] Splash screen background matches app theme (#8B2633)

### 2. Assets
- [x] icon.png exists
- [x] adaptive-icon.png exists
- [x] splash-icon.png exists
- [x] DohaTracker.png exists (for splash screen)

### 3. Dependencies
- [x] All required packages in package.json
- [x] Expo SDK 54.0.20
- [x] React Native 0.81.5
- [x] Navigation libraries
- [x] Supabase client

### 4. EAS Build Configuration
- [x] eas.json configured
- [x] Preview profile set to APK (internal QA)
- [x] Production profile set to AAB (Google Play)
- [x] Submit profile configured for Google Play
- [x] Build profiles defined

### 5. Code Quality
- [x] No TypeScript errors
- [x] No linting errors
- [x] All imports resolved
- [x] Entry point (index.ts) exists

## 🚀 Build Commands

### Preview Build (Recommended for testing)
```bash
npm run build:android
# or
eas build --platform android --profile preview
```

### Production Build (Google Play AAB)
```bash
npm run prebuild:play
npm run build:play
# or
eas build --platform android --profile production
```

### Submit to Google Play
```bash
npm run submit:play
```

## 📋 Before Building

1. **Ensure you're logged in:**
   ```bash
   eas login
   ```

2. **Run pre-build check:**
   ```bash
   npm run prebuild
   ```

3. **Verify dependencies are installed:**
   ```bash
   npm install
   ```

4. **Test locally first (optional):**
   ```bash
   npm start
   ```

## ⚠️ Common Issues & Solutions

### Issue: Build fails with "Missing asset"
**Solution:** Ensure all assets in `assets/` directory exist

### Issue: Build fails with "Invalid app.json"
**Solution:** Run `npm run prebuild` to identify issues

### Issue: Build fails with dependency errors
**Solution:** Run `npm install` to ensure all dependencies are installed

### Issue: EAS project ID mismatch
**Solution:** The project ID will be created automatically on first build, or you can update it in app.json

## 📱 After Build Completes

1. **Download APK:**
   - Link will be provided in terminal
   - Also available on Expo dashboard

2. **Test the APK:**
   - Install on Android device
   - Test all major features
   - Verify splash screen displays correctly

3. **Share the link:**
   - APK download link is valid for 30 days
   - Share with testers or for distribution

## 🔍 Build Status

Monitor your build at:
- Terminal output (real-time)
- Expo Dashboard: https://expo.dev/accounts/[your-account]/projects/dohaextraco-pt-mobile/builds

## ✅ Success Indicators

Your build is successful when:
- ✅ Build completes without errors
- ✅ APK download link is provided
- ✅ APK can be installed on Android device
- ✅ App launches and shows splash screen
- ✅ App navigates correctly
