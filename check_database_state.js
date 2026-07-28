// Script to check the current state of the database
// Run this in your browser console to see what data exists

const checkDatabaseState = async () => {
  console.log('=== CHECKING DATABASE STATE ===');
  
  try {
    // Check customers table
    console.log('1. Checking customers table...');
    const { data: customers, error: customerError } = await supabase
      .from('customers')
      .select('*')
      .order('name');
    
    if (customerError) {
      console.error('❌ Error fetching customers:', customerError);
    } else {
      console.log(`✅ Found ${customers?.length || 0} customers:`, customers?.map(c => c.name) || []);
    }

    // Check projects table
    console.log('\n2. Checking projects table...');
    const { data: projects, error: projectError } = await supabase
      .from('projects')
      .select(`
        id,
        name,
        customer_id,
        customers (name)
      `)
      .order('name');
    
    if (projectError) {
      console.error('❌ Error fetching projects:', projectError);
    } else {
      console.log(`✅ Found ${projects?.length || 0} projects:`, projects?.map(p => `${p.name} (${p.customers?.name || 'No customer'})`) || []);
    }

    // Check buildings table
    console.log('\n3. Checking buildings table...');
    const { data: buildings, error: buildingError } = await supabase
      .from('buildings')
      .select('*')
      .order('name');
    
    if (buildingError) {
      console.error('❌ Error fetching buildings:', buildingError);
    } else {
      console.log(`✅ Found ${buildings?.length || 0} buildings:`, buildings?.map(b => b.name) || []);
    }

    // Check users table
    console.log('\n4. Checking users table...');
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, username, email, role')
      .order('username');
    
    if (userError) {
      console.error('❌ Error fetching users:', userError);
    } else {
      console.log(`✅ Found ${users?.length || 0} users:`, users?.map(u => `${u.username} (${u.role})`) || []);
    }

    // Summary
    console.log('\n=== SUMMARY ===');
    console.log(`📊 Customers: ${customers?.length || 0}`);
    console.log(`📊 Projects: ${projects?.length || 0}`);
    console.log(`📊 Buildings: ${buildings?.length || 0}`);
    console.log(`📊 Users: ${users?.length || 0}`);

    if (projects?.length === 0) {
      console.log('\n⚠️ No projects found! This is why the BuildingModal shows no projects.');
      console.log('💡 Run the populate_test_data.js script to create test projects.');
    } else {
      console.log('\n✅ Projects exist in database. BuildingModal should work correctly.');
    }

  } catch (error) {
    console.error('❌ Exception during database check:', error);
  }
};

// Run the check
checkDatabaseState(); 