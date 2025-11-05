import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { trpc } from '../services/trpc';

export default function DocumentDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { id } = route.params as { id: number };

  const { data: document, isLoading } = trpc.documents.getById.useQuery({ id });
  const deleteMutation = trpc.documents.delete.useMutation();

  const handleDelete = () => {
    Alert.alert(
      '确认删除',
      '确定要删除这份文档吗？此操作无法撤销。',
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

  if (!document) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="file-document-remove" size={64} color="#d1d5db" />
        <Text style={styles.errorText}>文档不存在</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{document.title}</Text>
        <View style={styles.metadata}>
          <View style={styles.metadataItem}>
            <Icon name="calendar" size={16} color="#6b7280" />
            <Text style={styles.metadataText}>
              {new Date(document.createdAt).toLocaleDateString('zh-CN')}
            </Text>
          </View>
          {document.fileId && (
            <View style={styles.metadataItem}>
              <Icon name="file-image" size={16} color="#6b7280" />
              <Text style={styles.metadataText}>包含图片</Text>
            </View>
          )}
        </View>
      </View>

      {document.summary && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="text-box-outline" size={20} color="#3b82f6" />
            <Text style={styles.sectionTitle}>摘要</Text>
          </View>
          <Text style={styles.summaryText}>{document.summary}</Text>
        </View>
      )}

      {document.content && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="file-document-outline" size={20} color="#3b82f6" />
            <Text style={styles.sectionTitle}>内容</Text>
          </View>
          <Text style={styles.contentText}>{document.content}</Text>
        </View>
      )}

      {document.tags && document.tags.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="tag-multiple" size={20} color="#3b82f6" />
            <Text style={styles.sectionTitle}>标签</Text>
          </View>
          <View style={styles.tagsContainer}>
            {document.tags.map((tag: string, index: number) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {document.companyInfo && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="office-building" size={20} color="#3b82f6" />
            <Text style={styles.sectionTitle}>企业信息</Text>
          </View>
          <View style={styles.companyCard}>
            {document.companyInfo.name && (
              <View style={styles.companyRow}>
                <Text style={styles.companyLabel}>公司名称</Text>
                <Text style={styles.companyValue}>{document.companyInfo.name}</Text>
              </View>
            )}
            {document.companyInfo.industry && (
              <View style={styles.companyRow}>
                <Text style={styles.companyLabel}>行业</Text>
                <Text style={styles.companyValue}>{document.companyInfo.industry}</Text>
              </View>
            )}
            {document.companyInfo.description && (
              <View style={styles.companyRow}>
                <Text style={styles.companyLabel}>简介</Text>
                <Text style={styles.companyValue}>{document.companyInfo.description}</Text>
              </View>
            )}
          </View>
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Icon name="delete" size={20} color="#ef4444" />
          <Text style={styles.deleteButtonText}>删除文档</Text>
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
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  metadata: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  metadataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metadataText: {
    fontSize: 14,
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
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  summaryText: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
  },
  contentText: {
    fontSize: 15,
    color: '#4b5563',
    lineHeight: 24,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  tagText: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '500',
  },
  companyCard: {
    gap: 12,
  },
  companyRow: {
    gap: 4,
  },
  companyLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  companyValue: {
    fontSize: 15,
    color: '#111827',
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
