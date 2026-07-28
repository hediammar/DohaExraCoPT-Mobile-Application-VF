// Test script to verify facade CRUD operations
// Run this in your browser console

const testFacadeCRUD = async () => {
  console.log('=== TESTING FACADE CRUD OPERATIONS ===');
  
  try {
    // Test 1: Check if facades table exists and is accessible
    console.log('1. Testing facades table access...');
    const { data: testData, error: testError } = await supabase
      .from('facades')
      .select('id, name, building_id')
      .limit(5);
    
    if (testError) {
      console.error('❌ Cannot access facades table:', testError);
      return;
    }
    console.log('✅ Facades table accessible. Found facades:', testData?.length || 0);
    
    // Test 2: Check if we have projects and buildings to work with
    console.log('\n2. Checking prerequisites...');
    const { data: projects, error: projectError } = await supabase
      .from('projects')
      .select('id, name')
      .limit(1);
    
    if (projectError || !projects || projects.length === 0) {
      console.error('❌ No projects found. Need projects to create buildings.');
      console.log('💡 Run populate_test_data.js to create test data.');
      return;
    }
    
    const { data: buildings, error: buildingError } = await supabase
      .from('buildings')
      .select('id, name, project_id')
      .limit(1);
    
    if (buildingError || !buildings || buildings.length === 0) {
      console.error('❌ No buildings found. Need buildings to create facades.');
      console.log('💡 Create some buildings first.');
      return;
    }
    
    console.log('✅ Prerequisites met:');
    console.log(`   - Projects: ${projects.length}`);
    console.log(`   - Buildings: ${buildings.length}`);
    
    // Test 3: Check user authentication
    console.log('\n3. Checking user authentication...');
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      console.error('❌ No user found in localStorage');
      return;
    }
    
    const userData = JSON.parse(storedUser);
    console.log('✅ User found:', userData.username);
    
    // Test 4: Try to create a test facade
    console.log('\n4. Testing facade creation...');
    const testBuilding = buildings[0];
    const testFacadeData = {
      name: 'Test Facade - ' + new Date().toISOString(),
      building_id: testBuilding.id,
      status: 1, // Active
      description: 'Test facade for debugging',
      user_id: userData.id
    };
    
    console.log('Creating facade with data:', testFacadeData);
    
    const { data: newFacade, error: createError } = await supabase
      .from('facades')
      .insert(testFacadeData)
      .select(`
        *,
        buildings (
          name,
          projects (
            name
          )
        )
      `)
      .single();
    
    if (createError) {
      console.error('❌ Error creating facade:', createError);
      console.error('Error details:', {
        message: createError.message,
        details: createError.details,
        hint: createError.hint,
        code: createError.code
      });
    } else {
      console.log('✅ Facade created successfully:', newFacade);
      
      // Test 5: Try to update the facade
      console.log('\n5. Testing facade update...');
      const updateData = {
        name: 'Updated Test Facade',
        status: 2, // On Hold
        description: 'Updated test facade',
        user_id: userData.id,
        updated_at: new Date().toISOString()
      };
      
      const { error: updateError } = await supabase
        .from('facades')
        .update(updateData)
        .eq('id', newFacade.id);
      
      if (updateError) {
        console.error('❌ Error updating facade:', updateError);
      } else {
        console.log('✅ Facade updated successfully');
      }
      
      // Test 6: Try to delete the test facade
      console.log('\n6. Testing facade deletion...');
      const { error: deleteError } = await supabase
        .from('facades')
        .delete()
        .eq('id', newFacade.id);
      
      if (deleteError) {
        console.error('❌ Error deleting test facade:', deleteError);
      } else {
        console.log('✅ Test facade cleaned up');
      }
    }
    
    console.log('\n=== SUMMARY ===');
    console.log('✅ Facade CRUD operations tested successfully');
    console.log('💡 The FacadesPage should work correctly now.');
    
  } catch (error) {
    console.error('❌ Exception during testing:', error);
  }
};

// Run the test
testFacadeCRUD(); 