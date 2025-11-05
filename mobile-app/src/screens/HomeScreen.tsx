import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { trpc } from '../services/trpc';

export default function HomeScreen() {
  const navigation = useNavigation();
  const { data: user, isLoading: userLoading } = trpc.auth.me.useQuery();
  const { data: subscription } = trpc.subscription.current.useQuery();
  const { data: stats } = trpc.documents.list.useQuery();

  const documentCount = stats?.length || 0;
  const { data: contacts } = trpc.contacts.list.useQuery();
  const contactCount = contacts?.length || 0;

  if (userLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>请先登录</Text>
        <TouchableOpacity
          style={styles.loginButton}
          onPress={() => navigation.navigate('Login' as never)}
        >
          <Text style={styles.loginButtonText}>前往登录</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>欢迎回来，{user.name || '用户'}！</Text>
        <Text style={styles.subtitle}>管理您的知识库并捕获新信息</Text>
      </View>

      {/* Subscription Status */}
      {subscription && (
        <TouchableOpacity
          style={[
            styles.subscriptionCard,
            subscription.status === 'active' ? styles.activeSubscription : styles.trialSubscription,
          ]}
          onPress={() => navigation.navigate('Subscription' as never)}
        >
          <Icon
            name={subscription.status === 'active' ? 'crown' : 'clock-outline'}
            size={24}
            color="#fff"
          />
          <View style={styles.subscriptionInfo}>
            <Text style={styles.subscriptionTitle}>
              {subscription.status === 'trialing' ? '免费试用中' : '订阅已激活'}
            </Text>
            <Text style={styles.subscriptionSubtitle}>
              {subscription.plan === 'free_trial' ? '15天免费试用' : subscription.plan}
            </Text>
          </View>
          <Icon name="chevron-right" size={24} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Icon name="file-document" size={32} color="#3b82f6" />
          <Text style={styles.statNumber}>{documentCount}</Text>
          <Text style={styles.statLabel}>文档</Text>
        </View>
        <View style={styles.statCard}>
          <Icon name="account-multiple" size={32} color="#10b981" />
          <Text style={styles.statNumber}>{contactCount}</Text>
          <Text style={styles.statLabel}>联系人</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>快速操作</Text>
        <View style={styles.actionGrid}>
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: '#3b82f6' }]}
            onPress={() => navigation.navigate('Camera' as never)}
          >
            <Icon name="camera" size={32} color="#fff" />
            <Text style={styles.actionText}>拍照</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: '#8b5cf6' }]}
            onPress={() => navigation.navigate('Documents' as never)}
          >
            <Icon name="file-document" size={32} color="#fff" />
            <Text style={styles.actionText}>浏览文档</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: '#ec4899' }]}
            onPress={() => navigation.navigate('Contacts' as never)}
          >
            <Icon name="account-multiple" size={32} color="#fff" />
            <Text style={styles.actionText}>管理联系人</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Recent Documents */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>最近文档</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Documents' as never)}>
            <Text style={styles.viewAllText}>查看全部</Text>
          </TouchableOpacity>
        </View>
        {stats && stats.length > 0 ? (
          stats.slice(0, 3).map((doc: any) => (
            <TouchableOpacity
              key={doc.id}
              style={styles.documentItem}
              onPress={() => navigation.navigate('DocumentDetail' as never, { id: doc.id })}
            >
              <Icon name="file-document-outline" size={24} color="#6b7280" />
              <View style={styles.documentInfo}>
                <Text style={styles.documentTitle}>{doc.title}</Text>
                <Text style={styles.documentDate}>
                  {new Date(doc.createdAt).toLocaleDateString('zh-CN')}
                </Text>
              </View>
              <Icon name="chevron-right" size={24} color="#d1d5db" />
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Icon name="file-document-outline" size={48} color="#d1d5db" />
            <Text style={styles.emptyText}>还没有文档</Text>
            <Text style={styles.emptySubtext}>开始拍照创建您的第一份文档</Text>
          </View>
        )}
      </View>
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
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
  subscriptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  activeSubscription: {
    backgroundColor: '#10b981',
  },
  trialSubscription: {
    backgroundColor: '#f59e0b',
  },
  subscriptionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  subscriptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  subscriptionSubtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    marginTop: 2,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  viewAllText: {
    fontSize: 14,
    color: '#3b82f6',
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginTop: 8,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  documentInfo: {
    flex: 1,
    marginLeft: 12,
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  documentDate: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  loginButton: {
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
