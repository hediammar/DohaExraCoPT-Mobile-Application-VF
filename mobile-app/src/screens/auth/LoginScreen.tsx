import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { useToastContext } from '../../contexts/ToastContext';
import { RootStackNavigationProp } from '../../types/navigation';
import { NavigationBar } from '../../components/NavigationBar';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const navigation = useNavigation<RootStackNavigationProp>();
  const { login } = useAuth();
  const { showToast } = useToastContext();

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      showToast('Please enter both username and password', 'error');
      return;
    }

    setLoading(true);
    try {
      const result = await login(username.trim(), password);
      
      if (result.success) {
        
        navigation.navigate('Main');
      } else {
        showToast(result.error || 'Login failed', 'error');
      }
    } catch (error) {
      showToast('An unexpected error occurred', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <NavigationBar title="Login" showBackButton={false} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Logo and Title */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Image
                source={require('../../../assets/DohaTracker.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.title}>DohaExtraco Panel Tracker</Text>
            <Text style={styles.subtitle}>Sign in to your account</Text>
          </View>

          {/* Login Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Welcome back</Text>
              <Text style={styles.cardDescription}>
                Enter your credentials to access the system
              </Text>
            </View>

            <View style={styles.cardContent}>
              {/* Username Field */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Username</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="person-outline" size={16} color="#D1B3B8" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your username"
                    placeholderTextColor="#D1B3B8"
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                  />
                </View>
              </View>

              {/* Password Field */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed-outline" size={16} color="#D1B3B8" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your password"
                    placeholderTextColor="#D1B3B8"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowPassword(!showPassword)}
                    disabled={loading}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={16}
                      color="#D1B3B8"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="white" />
                    <Text style={styles.submitButtonText}>Signing in...</Text>
                  </View>
                ) : (
                  <Text style={styles.submitButtonText}>Sign In</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Footer */}
            <View style={styles.cardFooter}>
              <Text style={styles.footerText}>
                By signing in, you agree to our terms of service and privacy policy
              </Text>
            </View>
          </View>

          {/* System Info */}
          <View style={styles.systemInfo}>
            <Text style={styles.systemInfoText}>
              DohaExtraco Panel Tracker v1.1.0
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#8B2633', // Qatar theme background
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    width: 120,
    height: 120,
    backgroundColor: 'transparent',
    borderRadius: 0,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff', // White text for Qatar theme
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#D1B3B8', // Qatar muted foreground
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#5A1A23', // Qatar card background
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 25,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#7A2531', // Qatar border color
  },
  cardHeader: {
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff', // White text
    textAlign: 'center',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: '#D1B3B8', // Qatar muted foreground
    textAlign: 'center',
  },
  cardContent: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ffffff', // White text
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3D111A', // Qatar input background
    borderWidth: 1,
    borderColor: '#7A2531', // Qatar border
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#ffffff', // White text
    paddingVertical: 0,
  },
  eyeButton: {
    padding: 4,
    marginLeft: 8,
  },
  submitButton: {
    backgroundColor: '#C13B4A', // Qatar primary color
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#5A1A23', // Qatar muted color
  },
  submitButtonText: {
    color: '#ffffff', // White text
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardFooter: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 16,
  },
  footerText: {
    fontSize: 12,
    color: '#D1B3B8', // Qatar muted foreground
    textAlign: 'center',
    lineHeight: 16,
  },
  systemInfo: {
    marginTop: 32,
    alignItems: 'center',
  },
  systemInfoText: {
    fontSize: 12,
    color: '#D1B3B8', // Qatar muted foreground
    textAlign: 'center',
  },
});
