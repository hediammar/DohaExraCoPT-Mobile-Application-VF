// Debug script to help identify the cause of 409 errors when creating projects
// Run this in your browser console to test project creation

const debugProjectCreation = async () => {
  console.log('=== PROJECT CREATION DEBUG ===');
  
  // Test 1: Check if projects table exists and is accessible
  console.log('1. Testing projects table access...');
  try {
    const { data: testData, error: testError } = await supabase
      .from('projects')
      .select('id, name, customer_id')
      .limit(5);
    
    if (testError) {
      console.error('❌ Cannot access projects table:', testError);
      return;
    }
    console.log('✅ Projects table accessible. Found projects:', testData?.length || 0);
  } catch (error) {
    console.error('❌ Error testing projects table:', error);
    return;
  }
  
  // Test 2: Check existing project names
  console.log('\n2. Checking existing project names...');
  try {
    const { data: projects, error } = await supabase
      .from('projects')
      .select('id, name, customer_id')
      .order('name');
    
    if (error) {
      console.error('❌ Error fetching projects:', error);
    } else {
      console.log('✅ Existing projects:', projects?.map(p => p.name) || []);
    }
  } catch (error) {
    console.error('❌ Error checking existing projects:', error);
  }
  
  // Test 3: Check customers table
  console.log('\n3. Checking customers table...');
  try {
    const { data: customers, error } = await supabase
      .from('customers')
      .select('id, name')
      .limit(5);
    
    if (error) {
      console.error('❌ Error fetching customers:', error);
    } else {
      console.log('✅ Available customers:', customers?.map(c => ({ id: c.id, name: c.name })) || []);
    }
  } catch (error) {
    console.error('❌ Error checking customers:', error);
  }
  
  // Test 4: Try to create a test project
  console.log('\n4. Testing project creation...');
  const testProjectData = {
    id: crypto.randomUUID(),
    name: `TEST_PROJECT_${Date.now()}`,
    customer_id: null, // Will be set if customers exist
    location: 'Test Location',
    start_date: new Date().toISOString().split('T')[0],
    status: 'active',
    estimated_cost: 1000,
    estimated_panels: 10
  };
  
  // Get first customer if available
  try {
    const { data: firstCustomer } = await supabase
      .from('customers')
      .select('id')
      .limit(1)
      .single();
    
    if (firstCustomer) {
      testProjectData.customer_id = firstCustomer.id;
      console.log('✅ Using customer ID:', firstCustomer.id);
    } else {
      console.log('⚠️ No customers found, using null customer_id');
    }
  } catch (error) {
    console.log('⚠️ Could not get customer, using null customer_id');
  }
  
  console.log('Test project data:', testProjectData);
  
  try {
    const { data: result, error } = await supabase
      .from('projects')
      .insert(testProjectData)
      .select()
      .single();
    
    if (error) {
      console.error('❌ Error creating test project:', error);
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
    } else {
      console.log('✅ Test project created successfully:', result);
      
      // Clean up the test project
      try {
        await supabase
          .from('projects')
          .delete()
          .eq('id', result.id);
        console.log('✅ Test project cleaned up');
      } catch (cleanupError) {
        console.error('⚠️ Could not clean up test project:', cleanupError);
      }
    }
  } catch (error) {
    console.error('❌ Exception during test project creation:', error);
  }
  
  console.log('\n=== DEBUG COMPLETE ===');
  console.log('Check the console output above for any issues.');
  console.log('If you see a 409 error, it indicates a unique constraint violation.');
  console.log('Common causes:');
  console.log('- Project name already exists');
  console.log('- ID conflict (if ID is not auto-generated)');
  console.log('- Customer-project combination constraint');
};

// Run the debug function
debugProjectCreation(); 