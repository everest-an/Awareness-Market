import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { trpc } from '../services/trpc';

export default function ContactDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { id } = route.params as { id: number };

  const { data: contact, isLoading } = trpc.contacts.getById.useQuery({ id });
  const deleteMutation = trpc.contacts.delete.useMutation();

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const handleEmail = (email: string) => {
    Linking.openURL(`mailto:${email}`);
  };

  const handleDelete = () => {
    Alert.alert(
      '确认删除',
      '确定要删除这个联系人吗？此操作无法撤销。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync({ id });
              navigation.goBack();
            } catch (error: any) {
              Alert.alert('错误', error.message || '删除失败');
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

  if (!contact) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="account-remove" size={64} color="#d1d5db" />
        <Text style={styles.errorText}>联系人不存在</Text>
      </View>
    );
  }

  const getInitials = (name: string) => {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getAvatarColor = (name: string): string => {
    const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#ef4444'];
    const index = (name?.charCodeAt(0) || 0) % colors.length;
    return colors[index];
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: getAvatarColor(contact.name) }]}>
          <Text style={styles.avatarText}>{getInitials(contact.name)}</Text>
        </View>
        <Text style={styles.name}>{contact.name || '未命名'}</Text>
        {contact.title && (
          <Text style={styles.title}>{contact.title}</Text>
        )}
        {contact.company && (
          <Text style={styles.company}>{contact.company}</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>联系方式</Text>
        
        {contact.phone && (
          <TouchableOpacity
            style={styles.contactItem}
            onPress={() => handleCall(contact.phone)}
          >
            <View style={styles.contactIcon}>
              <Icon name="phone" size={20} color="#3b82f6" />
            </View>
            <View style={styles.contactContent}>
              <Text style={styles.contactLabel}>电话</Text>
              <Text style={styles.contactValue}>{contact.phone}</Text>
            </View>
            <Icon name="chevron-right" size={20} color="#d1d5db" />
          </TouchableOpacity>
        )}

        {contact.email && (
          <TouchableOpacity
            style={styles.contactItem}
            onPress={() => handleEmail(contact.email)}
          >
            <View style={styles.contactIcon}>
              <Icon name="email" size={20} color="#3b82f6" />
            </View>
            <View style={styles.contactContent}>
              <Text style={styles.contactLabel}>邮箱</Text>
              <Text style={styles.contactValue}>{contact.email}</Text>
            </View>
            <Icon name="chevron-right" size={20} color="#d1d5db" />
          </TouchableOpacity>
        )}

        {contact.website && (
          <TouchableOpacity
            style={styles.contactItem}
            onPress={() => Linking.openURL(contact.website)}
          >
            <View style={styles.contactIcon}>
              <Icon name="web" size={20} color="#3b82f6" />
            </View>
            <View style={styles.contactContent}>
              <Text style={styles.contactLabel}>网站</Text>
              <Text style={styles.contactValue}>{contact.website}</Text>
            </View>
            <Icon name="chevron-right" size={20} color="#d1d5db" />
          </TouchableOpacity>
        )}

        {contact.address && (
          <View style={styles.contactItem}>
            <View style={styles.contactIcon}>
              <Icon name="map-marker" size={20} color="#3b82f6" />
            </View>
            <View style={styles.contactContent}>
              <Text style={styles.contactLabel}>地址</Text>
              <Text style={styles.contactValue}>{contact.address}</Text>
            </View>
          </View>
        )}
      </View>

      {contact.notes && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>备注</Text>
          <Text style={styles.notesText}>{contact.notes}</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>其他信息</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>创建时间</Text>
          <Text style={styles.infoValue}>
            {new Date(contact.createdAt).toLocaleDateString('zh-CN')}
          </Text>
        </View>
        {contact.documentId && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>来源</Text>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate('DocumentDetail' as never, { id: contact.documentId })
              }
            >
              <Text style={[styles.infoValue, { color: '#3b82f6' }]}>
                查看原始文档
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Icon name="delete" size={20} color="#ef4444" />
          <Text style={styles.deleteButtonText}>删除联系人</Text>
        </TouchableOpacity>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    color: '#6b7280',
    marginTop: 16,
  },
  header: {
    backgroundColor: '#fff',
    padding: 32,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 4,
  },
  company: {
    fontSize: 16,
    color: '#3b82f6',
    fontWeight: '500',
  },
  section: {
    backgroundColor: '#fff',
    padding: 20,
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  contactIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactContent: {
    flex: 1,
    marginLeft: 12,
  },
  contactLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  contactValue: {
    fontSize: 16,
    color: '#111827',
  },
  notesText: {
    fontSize: 15,
    color: '#4b5563',
    lineHeight: 24,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  infoLabel: {
    fontSize: 15,
    color: '#6b7280',
  },
  infoValue: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
  },
  actions: {
    padding: 20,
    paddingBottom: 40,
  },
  deleteButton: {
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
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
  },
});
