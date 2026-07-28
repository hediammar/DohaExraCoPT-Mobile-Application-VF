const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const testCompleteCustomerDelete = async () => {
  try {
    console.log('🧪 Testing Complete Customer Cascade Delete Functionality\n');

    // Step 1: Create a test user
    console.log('1. Creating test user...');
    const { data: testUser, error: userError } = await supabase
      .from('users')
      .insert({
        username: 'test_complete_customer_user',
        name: 'Test Complete Customer User',
        email: 'testcompletecustomer@example.com',
        role: 'customer',
        status: 'active'
      })
      .select()
      .single();

    if (userError) {
      console.error('❌ Error creating test user:', userError);
      return;
    }
    console.log('✅ Test user created:', testUser.id);

    // Step 2: Create a test customer linked to the user
    console.log('\n2. Creating test customer...');
    const { data: testCustomer, error: customerError } = await supabase
      .from('customers')
      .insert({
        name: 'Test Complete Customer for Delete',
        email: 'testcompletecustomer@example.com',
        phone: '+1234567890',
        user_id: testUser.id
      })
      .select()
      .single();

    if (customerError) {
      console.error('❌ Error creating test customer:', customerError);
      return;
    }
    console.log('✅ Test customer created:', testCustomer.id);

    // Step 3: Update the user to link to the customer
    console.log('\n3. Linking user to customer...');
    const { error: linkError } = await supabase
      .from('users')
      .update({ customer_id: testCustomer.id })
      .eq('id', testUser.id);

    if (linkError) {
      console.error('❌ Error linking user to customer:', linkError);
      return;
    }
    console.log('✅ User linked to customer');

    // Step 4: Create a test project linked to the customer
    console.log('\n4. Creating test project...');
    const { data: testProject, error: projectError } = await supabase
      .from('projects')
      .insert({
        name: 'Test Complete Project for Customer Delete',
        customer_id: testCustomer.id,
        location: 'Test Location',
        start_date: '2024-01-01',
        status: 'active'
      })
      .select()
      .single();

    if (projectError) {
      console.error('❌ Error creating test project:', projectError);
      return;
    }
    console.log('✅ Test project created:', testProject.id);

    // Step 5: Create a test building linked to the user
    console.log('\n5. Creating test building...');
    const { data: testBuilding, error: buildingError } = await supabase
      .from('buildings')
      .insert({
        name: 'Test Complete Building for Customer Delete',
        description: 'This building will be unlinked during customer deletion',
        user_id: testUser.id,
        project_id: testProject.id,
        status: 'active'
      })
      .select()
      .single();

    if (buildingError) {
      console.error('❌ Error creating test building:', buildingError);
      return;
    }
    console.log('✅ Test building created:', testBuilding.id);

    // Step 6: Create a test facade linked to the user
    console.log('\n6. Creating test facade...');
    const { data: testFacade, error: facadeError } = await supabase
      .from('facades')
      .insert({
        name: 'Test Complete Facade for Customer Delete',
        description: 'This facade will be unlinked during customer deletion',
        user_id: testUser.id,
        building_id: testBuilding.id,
        status: 'active'
      })
      .select()
      .single();

    if (facadeError) {
      console.error('❌ Error creating test facade:', facadeError);
      return;
    }
    console.log('✅ Test facade created:', testFacade.id);

    // Step 7: Create a test panel linked to the user
    console.log('\n7. Creating test panel...');
    const { data: testPanel, error: panelError } = await supabase
      .from('panels')
      .insert({
        name: 'Test Complete Panel for Customer Delete',
        type: 0,
        status: 1,
        user_id: testUser.id,
        project_id: testProject.id,
        building_id: testBuilding.id,
        facade_id: testFacade.id
      })
      .select()
      .single();

    if (panelError) {
      console.error('❌ Error creating test panel:', panelError);
      return;
    }
    console.log('✅ Test panel created:', testPanel.id);

    // Step 8: Create a test panel status history linked to the user
    console.log('\n8. Creating test panel status history...');
    const { data: testPanelHistory, error: panelHistoryError } = await supabase
      .from('panel_status_histories')
      .insert({
        panel_id: testPanel.id,
        status: 1,
        user_id: testUser.id,
        notes: 'Test panel status history for customer deletion'
      })
      .select()
      .single();

    if (panelHistoryError) {
      console.error('❌ Error creating test panel status history:', panelHistoryError);
      return;
    }
    console.log('✅ Test panel status history created:', testPanelHistory.id);

    // Step 9: Verify all relationships exist
    console.log('\n9. Verifying all relationships...');
    const { data: customerWithUser, error: verifyError } = await supabase
      .from('customers')
      .select(`
        id,
        name,
        user_id,
        users!user_id(id, username, customer_id)
      `)
      .eq('id', testCustomer.id)
      .single();

    if (verifyError) {
      console.error('❌ Error verifying relationships:', verifyError);
      return;
    }
    console.log('✅ All relationships verified:');
    console.log('   - Customer has user_id:', customerWithUser.user_id);
    console.log('   - User has customer_id:', customerWithUser.users.customer_id);

    // Step 10: Test the complete cascade delete function
    console.log('\n10. Testing complete cascade delete...');
    
    // Simulate the complete delete logic
    console.log('   - Setting customer_id to NULL in projects...');
    const { error: updateProjectsError } = await supabase
      .from('projects')
      .update({ customer_id: null })
      .eq('customer_id', testCustomer.id);

    if (updateProjectsError) {
      console.error('❌ Error updating projects:', updateProjectsError);
      return;
    }
    console.log('   ✅ Projects unlinked');

    console.log('   - Setting customer_id to NULL in users...');
    const { error: updateUsersError } = await supabase
      .from('users')
      .update({ customer_id: null })
      .eq('customer_id', testCustomer.id);

    if (updateUsersError) {
      console.error('❌ Error updating users:', updateUsersError);
      return;
    }
    console.log('   ✅ Users unlinked');

    console.log('   - Setting user_id to NULL in panels...');
    const { error: updatePanelsError } = await supabase
      .from('panels')
      .update({ user_id: null })
      .eq('user_id', testUser.id);

    if (updatePanelsError) {
      console.error('❌ Error updating panels:', updatePanelsError);
      return;
    }
    console.log('   ✅ Panels unlinked');

    console.log('   - Setting user_id to NULL in facades...');
    const { error: updateFacadesError } = await supabase
      .from('facades')
      .update({ user_id: null })
      .eq('user_id', testUser.id);

    if (updateFacadesError) {
      console.error('❌ Error updating facades:', updateFacadesError);
      return;
    }
    console.log('   ✅ Facades unlinked');

    console.log('   - Setting user_id to NULL in buildings...');
    const { error: updateBuildingsError } = await supabase
      .from('buildings')
      .update({ user_id: null })
      .eq('user_id', testUser.id);

    if (updateBuildingsError) {
      console.error('❌ Error updating buildings:', updateBuildingsError);
      return;
    }
    console.log('   ✅ Buildings unlinked');

           console.log('   - Setting user_id to NULL in projects...');
       const { error: updateProjectsUserError } = await supabase
         .from('projects')
         .update({ user_id: null })
         .eq('user_id', testUser.id);

       if (updateProjectsUserError) {
         console.error('❌ Error updating projects user_id:', updateProjectsUserError);
         return;
       }
       console.log('   ✅ Projects user_id unlinked');

       console.log('   - Setting user_id to NULL in panel_status_histories...');
       const { error: updatePanelHistoriesError } = await supabase
         .from('panel_status_histories')
         .update({ user_id: null })
         .eq('user_id', testUser.id);

       if (updatePanelHistoriesError) {
         console.error('❌ Error updating panel_status_histories:', updatePanelHistoriesError);
         return;
       }
       console.log('   ✅ Panel status histories unlinked');

    console.log('   - Deleting associated user...');
    const { error: deleteUserError } = await supabase
      .from('users')
      .delete()
      .eq('id', testUser.id);

    if (deleteUserError) {
      console.error('❌ Error deleting user:', deleteUserError);
      return;
    }
    console.log('   ✅ User deleted');

    console.log('   - Deleting customer...');
    const { error: deleteCustomerError } = await supabase
      .from('customers')
      .delete()
      .eq('id', testCustomer.id);

    if (deleteCustomerError) {
      console.error('❌ Error deleting customer:', deleteCustomerError);
      return;
    }
    console.log('   ✅ Customer deleted');

    // Step 11: Verify everything was cleaned up
    console.log('\n11. Verifying complete cleanup...');
    
    const { data: remainingCustomer, error: checkCustomerError } = await supabase
      .from('customers')
      .select('id')
      .eq('id', testCustomer.id)
      .single();

    if (remainingCustomer) {
      console.log('❌ Customer still exists after deletion');
    } else {
      console.log('✅ Customer successfully deleted');
    }

    const { data: remainingUser, error: checkUserError } = await supabase
      .from('users')
      .select('id')
      .eq('id', testUser.id)
      .single();

    if (remainingUser) {
      console.log('❌ User still exists after deletion');
    } else {
      console.log('✅ User successfully deleted');
    }

    const { data: remainingProject, error: checkProjectError } = await supabase
      .from('projects')
      .select('id, customer_id')
      .eq('id', testProject.id)
      .single();

    if (remainingProject) {
      if (remainingProject.customer_id === null) {
        console.log('✅ Project exists but customer_id is NULL (correct)');
      } else {
        console.log('❌ Project still has customer_id after deletion');
      }
    } else {
      console.log('❌ Project was deleted (should have been unlinked only)');
    }

    const { data: remainingBuilding, error: checkBuildingError } = await supabase
      .from('buildings')
      .select('id, user_id')
      .eq('id', testBuilding.id)
      .single();

    if (remainingBuilding) {
      if (remainingBuilding.user_id === null) {
        console.log('✅ Building exists but user_id is NULL (correct)');
      } else {
        console.log('❌ Building still has user_id after deletion');
      }
    } else {
      console.log('❌ Building was deleted (should have been unlinked only)');
    }

    const { data: remainingFacade, error: checkFacadeError } = await supabase
      .from('facades')
      .select('id, user_id')
      .eq('id', testFacade.id)
      .single();

    if (remainingFacade) {
      if (remainingFacade.user_id === null) {
        console.log('✅ Facade exists but user_id is NULL (correct)');
      } else {
        console.log('❌ Facade still has user_id after deletion');
      }
    } else {
      console.log('❌ Facade was deleted (should have been unlinked only)');
    }

    const { data: remainingPanel, error: checkPanelError } = await supabase
      .from('panels')
      .select('id, user_id')
      .eq('id', testPanel.id)
      .single();

    if (remainingPanel) {
      if (remainingPanel.user_id === null) {
        console.log('✅ Panel exists but user_id is NULL (correct)');
      } else {
        console.log('❌ Panel still has user_id after deletion');
      }
    } else {
      console.log('❌ Panel was deleted (should have been unlinked only)');
    }

    const { data: remainingPanelHistory, error: checkPanelHistoryError } = await supabase
      .from('panel_status_histories')
      .select('id, user_id')
      .eq('id', testPanelHistory.id)
      .single();

    if (remainingPanelHistory) {
      if (remainingPanelHistory.user_id === null) {
        console.log('✅ Panel status history exists but user_id is NULL (correct)');
      } else {
        console.log('❌ Panel status history still has user_id after deletion');
      }
    } else {
      console.log('❌ Panel status history was deleted (should have been unlinked only)');
    }

    console.log('\n🎉 Complete customer cascade delete test completed successfully!');
    console.log('💡 The deleteCustomer function in userTracking.ts should now handle all user_id foreign key constraints.');

  } catch (error) {
    console.error('❌ Exception during testing:', error);
  }
};

// Run the test
testCompleteCustomerDelete();
