// Script to populate the database with test data
// Run this in your browser console to create test projects and customers

const populateTestData = async () => {
  console.log('=== POPULATING TEST DATA ===');
  
  try {
    // Step 1: Create test customers
    console.log('1. Creating test customers...');
    const customers = [
      {
        name: 'Al Rayyan Construction',
        email: 'contact@alrayyan.qa',
        phone: '+974 4444 5555',
        address: 'Doha, Qatar',
        status: 'active'
      },
      {
        name: 'Qatar Building Solutions',
        email: 'info@qbs.qa',
        phone: '+974 4444 6666',
        address: 'Al Wakrah, Qatar',
        status: 'active'
      },
      {
        name: 'Doha Development Corp',
        email: 'projects@ddc.qa',
        phone: '+974 4444 7777',
        address: 'West Bay, Qatar',
        status: 'active'
      }
    ];

    const createdCustomers = [];
    for (const customer of customers) {
      const { data: newCustomer, error } = await supabase
        .from('customers')
        .insert(customer)
        .select()
        .single();
      
      if (error) {
        console.error('❌ Error creating customer:', customer.name, error);
      } else {
        console.log('✅ Created customer:', newCustomer.name);
        createdCustomers.push(newCustomer);
      }
    }

    if (createdCustomers.length === 0) {
      console.log('⚠️ No customers created. Check if customers table exists.');
      return;
    }

    // Step 2: Create test projects
    console.log('\n2. Creating test projects...');
    const projects = [
      {
        name: 'Al Rayyan Sports Complex',
        customer_id: createdCustomers[0].id,
        location: 'Al Rayyan, Qatar',
        start_date: '2024-01-15',
        end_date: '2024-08-30',
        status: 'active',
        estimated_cost: 1200000,
        estimated_panels: 450,
        description: 'A state-of-the-art sports complex featuring multiple athletic facilities.'
      },
      {
        name: 'Doha Marina Towers',
        customer_id: createdCustomers[1].id,
        location: 'West Bay, Doha',
        start_date: '2024-02-01',
        end_date: '2024-12-15',
        status: 'active',
        estimated_cost: 2800000,
        estimated_panels: 820,
        description: 'Luxury residential towers overlooking the marina.'
      },
      {
        name: 'Qatar Education Hub',
        customer_id: createdCustomers[2].id,
        location: 'Education City, Qatar',
        start_date: '2024-03-10',
        end_date: '2024-11-20',
        status: 'on-hold',
        estimated_cost: 1850000,
        estimated_panels: 680,
        description: 'Modern educational facility housing multiple schools.'
      },
      {
        name: 'Al Wakrah Shopping Center',
        customer_id: createdCustomers[1].id,
        location: 'Al Wakrah, Qatar',
        start_date: '2024-01-20',
        end_date: '2024-07-10',
        status: 'completed',
        estimated_cost: 950000,
        estimated_panels: 320,
        description: 'Regional shopping center featuring retail stores.'
      }
    ];

    const createdProjects = [];
    for (const project of projects) {
      const { data: newProject, error } = await supabase
        .from('projects')
        .insert(project)
        .select()
        .single();
      
      if (error) {
        console.error('❌ Error creating project:', project.name, error);
      } else {
        console.log('✅ Created project:', newProject.name);
        createdProjects.push(newProject);
      }
    }

    console.log('\n=== SUMMARY ===');
    console.log(`✅ Created ${createdCustomers.length} customers`);
    console.log(`✅ Created ${createdProjects.length} projects`);
    
    if (createdProjects.length > 0) {
      console.log('\n🎉 Test data created successfully!');
      console.log('You can now try creating a building and should see real projects in the dropdown.');
    } else {
      console.log('\n⚠️ No projects were created. Check the database schema.');
    }

  } catch (error) {
    console.error('❌ Exception during data population:', error);
  }
};

// Run the population script
populateTestData(); 