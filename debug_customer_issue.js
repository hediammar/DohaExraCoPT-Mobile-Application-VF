// Debug script for customer-related 409 errors
// Run this in your browser console to identify customer issues

const debugCustomerIssue = async () => {
  console.log('=== CUSTOMER ISSUE DEBUG ===');
  
  // Test 1: Check if customers table exists and is accessible
  console.log('1. Testing customers table access...');
  try {
    const { data: testData, error: testError } = await supabase
      .from('customers')
      .select('id, name, email')
      .limit(5);
    
    if (testError) {
      console.error('❌ Cannot access customers table:', testError);
      return;
    }
    console.log('✅ Customers table accessible. Found customers:', testData?.length || 0);
    console.log('Available customers:', testData);
  } catch (error) {
    console.error('❌ Error testing customers table:', error);
    return;
  }
  
  // Test 2: Check if there are any customers at all
  console.log('\n2. Checking for existing customers...');
  try {
    const { data: customers, error } = await supabase
      .from('customers')
      .select('id, name, email')
      .order('name');
    
    if (error) {
      console.error('❌ Error fetching customers:', error);
    } else {
      console.log('✅ All customers:', customers);
      if (customers.length === 0) {
        console.log('⚠️ WARNING: No customers found in the database!');
        console.log('You need to create at least one customer before creating projects.');
      }
    }
  } catch (error) {
    console.error('❌ Error checking customers:', error);
  }
  
  // Test 3: Check current user and their customer_id
  console.log('\n3. Checking current user...');
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error('❌ Error getting current user:', error);
    } else {
      console.log('✅ Current user:', user);
      console.log('User customer_id:', user?.user_metadata?.customer_id);
    }
  } catch (error) {
    console.error('❌ Error checking current user:', error);
  }
  
  // Test 4: Try to create a test customer if none exist
  console.log('\n4. Testing customer creation...');
  try {
    const { data: existingCustomers } = await supabase
      .from('customers')
      .select('id')
      .limit(1);
    
    if (!existingCustomers || existingCustomers.length === 0) {
      console.log('No customers found. Creating a test customer...');
      
      const testCustomerData = {
        id: crypto.randomUUID(),
        name: 'Test Customer',
        email: 'test@example.com',
        phone: '+1234567890'
      };
      
      const { data: newCustomer, error: createError } = await supabase
        .from('customers')
        .insert(testCustomerData)
        .select()
        .single();
      
      if (createError) {
        console.error('❌ Error creating test customer:', createError);
      } else {
        console.log('✅ Test customer created:', newCustomer);
        
        // Now try to create a project with this customer
        console.log('\n5. Testing project creation with new customer...');
        const testProjectData = {
          id: crypto.randomUUID(),
          name: `TEST_PROJECT_${Date.now()}`,
          customer_id: newCustomer.id,
          location: 'Test Location',
          start_date: new Date().toISOString().split('T')[0],
          status: 'active',
          estimated_cost: 1000,
          estimated_panels: 10
        };
        
        const { data: newProject, error: projectError } = await supabase
          .from('projects')
          .insert(testProjectData)
          .select()
          .single();
        
        if (projectError) {
          console.error('❌ Error creating test project:', projectError);
          console.error('Project error details:', {
            message: projectError.message,
            details: projectError.details,
            hint: projectError.hint,
            code: projectError.code
          });
        } else {
          console.log('✅ Test project created successfully:', newProject);
          
          // Clean up test data
          try {
            await supabase.from('projects').delete().eq('id', newProject.id);
            await supabase.from('customers').delete().eq('id', newCustomer.id);
            console.log('✅ Test data cleaned up');
          } catch (cleanupError) {
            console.error('⚠️ Could not clean up test data:', cleanupError);
          }
        }
      }
    } else {
      console.log('✅ Customers exist, skipping test customer creation');
    }
  } catch (error) {
    console.error('❌ Exception during customer/project testing:', error);
  }
  
  console.log('\n=== DEBUG COMPLETE ===');
  console.log('If you see "No customers found", you need to create customers first.');
  console.log('If you see a 409 error, check the specific error details above.');
  console.log('Make sure the customer_id you\'re using exists in the customers table.');
};

// Run the debug function
debugCustomerIssue(); 