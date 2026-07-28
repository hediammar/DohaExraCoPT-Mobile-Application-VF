#!/usr/bin/env node

/**
 * Version management script
 * Automatically increments version numbers in app.json
 * Usage: node scripts/version.js [patch|minor|major]
 */

const fs = require('fs');
const path = require('path');

const versionType = process.argv[2];

if (!versionType || !['patch', 'minor', 'major'].includes(versionType)) {
  console.error('Usage: node scripts/version.js [patch|minor|major]');
  process.exit(1);
}

const appJsonPath = path.join(__dirname, '..', 'app.json');

try {
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  
  // Parse current version
  const currentVersion = appJson.expo.version.split('.');
  let major = parseInt(currentVersion[0]);
  let minor = parseInt(currentVersion[1]);
  let patch = parseInt(currentVersion[2] || 0);
  
  // Increment based on type
  switch (versionType) {
    case 'major':
      major++;
      minor = 0;
      patch = 0;
      break;
    case 'minor':
      minor++;
      patch = 0;
      break;
    case 'patch':
      patch++;
      break;
  }
  
  const newVersion = `${major}.${minor}.${patch}`;
  
  // Update version and runtimeVersion
  appJson.expo.version = newVersion;
  appJson.expo.runtimeVersion = newVersion;
  
  // Increment build numbers
  if (appJson.expo.android) {
    appJson.expo.android.versionCode = (appJson.expo.android.versionCode || 1) + 1;
  }
  if (appJson.expo.ios) {
    const currentBuildNumber = parseInt(appJson.expo.ios.buildNumber || '1');
    appJson.expo.ios.buildNumber = (currentBuildNumber + 1).toString();
  }
  
  // Write back to file
  fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n');
  
  console.log(`✅ Version updated:`);
  console.log(`   Version: ${newVersion}`);
  console.log(`   Android versionCode: ${appJson.expo.android.versionCode}`);
  console.log(`   iOS buildNumber: ${appJson.expo.ios.buildNumber}`);
  console.log(`\n💡 Next steps:`);
  console.log(`   1. Build new version: npm run build:android`);
  console.log(`   2. Or push OTA update: npm run update:preview "Your update message"`);
  
} catch (error) {
  console.error('Error updating version:', error);
  process.exit(1);
}
