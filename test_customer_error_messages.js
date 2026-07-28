// Test script to verify customer creation error messages work correctly
// Run this in your browser console or as a Node.js script

const { createClient } = require('@supabase/supabase-js');

// Replace with your actual Supabase URL and anon key
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testCustomerErrorMessages() {
  console.log('Testing customer creation error messages...');
  
  try {
    // First, create a customer to test duplicate scenarios
    const existingCustomer = {
      name: 'Test Customer Duplicate',
      email: 'testduplicate@example.com',
      phone: '+974-1234-5678'
    };
    
    console.log('Creating initial customer...');
    const { data: initialData, error: initialError } = await supabase
      .from('customers')
      .insert([existingCustomer])
      .select();
    
    if (initialError) {
      console.error('Error creating initial customer:', initialError);
      return false;
    }
    
    console.log('Initial customer created successfully:', initialData);
    
    // Test 1: Duplicate email
    console.log('\n--- Test 1: Duplicate Email ---');
    const duplicateEmailCustomer = {
      name: 'Different Name',
      email: 'testduplicate@example.com', // Same email
      phone: '+974-9999-9999'
    };
    
    const { error: emailError } = await supabase
      .from('customers')
      .insert([duplicateEmailCustomer]);
    
    if (emailError) {
      console.log('✅ Duplicate email error caught:', emailError.message);
    } else {
      console.log('❌ Duplicate email error not caught!');
    }
    
    // Test 2: Duplicate name
    console.log('\n--- Test 2: Duplicate Name ---');
    const duplicateNameCustomer = {
      name: 'Test Customer Duplicate', // Same name
      email: 'different@example.com',
      phone: '+974-8888-8888'
    };
    
    const { error: nameError } = await supabase
      .from('customers')
      .insert([duplicateNameCustomer]);
    
    if (nameError) {
      console.log('✅ Duplicate name error caught:', nameError.message);
    } else {
      console.log('❌ Duplicate name error not caught!');
    }
    
    // Test 3: Missing required fields
    console.log('\n--- Test 3: Missing Required Fields ---');
    const incompleteCustomer = {
      name: '', // Empty name
      email: 'incomplete@example.com',
      phone: '+974-7777-7777'
    };
    
    const { error: incompleteError } = await supabase
      .from('customers')
      .insert([incompleteCustomer]);
    
    if (incompleteError) {
      console.log('✅ Missing field error caught:', incompleteError.message);
    } else {
      console.log('❌ Missing field error not caught!');
    }
    
    // Clean up - delete the test customer
    const { error: deleteError } = await supabase
      .from('customers')
      .delete()
      .eq('id', initialData[0].id);
    
    if (deleteError) {
      console.error('Error deleting test customer:', deleteError);
    } else {
      console.log('\n✅ Test customer deleted successfully');
    }
    
    return true;
  } catch (error) {
    console.error('Unexpected error:', error);
    return false;
  }
}

// Run the test
testCustomerErrorMessages().then(success => {
  if (success) {
    console.log('\n✅ Customer error message tests completed!');
  } else {
    console.log('\n❌ Customer error message tests failed!');
  }
});
