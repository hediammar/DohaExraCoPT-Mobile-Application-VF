// Test script to verify Supabase storage bucket setup
// Run this in your browser console or as a Node.js script

const { createClient } = require('@supabase/supabase-js');

// Replace with your Supabase URL and anon key
const supabaseUrl = 'https://xpwvyqhkxucpqvncyprw.supabase.co';
const supabaseKey = 'your-anon-key'; // Replace with your actual anon key

const supabase = createClient(supabaseUrl, supabaseKey);

async function testStorageSetup() {
  try {
    console.log('Testing storage bucket setup...');
    
    // Test 1: List buckets
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    if (bucketsError) {
      console.error('Error listing buckets:', bucketsError);
    } else {
      console.log('Available buckets:', buckets);
      const panelImagesBucket = buckets.find(b => b.id === 'panel-images');
      if (panelImagesBucket) {
        console.log('✅ panel-images bucket exists:', panelImagesBucket);
      } else {
        console.log('❌ panel-images bucket not found');
      }
    }
    
    // Test 2: Try to list objects in panel-images bucket
    const { data: objects, error: objectsError } = await supabase.storage
      .from('panel-images')
      .list('panel-status-images');
    
    if (objectsError) {
      console.error('Error listing objects:', objectsError);
    } else {
      console.log('Objects in panel-status-images folder:', objects);
    }
    
    // Test 3: Try to upload a test file
    const testBlob = new Blob(['test'], { type: 'text/plain' });
    const testFileName = `test_${Date.now()}.txt`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('panel-images')
      .upload(`test/${testFileName}`, testBlob);
    
    if (uploadError) {
      console.error('Error uploading test file:', uploadError);
    } else {
      console.log('✅ Test upload successful:', uploadData);
      
      // Clean up test file
      const { error: deleteError } = await supabase.storage
        .from('panel-images')
        .remove([`test/${testFileName}`]);
      
      if (deleteError) {
        console.error('Error deleting test file:', deleteError);
      } else {
        console.log('✅ Test file cleaned up');
      }
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testStorageSetup(); 