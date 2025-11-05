import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { trpc } from '../services/trpc';
import { authService } from '../services/trpc';

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { data: user, isLoading } = trpc.auth.me.useQuery();
  const { data: subscription } = trpc.subscription.current.useQuery();
  const logoutMutation = trpc.auth.logout.useMutation();

  const handleLogout = () => {
    Alert.alert(
      '确认退出',
      '确定要退出登录吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '退出',
          style: 'destructive',
          onPress: async () => {
            try {
              await logoutMutation.mutateAsync();
              await authService.removeToken();
              navigation.navigate('Login' as never);
            } catch (error: any) {
              Alert.alert('错误', error.message || '退出失败');
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>个人中心</Text>
        </View>
        <View style={styles.loginPrompt}>
          <Icon name="account-circle-outline" size={64} color="#d1d5db" />
          <Text style={styles.loginPromptText}>请先登录</Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => navigation.navigate('Login' as never)}
          >
            <Text style={styles.loginButtonText}>前往登录</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>个人中心</Text>
      </View>

      {/* User Info */}
      <View style={styles.userCard}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user.name?.substring(0, 2).toUpperCase() || 'U'}
            </Text>
          </View>
        </View>
        <Text style={styles.userName}>{user.name || '未命名用户'}</Text>
        {user.email && (
          <Text style={styles.userEmail}>{user.email}</Text>
        )}
      </View>

      {/* Subscription Status */}
      {subscription && (
        <TouchableOpacity
          style={styles.section}
          onPress={() => navigation.navigate('Subscription' as never)}
        >
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Icon
                name={subscription.status === 'active' ? 'crown' : 'clock-outline'}
                size={24}
                color="#3b82f6"
              />
            </View>
            <View style={styles.sectionContent}>
              <Text style={styles.sectionTitle}>订阅状态</Text>
              <Text style={styles.sectionSubtitle}>
                {subscription.status === 'trialing' ? '免费试用中' : subscription.status === 'active' ? '订阅已激活' : '未订阅'}
              </Text>
            </View>
            <Icon name="chevron-right" size={24} color="#d1d5db" />
          </View>
        </TouchableOpacity>
      )}

      {/* Menu Items */}
      <View style={styles.menuSection}>
        <TouchableOpacity style={styles.menuItem}>
          <Icon name="cog" size={24} color="#6b7280" />
          <Text style={styles.menuText}>设置</Text>
          <Icon name="chevron-right" size={24} color="#d1d5db" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Icon name="shield-check" size={24} color="#6b7280" />
          <Text style={styles.menuText}>隐私政策</Text>
          <Icon name="chevron-right" size={24} color="#d1d5db" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Icon name="file-document" size={24} color="#6b7280" />
          <Text style={styles.menuText}>服务条款</Text>
          <Icon name="chevron-right" size={24} color="#d1d5db" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Icon name="help-circle" size={24} color="#6b7280" />
          <Text style={styles.menuText}>帮助与支持</Text>
          <Icon name="chevron-right" size={24} color="#d1d5db" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Icon name="information" size={24} color="#6b7280" />
          <Text style={styles.menuText}>关于我们</Text>
          <Icon name="chevron-right" size={24} color="#d1d5db" />
        </TouchableOpacity>
      </View>

      {/* Logout Button */}
      <View style={styles.logoutSection}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Icon name="logout" size={20} color="#ef4444" />
          <Text style={styles.logoutText}>退出登录</Text>
        </TouchableOpacity>
      </View>

      {/* App Version */}
      <Text style={styles.version}>Awareness Network v2.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
  },
  userCard: {
    backgroundColor: '#fff',
    padding: 32,
    alignItems: 'center',
    marginTop: 12,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: '#6b7280',
  },
  section: {
    backgroundColor: '#fff',
    padding: 20,
    marginTop: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionContent: {
    flex: 1,
    marginLeft: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  menuSection: {
    backgroundColor: '#fff',
    marginTop: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    marginLeft: 16,
  },
  logoutSection: {
    padding: 20,
    marginTop: 12,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ef4444',
    gap: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
  },
  version: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    padding: 20,
  },
  loginPrompt: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loginPromptText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 16,
    marginBottom: 24,
  },
  loginButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
