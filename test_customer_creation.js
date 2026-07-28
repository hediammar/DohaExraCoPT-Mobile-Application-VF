// Test script to verify customer creation works properly
// Run this in your browser console or as a Node.js script

const { createClient } = require('@supabase/supabase-js');

// Replace with your actual Supabase URL and anon key
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testCustomerCreation() {
  console.log('Testing customer creation...');
  
  try {
    // Test data
    const testCustomer = {
      name: 'Test Customer ' + Date.now(),
      email: `test${Date.now()}@example.com`,
      phone: '+974-1234-5678'
    };
    
    console.log('Creating customer with data:', testCustomer);
    
    // Try to create a customer
    const { data, error } = await supabase
      .from('customers')
      .insert([testCustomer])
      .select();
    
    if (error) {
      console.error('Error creating customer:', error);
      return false;
    }
    
    console.log('Customer created successfully:', data);
    
    // Clean up - delete the test customer
    const { error: deleteError } = await supabase
      .from('customers')
      .delete()
      .eq('id', data[0].id);
    
    if (deleteError) {
      console.error('Error deleting test customer:', deleteError);
    } else {
      console.log('Test customer deleted successfully');
    }
    
    return true;
  } catch (error) {
    console.error('Unexpected error:', error);
    return false;
  }
}

// Run the test
testCustomerCreation().then(success => {
  if (success) {
    console.log('✅ Customer creation test passed!');
  } else {
    console.log('❌ Customer creation test failed!');
  }
});