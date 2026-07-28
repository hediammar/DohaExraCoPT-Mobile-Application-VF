// Debug script to check BuildingModal project fetching
// Run this in your browser console to see what's happening

const debugBuildingModal = async () => {
  console.log('=== DEBUGGING BUILDING MODAL PROJECT FETCH ===');
  
  try {
    // Test 1: Check if projects table exists and has data
    console.log('1. Testing projects table access...');
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
    
    console.log('✅ Projects fetched successfully:', projects?.length || 0);
    console.log('Projects data:', projects);
    
    if (!projects || projects.length === 0) {
      console.log('⚠️ No projects found in database!');
      console.log('💡 This is why the BuildingModal shows no projects.');
      console.log('💡 Run populate_test_data.js to create test projects.');
      return;
    }
    
    // Test 2: Transform the data like BuildingModal does
    console.log('\n2. Testing data transformation...');
    const transformedProjects = projects?.map((project: any) => ({
      id: project.id,
      name: project.name,
      customer: project.customers?.name || ''
    })) || [];
    
    console.log('✅ Transformed projects:', transformedProjects);
    
    // Test 3: Check if any projects have customer info
    const projectsWithCustomers = transformedProjects.filter(p => p.customer);
    console.log(`✅ Projects with customer info: ${projectsWithCustomers.length}/${transformedProjects.length}`);
    
    // Test 4: Simulate what the dropdown should show
    console.log('\n3. What the dropdown should show:');
    transformedProjects.forEach((project, index) => {
      console.log(`${index + 1}. ${project.name} ${project.customer ? `- ${project.customer}` : ''}`);
    });
    
    if (transformedProjects.length > 0) {
      console.log('\n✅ Database has projects. BuildingModal should work correctly.');
      console.log('💡 If you\'re still seeing static data, check the browser console for BuildingModal logs.');
    }
    
  } catch (error) {
    console.error('❌ Exception during debugging:', error);
  }
};

// Run the debug script
debugBuildingModal(); 