// Debug script for buildings CRUD operations
// Run this in your browser console to identify the issue

const debugBuildingsIssue = async () => {
  console.log('=== BUILDINGS CRUD DEBUG ===');
  
  // Test 1: Check if buildings table exists and is accessible
  console.log('1. Testing buildings table access...');
  try {
    const { data: testData, error: testError } = await supabase
      .from('buildings')
      .select('*')
      .limit(5);
    
    if (testError) {
      console.error('❌ Cannot access buildings table:', testError);
      return;
    }
    console.log('✅ Buildings table accessible. Found buildings:', testData?.length || 0);
    console.log('Available buildings:', testData);
  } catch (error) {
    console.error('❌ Error testing buildings table:', error);
    return;
  }
  
  // Test 2: Check current user
  console.log('\n2. Checking current user...');
  try {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const userData = JSON.parse(storedUser);
      console.log('✅ Current user from localStorage:', userData);
      console.log('User ID:', userData.id);
      console.log('User role:', userData.role);
    } else {
      console.log('⚠️ No user found in localStorage');
    }
  } catch (error) {
    console.error('❌ Error checking current user:', error);
  }
  
  // Test 3: Check if user exists in database
  console.log('\n3. Checking if user exists in database...');
  try {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const userData = JSON.parse(storedUser);
      const { data: dbUser, error: dbError } = await supabase
        .from('users')
        .select('id, username, name, role')
        .eq('id', userData.id)
        .single();
      
      if (dbError) {
        console.error('❌ Error checking user in database:', dbError);
        console.log('⚠️ User not found in users table. This is likely the issue!');
      } else {
        console.log('✅ User found in database:', dbUser);
      }
    }
  } catch (error) {
    console.error('❌ Error checking user in database:', error);
  }
  
  // Test 4: Try to create a test building
  console.log('\n4. Testing building creation...');
  try {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const userData = JSON.parse(storedUser);
      
      const testBuildingData = {
        name: 'Test Building',
        project_id: '00000000-0000-0000-0000-000000000000', // Use a valid project ID
        address: 'Test Address',
        status: 1, // Active
        description: 'Test building for debugging',
        user_id: userData.id
      };
      
      console.log('Creating building with data:', testBuildingData);
      
      const { data: newBuilding, error: createError } = await supabase
        .from('buildings')
        .insert(testBuildingData)
        .select()
        .single();
      
      if (createError) {
        console.error('❌ Error creating building:', createError);
        console.error('Create error details:', {
          message: createError.message,
          details: createError.details,
          hint: createError.hint,
          code: createError.code
        });
      } else {
        console.log('✅ Building created successfully:', newBuilding);
        
        // Clean up - delete the test building
        const { error: deleteError } = await supabase
          .from('buildings')
          .delete()
          .eq('id', newBuilding.id);
        
        if (deleteError) {
          console.error('❌ Error deleting test building:', deleteError);
        } else {
          console.log('✅ Test building cleaned up');
        }
      }
    } else {
      console.log('⚠️ No user found, skipping building creation test');
    }
  } catch (error) {
    console.error('❌ Exception during building creation test:', error);
  }
  
  // Test 5: Check projects table
  console.log('\n5. Checking projects table...');
  try {
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, name')
      .limit(5);
    
    if (projectsError) {
      console.error('❌ Error accessing projects table:', projectsError);
    } else {
      console.log('✅ Projects table accessible. Found projects:', projects?.length || 0);
      console.log('Available projects:', projects);
    }
  } catch (error) {
    console.error('❌ Error checking projects table:', error);
  }
  
  console.log('\n=== DEBUG COMPLETE ===');
};

// Run the debug function
debugBuildingsIssue(); 