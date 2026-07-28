// Debug script for user-related 409 errors
// Run this in your browser console to identify user issues

const debugUserIssue = async () => {
  console.log('=== USER ISSUE DEBUG ===');
  
  // Test 1: Check if users table exists and is accessible
  console.log('1. Testing users table access...');
  try {
    const { data: testData, error: testError } = await supabase
      .from('users')
      .select('id, username, name, email')
      .limit(5);
    
    if (testError) {
      console.error('❌ Cannot access users table:', testError);
      return;
    }
    console.log('✅ Users table accessible. Found users:', testData?.length || 0);
    console.log('Available users:', testData);
  } catch (error) {
    console.error('❌ Error testing users table:', error);
    return;
  }
  
  // Test 2: Check current auth user
  console.log('\n2. Checking current auth user...');
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error('❌ Error getting auth user:', error);
    } else {
      console.log('✅ Current auth user:', user);
      console.log('Auth user ID:', user?.id);
      console.log('Auth user email:', user?.email);
    }
  } catch (error) {
    console.error('❌ Error checking auth user:', error);
  }
  
  // Test 3: Check if current auth user exists in users table
  console.log('\n3. Checking if auth user exists in users table...');
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.error('❌ Error getting auth user:', authError);
    } else if (user) {
      const { data: dbUser, error: dbError } = await supabase
        .from('users')
        .select('id, username, name, email, role')
        .eq('id', user.id)
        .single();
      
      if (dbError) {
        console.error('❌ Error checking user in database:', dbError);
        console.log('⚠️ User not found in users table. This is the issue!');
        
        // Try to find user by email
        console.log('\n4. Trying to find user by email...');
        const { data: userByEmail, error: emailError } = await supabase
          .from('users')
          .select('id, username, name, email, role')
          .eq('email', user.email)
          .single();
        
        if (emailError || !userByEmail) {
          console.log('❌ User not found by email either. Creating user record...');
          
          // Create the user in the users table
          const newUserData = {
            id: user.id,
            username: user.email?.split('@')[0] || 'user',
            name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
            email: user.email || '',
            role: 'Data Entry', // Default role
            password_hash: 'temp_hash', // Will be updated on first login
            status: 'active'
          };
          
          console.log('Creating user with data:', newUserData);
          
          const { data: createdUser, error: createError } = await supabase
            .from('users')
            .insert(newUserData)
            .select()
            .single();
          
          if (createError) {
            console.error('❌ Error creating user:', createError);
            console.error('Create error details:', {
              message: createError.message,
              details: createError.details,
              hint: createError.hint,
              code: createError.code
            });
          } else {
            console.log('✅ User created successfully:', createdUser);
          }
        } else {
          console.log('✅ User found by email:', userByEmail);
          console.log('⚠️ User exists but with different ID. This might cause issues.');
        }
      } else {
        console.log('✅ User found in users table:', dbUser);
      }
    } else {
      console.log('⚠️ No auth user found. Please log in first.');
    }
  } catch (error) {
    console.error('❌ Exception during user checking:', error);
  }
  
  // Test 4: Check all users in the database
  console.log('\n5. Checking all users in database...');
  try {
    const { data: allUsers, error } = await supabase
      .from('users')
      .select('id, username, name, email, role')
      .order('username');
    
    if (error) {
      console.error('❌ Error fetching all users:', error);
    } else {
      console.log('✅ All users in database:', allUsers);
      if (allUsers.length === 0) {
        console.log('⚠️ WARNING: No users found in the database!');
        console.log('This might indicate a database setup issue.');
      }
    }
  } catch (error) {
    console.error('❌ Error checking all users:', error);
  }
  
  console.log('\n=== DEBUG COMPLETE ===');
  console.log('If you see "User not found in users table", the issue is:');
  console.log('- Your auth user exists but not in the users table');
  console.log('- The script should have created the user automatically');
  console.log('- Try creating a project again after the user is created');
  console.log('');
  console.log('If you see "No users found", there might be a database setup issue.');
  console.log('Check that the users table exists and has the correct structure.');
};

// Run the debug function
debugUserIssue(); 