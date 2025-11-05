import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { authService } from '../services/trpc';

export default function LoginScreen() {
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleEmailLogin = async () => {
    if (!email) {
      Alert.alert('提示', '请输入邮箱地址');
      return;
    }

    setIsLoading(true);
    try {
      // TODO: Implement email verification code login
      Alert.alert('功能开发中', '邮箱验证码登录功能正在开发中');
    } catch (error: any) {
      Alert.alert('错误', error.message || '登录失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleWeb3Login = async () => {
    Alert.alert('功能开发中', 'Web3钱包登录功能正在开发中');
  };

  const handleManusLogin = async () => {
    Alert.alert('功能开发中', 'Manus OAuth登录功能正在开发中\n\n请在Web端登录后使用移动端');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-left" size={24} color="#111827" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <View style={styles.logo}>
            <Icon name="brain" size={48} color="#3b82f6" />
          </View>
          <Text style={styles.title}>Awareness Network</Text>
          <Text style={styles.subtitle}>智能知识管理系统</Text>
        </View>

        <View style={styles.loginMethods}>
          {/* Manus OAuth Login */}
          <TouchableOpacity
            style={[styles.loginButton, styles.primaryButton]}
            onPress={handleManusLogin}
          >
            <Icon name="account-circle" size={24} color="#fff" />
            <Text style={styles.primaryButtonText}>使用 Manus 登录</Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>或</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Email Login */}
          <View style={styles.emailContainer}>
            <View style={styles.inputContainer}>
              <Icon name="email" size={20} color="#9ca3af" />
              <TextInput
                style={styles.input}
                placeholder="输入邮箱地址"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isLoading}
              />
            </View>
            <TouchableOpacity
              style={[styles.loginButton, styles.secondaryButton]}
              onPress={handleEmailLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#3b82f6" />
              ) : (
                <>
                  <Icon name="email-send" size={24} color="#3b82f6" />
                  <Text style={styles.secondaryButtonText}>发送验证码</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Web3 Wallet Login */}
          <TouchableOpacity
            style={[styles.loginButton, styles.web3Button]}
            onPress={handleWeb3Login}
          >
            <Icon name="wallet" size={24} color="#8b5cf6" />
            <Text style={styles.web3ButtonText}>使用 Web3 钱包登录</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            登录即表示您同意我们的
          </Text>
          <View style={styles.footerLinks}>
            <TouchableOpacity>
              <Text style={styles.link}>服务条款</Text>
            </TouchableOpacity>
            <Text style={styles.footerText}> 和 </Text>
            <TouchableOpacity>
              <Text style={styles.link}>隐私政策</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: 'space-between',
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
  loginMethods: {
    flex: 1,
    justifyContent: 'center',
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 12,
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  secondaryButton: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3b82f6',
  },
  web3Button: {
    backgroundColor: '#f5f3ff',
    borderWidth: 1,
    borderColor: '#8b5cf6',
  },
  web3ButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8b5cf6',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  dividerText: {
    fontSize: 14,
    color: '#9ca3af',
    marginHorizontal: 16,
  },
  emailContainer: {
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    marginLeft: 12,
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 40,
  },
  footerText: {
    fontSize: 14,
    color: '#6b7280',
  },
  footerLinks: {
    flexDirection: 'row',
    marginTop: 8,
  },
  link: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '500',
  },
});
