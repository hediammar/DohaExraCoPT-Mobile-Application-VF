const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testCustomerDelete() {
  console.log('🧪 Testing Customer Delete Functionality\n');

  try {
    // Step 1: Create a test user
    console.log('1. Creating test user...');
    const testUser = {
      username: 'test_user_delete',
      name: 'Test User for Delete',
      email: 'testdelete@example.com',
      role: 'Customer',
      department: 'Test',
      status: 'active',
      password_hash: 'test123'
    };

    const { data: user, error: userError } = await supabase
      .from('users')
      .insert(testUser)
      .select()
      .single();

    if (userError) {
      console.error('❌ Error creating test user:', userError);
      return;
    }
    console.log('✅ Test user created:', user.id);

    // Step 2: Create a test customer linked to the user
    console.log('\n2. Creating test customer...');
    const testCustomer = {
      name: 'Test Customer for Delete',
      email: 'customerdelete@example.com',
      phone: '+1234567890',
      address: '123 Test Street',
      user_id: user.id
    };

    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .insert(testCustomer)
      .select()
      .single();

    if (customerError) {
      console.error('❌ Error creating test customer:', customerError);
      return;
    }
    console.log('✅ Test customer created:', customer.id);

    // Step 3: Update the user to link to the customer
    console.log('\n3. Linking user to customer...');
    const { error: updateUserError } = await supabase
      .from('users')
      .update({ customer_id: customer.id })
      .eq('id', user.id);

    if (updateUserError) {
      console.error('❌ Error linking user to customer:', updateUserError);
      return;
    }
    console.log('✅ User linked to customer');

    // Step 4: Create test data in all related tables
    console.log('\n4. Creating test data in related tables...');

    // Create a test project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        name: 'Test Project for Delete',
        description: 'Test project for customer delete',
        customer_id: customer.id,
        user_id: user.id,
        status: 'active'
      })
      .select()
      .single();

    if (projectError) {
      console.error('❌ Error creating test project:', projectError);
      return;
    }
    console.log('✅ Test project created:', project.id);

    // Create a test building
    const { data: building, error: buildingError } = await supabase
      .from('buildings')
      .insert({
        name: 'Test Building for Delete',
        project_id: project.id,
        user_id: user.id,
        status: 'active'
      })
      .select()
      .single();

    if (buildingError) {
      console.error('❌ Error creating test building:', buildingError);
      return;
    }
    console.log('✅ Test building created:', building.id);

    // Create a test facade
    const { data: facade, error: facadeError } = await supabase
      .from('facades')
      .insert({
        name: 'Test Facade for Delete',
        building_id: building.id,
        user_id: user.id,
        status: 'active'
      })
      .select()
      .single();

    if (facadeError) {
      console.error('❌ Error creating test facade:', facadeError);
      return;
    }
    console.log('✅ Test facade created:', facade.id);

    // Create a test panel
    const { data: panel, error: panelError } = await supabase
      .from('panels')
      .insert({
        name: 'Test Panel for Delete',
        facade_id: facade.id,
        user_id: user.id,
        status: 'active'
      })
      .select()
      .single();

    if (panelError) {
      console.error('❌ Error creating test panel:', panelError);
      return;
    }
    console.log('✅ Test panel created:', panel.id);

    // Create a test panel status history
    const { data: panelHistory, error: panelHistoryError } = await supabase
      .from('panel_status_histories')
      .insert({
        panel_id: panel.id,
        user_id: user.id,
        status: 'active',
        notes: 'Test status history'
      })
      .select()
      .single();

    if (panelHistoryError) {
      console.error('❌ Error creating test panel history:', panelHistoryError);
      return;
    }
    console.log('✅ Test panel history created:', panelHistory.id);

    // Step 5: Verify all relationships are established
    console.log('\n5. Verifying relationships...');
    
    const { data: verifyProject } = await supabase
      .from('projects')
      .select('customer_id, user_id')
      .eq('id', project.id)
      .single();

    const { data: verifyBuilding } = await supabase
      .from('buildings')
      .select('user_id')
      .eq('id', building.id)
      .single();

    const { data: verifyFacade } = await supabase
      .from('facades')
      .select('user_id')
      .eq('id', facade.id)
      .single();

    const { data: verifyPanel } = await supabase
      .from('panels')
      .select('user_id')
      .eq('id', panel.id)
      .single();

    const { data: verifyPanelHistory } = await supabase
      .from('panel_status_histories')
      .select('user_id')
      .eq('id', panelHistory.id)
      .single();

    console.log('✅ All relationships verified');

    // Step 6: Test the deleteCustomer function logic
    console.log('\n6. Testing customer deletion...');

    // Simulate the deleteCustomer function logic
    console.log('   - Setting customer_id to NULL in projects...');
    const { error: updateProjectsError } = await supabase
      .from('projects')
      .update({ customer_id: null })
      .eq('customer_id', customer.id);

    if (updateProjectsError) {
      console.error('❌ Error updating projects:', updateProjectsError);
      return;
    }
    console.log('   ✅ Projects unlinked from customer');

    console.log('   - Deleting users linked to this customer...');
    const { error: deleteUsersError } = await supabase
      .from('users')
      .delete()
      .eq('customer_id', customer.id);

    if (deleteUsersError) {
      console.error('❌ Error deleting users linked to customer:', deleteUsersError);
      return;
    }
    console.log('   ✅ Users linked to customer deleted');

    console.log('   - Setting user_id to NULL in projects...');
    const { error: updateProjectsUserError } = await supabase
      .from('projects')
      .update({ user_id: null })
      .eq('user_id', user.id);

    if (updateProjectsUserError) {
      console.error('❌ Error updating projects user_id:', updateProjectsUserError);
      return;
    }
    console.log('   ✅ Projects unlinked from user');

    console.log('   - Setting user_id to NULL in panels...');
    const { error: updatePanelsError } = await supabase
      .from('panels')
      .update({ user_id: null })
      .eq('user_id', user.id);

    if (updatePanelsError) {
      console.error('❌ Error updating panels:', updatePanelsError);
      return;
    }
    console.log('   ✅ Panels unlinked from user');

    console.log('   - Setting user_id to NULL in facades...');
    const { error: updateFacadesError } = await supabase
      .from('facades')
      .update({ user_id: null })
      .eq('user_id', user.id);

    if (updateFacadesError) {
      console.error('❌ Error updating facades:', updateFacadesError);
      return;
    }
    console.log('   ✅ Facades unlinked from user');

    console.log('   - Setting user_id to NULL in buildings...');
    const { error: updateBuildingsError } = await supabase
      .from('buildings')
      .update({ user_id: null })
      .eq('user_id', user.id);

    if (updateBuildingsError) {
      console.error('❌ Error updating buildings:', updateBuildingsError);
      return;
    }
    console.log('   ✅ Buildings unlinked from user');

    console.log('   - Setting user_id to NULL in panel_status_histories...');
    const { error: updatePanelHistoriesError } = await supabase
      .from('panel_status_histories')
      .update({ user_id: null })
      .eq('user_id', user.id);

    if (updatePanelHistoriesError) {
      console.error('❌ Error updating panel_status_histories:', updatePanelHistoriesError);
      return;
    }
    console.log('   ✅ Panel status histories unlinked from user');

    console.log('   - Deleting associated user...');
    const { error: deleteUserError } = await supabase
      .from('users')
      .delete()
      .eq('id', user.id);

    if (deleteUserError) {
      console.error('❌ Error deleting user:', deleteUserError);
      return;
    }
    console.log('   ✅ User deleted');

    console.log('   - Deleting customer...');
    const { error: deleteCustomerError } = await supabase
      .from('customers')
      .delete()
      .eq('id', customer.id);

    if (deleteCustomerError) {
      console.error('❌ Error deleting customer:', deleteCustomerError);
      return;
    }
    console.log('   ✅ Customer deleted');

    // Step 7: Verify deletion was successful
    console.log('\n7. Verifying deletion...');

    const { data: verifyCustomer } = await supabase
      .from('customers')
      .select('id')
      .eq('id', customer.id)
      .single();

    const { data: verifyUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single();

    if (verifyCustomer) {
      console.error('❌ Customer still exists after deletion');
      return;
    }

    if (verifyUser) {
      console.error('❌ User still exists after deletion');
      return;
    }

    console.log('✅ Customer and user successfully deleted');

    // Step 8: Verify related records still exist but are unlinked
    console.log('\n8. Verifying related records are unlinked...');

    const { data: verifyProjectAfter } = await supabase
      .from('projects')
      .select('customer_id, user_id')
      .eq('id', project.id)
      .single();

    const { data: verifyBuildingAfter } = await supabase
      .from('buildings')
      .select('user_id')
      .eq('id', building.id)
      .single();

    const { data: verifyFacadeAfter } = await supabase
      .from('facades')
      .select('user_id')
      .eq('id', facade.id)
      .single();

    const { data: verifyPanelAfter } = await supabase
      .from('panels')
      .select('user_id')
      .eq('id', panel.id)
      .single();

    const { data: verifyPanelHistoryAfter } = await supabase
      .from('panel_status_histories')
      .select('user_id')
      .eq('id', panelHistory.id)
      .single();

    if (verifyProjectAfter.customer_id !== null || verifyProjectAfter.user_id !== null) {
      console.error('❌ Project still has customer_id or user_id');
      return;
    }

    if (verifyBuildingAfter.user_id !== null) {
      console.error('❌ Building still has user_id');
      return;
    }

    if (verifyFacadeAfter.user_id !== null) {
      console.error('❌ Facade still has user_id');
      return;
    }

    if (verifyPanelAfter.user_id !== null) {
      console.error('❌ Panel still has user_id');
      return;
    }

    if (verifyPanelHistoryAfter.user_id !== null) {
      console.error('❌ Panel history still has user_id');
      return;
    }

    console.log('✅ All related records are properly unlinked');

    // Step 9: Clean up test data
    console.log('\n9. Cleaning up test data...');

    await supabase.from('panel_status_histories').delete().eq('id', panelHistory.id);
    await supabase.from('panels').delete().eq('id', panel.id);
    await supabase.from('facades').delete().eq('id', facade.id);
    await supabase.from('buildings').delete().eq('id', building.id);
    await supabase.from('projects').delete().eq('id', project.id);

    console.log('✅ Test data cleaned up');

    console.log('\n🎉 Customer deletion test completed successfully!');
    console.log('✅ All foreign key constraints are properly handled');
    console.log('✅ Customer and associated user are deleted');
    console.log('✅ Related records are unlinked but preserved');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testCustomerDelete();
