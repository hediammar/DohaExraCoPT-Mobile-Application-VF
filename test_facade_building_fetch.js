// Test script to verify building fetching for FacadeModal
// Run this in your browser console

const testFacadeBuildingFetch = async () => {
  console.log('=== TESTING FACADE BUILDING FETCH ===');
  
  try {
    // Test 1: Check if buildings table exists and has data
    console.log('1. Testing buildings table access...');
    const { data: buildings, error: buildingError } = await supabase
      .from('buildings')
      .select('id, name, project_id')
      .order('name');
    
    if (buildingError) {
      console.error('❌ Cannot access buildings table:', buildingError);
      return;
    }
    console.log('✅ Buildings table accessible. Found buildings:', buildings?.length || 0);
    
    if (!buildings || buildings.length === 0) {
      console.log('⚠️ No buildings found in database!');
      console.log('💡 You need to create buildings first before creating facades.');
      return;
    }
    
    // Test 2: Show all buildings
    console.log('\n2. All buildings in database:');
    buildings.forEach((building, index) => {
      console.log(`${index + 1}. ${building.name} (Project ID: ${building.project_id})`);
    });
    
    // Test 3: Check projects to understand the relationship
    console.log('\n3. Checking projects...');
    const { data: projects, error: projectError } = await supabase
      .from('projects')
      .select('id, name')
      .order('name');
    
    if (projectError) {
      console.error('❌ Error fetching projects:', projectError);
    } else {
      console.log('✅ Projects found:', projects?.length || 0);
      projects?.forEach((project, index) => {
        const projectBuildings = buildings.filter(b => b.project_id === project.id);
        console.log(`${index + 1}. ${project.name} - ${projectBuildings.length} buildings`);
      });
    }
    
    // Test 4: Test building filtering by project
    console.log('\n4. Testing building filtering by project...');
    if (projects && projects.length > 0) {
      const testProject = projects[0];
      console.log(`Testing with project: ${testProject.name} (${testProject.id})`);
      
      const { data: filteredBuildings, error: filterError } = await supabase
        .from('buildings')
        .select('id, name, project_id')
        .eq('project_id', testProject.id)
        .order('name');
      
      if (filterError) {
        console.error('❌ Error filtering buildings by project:', filterError);
      } else {
        console.log(`✅ Found ${filteredBuildings?.length || 0} buildings for project "${testProject.name}":`);
        filteredBuildings?.forEach((building, index) => {
          console.log(`   ${index + 1}. ${building.name}`);
        });
      }
    }
    
    // Test 5: Simulate FacadeModal building filtering logic
    console.log('\n5. Testing FacadeModal building filtering logic...');
    const simulateFacadeModalFiltering = (allBuildings, projectId = null) => {
      if (projectId) {
        return allBuildings.filter(building => building.project_id === projectId);
      }
      return allBuildings;
    };
    
    // Test with no project filter
    const allAvailableBuildings = simulateFacadeModalFiltering(buildings);
    console.log(`✅ All available buildings (no filter): ${allAvailableBuildings.length}`);
    
    // Test with project filter
    if (projects && projects.length > 0) {
      const testProject = projects[0];
      const filteredByProject = simulateFacadeModalFiltering(buildings, testProject.id);
      console.log(`✅ Buildings filtered by project "${testProject.name}": ${filteredByProject.length}`);
    }
    
    console.log('\n=== SUMMARY ===');
    console.log(`📊 Total buildings: ${buildings.length}`);
    console.log(`📊 Total projects: ${projects?.length || 0}`);
    console.log('✅ Building fetching should work correctly in FacadeModal');
    console.log('💡 Check the browser console when opening the FacadeModal to see detailed logs.');
    
  } catch (error) {
    console.error('❌ Exception during testing:', error);
  }
};

// Run the test
testFacadeBuildingFetch(); 