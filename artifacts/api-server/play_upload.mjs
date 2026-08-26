import { google } from 'googleapis';
import { createReadStream, statSync } from 'fs';

const SERVICE_ACCOUNT_PATH = '/home/runner/workspace/attached_assets/jatek2026-47284ab68ac9_1786949426981.json';
const AAB_PATH = '/tmp/jatek.aab';
const PACKAGE_NAME = 'ma.jatek.app'; // will fallback to com.jatek if not found
const TRACK = 'internal';

async function uploadToGooglePlay(packageName) {
  const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_PATH,
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });

  const androidpublisher = google.androidpublisher({ version: 'v3', auth });

  console.log(`\n📦 Package: ${packageName}`);
  console.log('🔑 Authenticating with service account...');

  // 1. Create edit
  console.log('📝 Creating edit...');
  const editRes = await androidpublisher.edits.insert({ packageName });
  const editId = editRes.data.id;
  console.log(`   Edit ID: ${editId}`);

  // 2. Upload AAB
  const aabSize = statSync(AAB_PATH).size;
  console.log(`📤 Uploading AAB (${(aabSize / 1024 / 1024).toFixed(1)} MB)...`);
  const uploadRes = await androidpublisher.edits.bundles.upload({
    packageName,
    editId,
    media: {
      mimeType: 'application/octet-stream',
      body: createReadStream(AAB_PATH),
    },
  });
  const versionCode = uploadRes.data.versionCode;
  console.log(`   ✅ AAB uploaded — versionCode: ${versionCode}`);

  // 3. Assign to track
  console.log(`🎯 Assigning to track: ${TRACK}...`);
  await androidpublisher.edits.tracks.update({
    packageName,
    editId,
    track: TRACK,
    requestBody: {
      track: TRACK,
      releases: [{
        versionCodes: [String(versionCode)],
        status: 'completed',
      }],
    },
  });
  console.log('   ✅ Track updated');

  // 4. Commit edit
  console.log('💾 Committing edit...');
  const commitRes = await androidpublisher.edits.commit({ packageName, editId });
  console.log(`   ✅ Edit committed: ${commitRes.data.id}`);

  console.log(`\n🚀 SUCCESS! Build ${versionCode} is now live on the ${TRACK} track.`);
  console.log(`   View at: https://play.google.com/console/u/0/developers/apps`);
  return true;
}

try {
  await uploadToGooglePlay(PACKAGE_NAME);
} catch (err) {
  if (err.code === 404 || (err.message && err.message.includes('applicationNotFound'))) {
    console.log(`\n⚠️  Package '${PACKAGE_NAME}' not found on Google Play — trying 'com.jatek'...`);
    try {
      await uploadToGooglePlay('com.jatek');
    } catch (err2) {
      console.error('\n❌ Upload failed for both package names:');
      console.error('   Status:', err2.code);
      console.error('   Message:', err2.message);
      if (err2.errors) console.error('   Details:', JSON.stringify(err2.errors, null, 2));
      process.exit(1);
    }
  } else {
    console.error('\n❌ Upload failed:');
    console.error('   Status:', err.code);
    console.error('   Message:', err.message);
    if (err.errors) console.error('   Details:', JSON.stringify(err.errors, null, 2));
    process.exit(1);
  }
}
