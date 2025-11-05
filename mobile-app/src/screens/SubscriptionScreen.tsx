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
import { trpc } from '../services/trpc';

const PLANS = [
  {
    id: 'basic',
    name: '基础版',
    price: '$9.99',
    period: '/月',
    features: [
      '无限文档存储',
      '100GB 存储空间',
      'OCR 文字识别',
      'AI 文档生成',
      '企业信息查询',
      '邮件支持',
    ],
  },
  {
    id: 'pro',
    name: '专业版',
    price: '$19.99',
    period: '/月',
    popular: true,
    features: [
      '基础版所有功能',
      '500GB 存储空间',
      'IPFS 分布式存储',
      '高级 AI 分析',
      '团队协作功能',
      '优先支持',
    ],
  },
  {
    id: 'enterprise',
    name: '企业版',
    price: '$49.99',
    period: '/月',
    features: [
      '专业版所有功能',
      '无限存储空间',
      'Arweave 永久存储',
      '自定义 AI 模型',
      '专属客户经理',
      '24/7 技术支持',
    ],
  },
];

export default function SubscriptionScreen() {
  const { data: subscription, isLoading } = trpc.subscription.current.useQuery();
  const createCheckoutMutation = trpc.subscription.createCheckoutSession.useMutation();

  const handleSubscribe = async (planId: string) => {
    try {
      const result = await createCheckoutMutation.mutateAsync({ planId });
      // TODO: Open Stripe Checkout URL in WebView or browser
      Alert.alert('提示', '即将跳转到支付页面...\n\n功能正在开发中');
    } catch (error: any) {
      Alert.alert('错误', error.message || '创建订阅失败');
    }
  };

  const handleCancelSubscription = () => {
    Alert.alert(
      '取消订阅',
      '确定要取消订阅吗？您将在当前计费周期结束后失去所有高级功能。',
      [
        { text: '暂不取消', style: 'cancel' },
        {
          text: '确认取消',
          style: 'destructive',
          onPress: () => {
            // TODO: Implement cancel subscription
            Alert.alert('提示', '取消订阅功能正在开发中');
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

  return (
    <ScrollView style={styles.container}>
      {/* Current Subscription Status */}
      {subscription && (
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Icon
              name={subscription.status === 'active' ? 'crown' : 'clock-outline'}
              size={32}
              color={subscription.status === 'active' ? '#10b981' : '#f59e0b'}
            />
            <View style={styles.statusInfo}>
              <Text style={styles.statusTitle}>
                {subscription.status === 'trialing' ? '免费试用中' : '订阅已激活'}
              </Text>
              <Text style={styles.statusSubtitle}>
                {subscription.plan === 'free_trial' ? '15天免费试用' : subscription.plan}
              </Text>
            </View>
          </View>
          {subscription.currentPeriodEnd && (
            <Text style={styles.statusDate}>
              到期时间: {new Date(subscription.currentPeriodEnd).toLocaleDateString('zh-CN')}
            </Text>
          )}
          {subscription.status === 'active' && (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancelSubscription}
            >
              <Text style={styles.cancelButtonText}>取消订阅</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Plans */}
      <View style={styles.plansSection}>
        <Text style={styles.sectionTitle}>选择订阅计划</Text>
        {PLANS.map((plan) => (
          <View
            key={plan.id}
            style={[
              styles.planCard,
              plan.popular && styles.popularPlan,
            ]}
          >
            {plan.popular && (
              <View style={styles.popularBadge}>
                <Text style={styles.popularText}>最受欢迎</Text>
              </View>
            )}
            <Text style={styles.planName}>{plan.name}</Text>
            <View style={styles.priceContainer}>
              <Text style={styles.price}>{plan.price}</Text>
              <Text style={styles.period}>{plan.period}</Text>
            </View>
            <View style={styles.features}>
              {plan.features.map((feature, index) => (
                <View key={index} style={styles.feature}>
                  <Icon name="check-circle" size={20} color="#10b981" />
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity
              style={[
                styles.subscribeButton,
                plan.popular && styles.popularButton,
              ]}
              onPress={() => handleSubscribe(plan.id)}
            >
              <Text
                style={[
                  styles.subscribeButtonText,
                  plan.popular && styles.popularButtonText,
                ]}
              >
                {subscription?.plan === plan.id ? '当前计划' : '立即订阅'}
              </Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* Payment Methods */}
      <View style={styles.paymentSection}>
        <Text style={styles.sectionTitle}>支付方式</Text>
        <View style={styles.paymentMethods}>
          <View style={styles.paymentMethod}>
            <Icon name="credit-card" size={32} color="#3b82f6" />
            <Text style={styles.paymentText}>信用卡/借记卡</Text>
          </View>
          <View style={styles.paymentMethod}>
            <Icon name="wallet" size={32} color="#8b5cf6" />
            <Text style={styles.paymentText}>USDT 加密货币</Text>
          </View>
        </View>
      </View>

      {/* FAQ */}
      <View style={styles.faqSection}>
        <Text style={styles.sectionTitle}>常见问题</Text>
        <View style={styles.faqItem}>
          <Text style={styles.faqQuestion}>如何取消订阅？</Text>
          <Text style={styles.faqAnswer}>
            您可以随时在此页面取消订阅。取消后，您将在当前计费周期结束前继续享有所有功能。
          </Text>
        </View>
        <View style={styles.faqItem}>
          <Text style={styles.faqQuestion}>是否支持退款？</Text>
          <Text style={styles.faqAnswer}>
            如果您在订阅后7天内不满意，我们提供全额退款保证。
          </Text>
        </View>
        <View style={styles.faqItem}>
          <Text style={styles.faqQuestion}>数据安全吗？</Text>
          <Text style={styles.faqAnswer}>
            我们使用企业级加密技术保护您的数据，并支持IPFS分布式存储，确保数据安全和隐私。
          </Text>
        </View>
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
  statusCard: {
    backgroundColor: '#fff',
    padding: 20,
    margin: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusInfo: {
    flex: 1,
    marginLeft: 12,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  statusSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  statusDate: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  cancelButton: {
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ef4444',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
  },
  plansSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  planCard: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  popularPlan: {
    borderColor: '#3b82f6',
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    right: 24,
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  planName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 20,
  },
  price: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  period: {
    fontSize: 16,
    color: '#6b7280',
    marginLeft: 4,
  },
  features: {
    marginBottom: 20,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    fontSize: 15,
    color: '#4b5563',
    marginLeft: 12,
  },
  subscribeButton: {
    backgroundColor: '#f3f4f6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  popularButton: {
    backgroundColor: '#3b82f6',
  },
  subscribeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  popularButtonText: {
    color: '#fff',
  },
  paymentSection: {
    padding: 16,
  },
  paymentMethods: {
    flexDirection: 'row',
    gap: 12,
  },
  paymentMethod: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  paymentText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
  },
  faqSection: {
    padding: 16,
    paddingBottom: 40,
  },
  faqItem: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  faqAnswer: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
});
