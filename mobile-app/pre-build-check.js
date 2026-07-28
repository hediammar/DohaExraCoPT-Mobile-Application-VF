#!/usr/bin/env node

/**
 * Pre-build validation script
 * Run this before building to ensure everything is configured correctly
 */

const fs = require('fs');
const path = require('path');

const errors = [];
const warnings = [];
const isPlayStoreCheck = process.argv.includes('--play-store');

// Check if app.json exists and is valid
function checkAppJson() {
  const appJsonPath = path.join(__dirname, 'app.json');
  if (!fs.existsSync(appJsonPath)) {
    errors.push('app.json is missing');
    return;
  }

  try {
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
    
    // Check required fields
    if (!appJson.expo) {
      errors.push('app.json: expo section is missing');
    } else {
      if (!appJson.expo.name) errors.push('app.json: name is missing');
      if (!appJson.expo.slug) errors.push('app.json: slug is missing');
      if (!appJson.expo.version) errors.push('app.json: version is missing');
      if (!appJson.expo.extra?.eas?.projectId) {
        warnings.push('app.json: EAS projectId is missing (will be created on first build)');
      }

      if (isPlayStoreCheck) {
        const android = appJson.expo.android;
        if (!android?.package) {
          errors.push('app.json: android.package is required for Google Play');
        }
        if (!android?.versionCode || android.versionCode < 1) {
          errors.push('app.json: android.versionCode must be >= 1 for Google Play');
        }
        if (!android?.adaptiveIcon?.foregroundImage) {
          errors.push('app.json: android.adaptiveIcon.foregroundImage is required for Google Play');
        }
        if (!appJson.expo.runtimeVersion) {
          warnings.push('app.json: runtimeVersion is recommended for release builds');
        }
      }
    }
  } catch (e) {
    errors.push(`app.json: Invalid JSON - ${e.message}`);
  }
}

// Check if required assets exist
function checkAssets() {
  const assetsDir = path.join(__dirname, 'assets');
  const requiredAssets = [
    'icon.png',
    'adaptive-icon.png',
    'splash-icon.png',
    'DohaTracker.png'
  ];

  if (!fs.existsSync(assetsDir)) {
    errors.push('assets directory is missing');
    return;
  }

  requiredAssets.forEach(asset => {
    const assetPath = path.join(assetsDir, asset);
    if (!fs.existsSync(assetPath)) {
      warnings.push(`Asset missing: ${asset} (may cause build issues)`);
    }
  });
}

// Check if package.json has required dependencies
function checkDependencies() {
  const packageJsonPath = path.join(__dirname, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    errors.push('package.json is missing');
    return;
  }

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const requiredDeps = [
      'expo',
      'react',
      'react-native',
      '@react-navigation/native',
      '@supabase/supabase-js'
    ];

    requiredDeps.forEach(dep => {
      if (!packageJson.dependencies?.[dep] && !packageJson.devDependencies?.[dep]) {
        warnings.push(`Dependency missing: ${dep}`);
      }
    });
  } catch (e) {
    errors.push(`package.json: Invalid JSON - ${e.message}`);
  }
}

// Check if entry point exists
function checkEntryPoint() {
  const entryPoints = ['index.ts', 'index.js', 'index.tsx', 'index.jsx'];
  let found = false;

  for (const entry of entryPoints) {
    if (fs.existsSync(path.join(__dirname, entry))) {
      found = true;
      break;
    }
  }

  if (!found) {
    errors.push('Entry point (index.ts/js/tsx/jsx) is missing');
  }
}

// Check if eas.json exists
function checkEasJson() {
  const easJsonPath = path.join(__dirname, 'eas.json');
  if (!fs.existsSync(easJsonPath)) {
    warnings.push('eas.json is missing (EAS will use defaults)');
    return;
  }

  try {
    const easJson = JSON.parse(fs.readFileSync(easJsonPath, 'utf8'));
    if (!easJson.build) {
      warnings.push('eas.json: build configuration is missing');
    }

    if (isPlayStoreCheck) {
      const productionAndroid = easJson.build?.production?.android;
      if (!productionAndroid) {
        errors.push('eas.json: build.production.android is required for Google Play');
      } else if (productionAndroid.buildType !== 'app-bundle') {
        errors.push(
          'eas.json: production Android buildType must be "app-bundle" (Google Play requires AAB, not APK)'
        );
      }
    }
  } catch (e) {
    warnings.push(`eas.json: Invalid JSON - ${e.message}`);
  }
}

function checkPlayStoreCredentials() {
  if (!isPlayStoreCheck) return;

  const serviceAccountPath = path.join(
    __dirname,
    'credentials',
    'google-play-service-account.json'
  );

  if (!fs.existsSync(serviceAccountPath)) {
    warnings.push(
      'Google Play service account key missing at credentials/google-play-service-account.json (required for eas submit)'
    );
  }
}

// Run all checks
console.log(
  isPlayStoreCheck
    ? '🔍 Running Google Play pre-build checks...\n'
    : '🔍 Running pre-build checks...\n'
);

checkAppJson();
checkAssets();
checkDependencies();
checkEntryPoint();
checkEasJson();
checkPlayStoreCredentials();

// Report results
if (errors.length > 0) {
  console.error('❌ ERRORS FOUND:');
  errors.forEach(error => console.error(`  - ${error}`));
  console.error('\n⚠️  Please fix these errors before building.\n');
  process.exit(1);
}

if (warnings.length > 0) {
  console.warn('⚠️  WARNINGS:');
  warnings.forEach(warning => console.warn(`  - ${warning}`));
  console.warn('\n💡 These warnings may not prevent the build, but should be addressed.\n');
}

if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ All checks passed! Ready to build.\n');
} else if (errors.length === 0) {
  console.log('✅ No critical errors found. You can proceed with the build.\n');
}

process.exit(0);
