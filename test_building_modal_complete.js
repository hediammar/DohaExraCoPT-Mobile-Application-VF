// Comprehensive test to identify BuildingModal issues
// Run this in your browser console

const testBuildingModalComplete = async () => {
  console.log('=== COMPREHENSIVE BUILDING MODAL TEST ===');
  
  try {
    // Test 1: Check if we're connected to the right Supabase instance
    console.log('1. Checking Supabase connection...');
    console.log('Supabase URL:', supabase.supabaseUrl);
    console.log('Supabase Key:', supabase.supabaseKey ? 'Present' : 'Missing');
    
    // Test 2: Check if projects table exists
    console.log('\n2. Testing projects table...');
    const { data: testData, error: testError } = await supabase
      .from('projects')
      .select('id')
      .limit(1);
    
    if (testError) {
      console.error('❌ Cannot access projects table:', testError);
      console.log('💡 This might be a database schema issue.');
      return;
    }
    console.log('✅ Projects table accessible');
    
    // Test 3: Fetch all projects
    console.log('\n3. Fetching all projects...');
    const { data: projects, error: projectError } = await supabase
      .from('projects')
      .select(`
        id, 
        name, 
        customers (name)
      `)
      .order('name');
    
    if (projectError) {
      console.error('❌ Error fetching projects:', projectError);
      return;
    }
    
    console.log(`✅ Found ${projects?.length || 0} projects in database`);
    
    if (!projects || projects.length === 0) {
      console.log('\n⚠️ DATABASE IS EMPTY!');
      console.log('💡 This is why you\'re seeing static data.');
      console.log('💡 Run populate_test_data.js to create test projects.');
      return;
    }
    
    // Test 4: Show what projects exist
    console.log('\n4. Projects in database:');
    projects.forEach((project, index) => {
      console.log(`${index + 1}. ${project.name} (${project.customers?.name || 'No customer'})`);
    });
    
    // Test 5: Transform data like BuildingModal does
    console.log('\n5. Testing data transformation...');
    const transformedProjects = projects?.map((project: any) => ({
      id: project.id,
      name: project.name,
      customer: project.customers?.name || ''
    })) || [];
    
    console.log('✅ Transformed projects:', transformedProjects);
    
    // Test 6: Check if the static names match any database projects
    const staticNames = [
      'Qatar National Convention Centre',
      'Doha Sports Complex', 
      'Al Rayyan Stadium',
      'Lusail Towers'
    ];
    
    console.log('\n6. Checking for static names in database...');
    const foundStaticNames = staticNames.filter(staticName => 
      transformedProjects.some(project => project.name.includes(staticName))
    );
    
    if (foundStaticNames.length > 0) {
      console.log('⚠️ Found static names in database:', foundStaticNames);
    } else {
      console.log('✅ No static names found in database');
      console.log('💡 The static names you see are NOT from the database.');
    }
    
    // Test 7: Recommendations
    console.log('\n=== RECOMMENDATIONS ===');
    if (projects.length === 0) {
      console.log('1. Run populate_test_data.js to create test projects');
      console.log('2. Clear browser cache and refresh the page');
      console.log('3. Check if you\'re connected to the right database');
    } else {
      console.log('1. Database has projects - check browser console for BuildingModal logs');
      console.log('2. Clear browser cache and refresh the page');
      console.log('3. Check if there are any JavaScript errors in the console');
    }
    
  } catch (error) {
    console.error('❌ Exception during testing:', error);
  }
};

// Run the comprehensive test
testBuildingModalComplete(); 