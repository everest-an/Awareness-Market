/**
 * CloudWatch 监控和告警配置
 * 用于 AWS 环境的应用性能和健康监控
 */

import { CloudWatchClient, PutMetricAlarmCommand, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { Logs } from 'aws-sdk';

const cloudwatch = new CloudWatchClient({ region: process.env.AWS_REGION || 'us-east-1' });
const logs = new Logs({ region: process.env.AWS_REGION || 'us-east-1' });

const NAMESPACE = 'AwarenessMarket';

/**
 * 发送自定义指标到 CloudWatch
 */
export async function publishMetric(
  metricName: string,
  value: number,
  unit: string = 'None',
  dimensions?: Record<string, string>
) {
  try {
    const params: any = {
      Namespace: NAMESPACE,
      MetricData: [
        {
          MetricName: metricName,
          Value: value,
          Unit: unit,
          Timestamp: new Date(),
        },
      ],
    };

    if (dimensions) {
      params.MetricData[0].Dimensions = Object.entries(dimensions).map(([name, value]) => ({
        Name: name,
        Value: value,
      }));
    }

    await cloudwatch.send(new PutMetricDataCommand(params));
    console.log(`📊 Metric published: ${metricName} = ${value}`);
  } catch (error) {
    console.error('Failed to publish metric:', error);
  }
}

/**
 * 创建告警
 */
export async function createAlarm(
  alarmName: string,
  metricName: string,
  threshold: number,
  comparisonOperator: string = 'GreaterThanThreshold',
  evaluationPeriods: number = 2,
  period: number = 300
) {
  try {
    const params = {
      AlarmName: alarmName,
      MetricName: metricName,
      Namespace: NAMESPACE,
      Statistic: 'Average',
      Period: period,
      EvaluationPeriods: evaluationPeriods,
      Threshold: threshold,
      ComparisonOperator: comparisonOperator,
      AlarmDescription: `Alert when ${metricName} ${comparisonOperator} ${threshold}`,
      AlarmActions: [process.env.SNS_ALARM_TOPIC_ARN || ''].filter(Boolean),
    };

    await cloudwatch.send(new PutMetricAlarmCommand(params as any));
    console.log(`🚨 Alarm created: ${alarmName}`);
  } catch (error) {
    console.error('Failed to create alarm:', error);
  }
}

/**
 * 设置所有监控指标
 */
export async function setupCloudWatchMonitoring() {
  console.log('⚙️  设置 CloudWatch 监控...');

  try {
    // ==========================================
    // API 性能指标
    // ==========================================
    await createAlarm(
      'APIResponseTimeHigh',
      'APIResponseTime',
      1000, // 1 秒
      'GreaterThanThreshold'
    );

    await createAlarm(
      'APIErrorRateHigh',
      'APIErrorRate',
      5, // 5%
      'GreaterThanThreshold'
    );

    // ==========================================
    // 数据库性能
    // ==========================================
    await createAlarm(
      'DatabaseConnectionPoolExhausted',
      'DatabaseConnections',
      90, // 90%
      'GreaterThanThreshold'
    );

    await createAlarm(
      'DatabaseSlowQueries',
      'SlowQueryCount',
      10,
      'GreaterThanThreshold',
      1,
      60
    );

    // ==========================================
    // 服务器资源
    // ==========================================
    await createAlarm(
      'HighMemoryUsage',
      'MemoryUsage',
      80, // 80%
      'GreaterThanThreshold'
    );

    await createAlarm(
      'HighCPUUsage',
      'CPUUsage',
      85, // 85%
      'GreaterThanThreshold'
    );

    await createAlarm(
      'DiskSpaceLow',
      'DiskUsage',
      90, // 90%
      'GreaterThanThreshold'
    );

    // ==========================================
    // 应用层指标
    // ==========================================
    await createAlarm(
      'ActiveSessionsHigh',
      'ActiveSessions',
      1000,
      'GreaterThanThreshold'
    );

    await createAlarm(
      'CacheHitRateLow',
      'CacheHitRate',
      50, // 低于 50%
      'LessThanThreshold'
    );

    // ==========================================
    // 区块链相关
    // ==========================================
    await createAlarm(
      'NFTMintFailureRate',
      'NFTMintFailureRate',
      5,
      'GreaterThanThreshold'
    );

    await createAlarm(
      'BlockchainGasPriceHigh',
      'GasPrice',
      100, // 单位: Gwei
      'GreaterThanThreshold'
    );

    console.log('✅ CloudWatch 监控设置完成！');
  } catch (error) {
    console.error('❌ 设置 CloudWatch 监控失败:', error);
  }
}

/**
 * 发送日志到 CloudWatch Logs
 */
export async function sendToCloudWatchLogs(
  logGroupName: string,
  logStreamName: string,
  message: string
) {
  try {
    // 确保日志组存在
    try {
      await logs.createLogGroup({ logGroupName }).promise();
    } catch (error: any) {
      if (error.code !== 'ResourceAlreadyExistsException') {
        throw error;
      }
    }

    // 确保日志流存在
    try {
      await logs.createLogStream({ logGroupName, logStreamName }).promise();
    } catch (error: any) {
      if (error.code !== 'ResourceAlreadyExistsException') {
        throw error;
      }
    }

    // 发送日志
    await logs
      .putLogEvents({
        logGroupName,
        logStreamName,
        logEvents: [
          {
            message,
            timestamp: Date.now(),
          },
        ],
      })
      .promise();

    console.log(`📝 Log sent to CloudWatch: ${logGroupName}/${logStreamName}`);
  } catch (error) {
    console.error('Failed to send log to CloudWatch:', error);
  }
}

/**
 * 性能监控中间件
 */
export function performanceMonitoringMiddleware() {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now();

    // 监听响应完成
    res.on('finish', async () => {
      const duration = Date.now() - startTime;

      // 发送响应时间指标
      await publishMetric('APIResponseTime', duration, 'Milliseconds', {
        Method: req.method,
        Path: req.path,
        Status: res.statusCode.toString(),
      });

      // 发送状态码指标
      if (res.statusCode >= 400) {
        await publishMetric('APIErrorCount', 1, 'Count', {
          Status: res.statusCode.toString(),
          Path: req.path,
        });
      }

      // 记录慢查询
      if (duration > 1000) {
        console.warn(`⚠️  Slow API request: ${req.method} ${req.path} took ${duration}ms`);
        await publishMetric('SlowAPIRequest', 1, 'Count', {
          Path: req.path,
        });
      }
    });

    next();
  };
}

/**
 * 系统资源监控
 */
export function startSystemResourceMonitoring(intervalMs: number = 60000) {
  setInterval(async () => {
    try {
      const os = require('os');

      // CPU 使用率（简化计算）
      const cpus = os.cpus();
      const avgLoad = os.loadavg()[0];
      const cpuUsage = (avgLoad / cpus.length) * 100;

      await publishMetric('CPUUsage', Math.min(cpuUsage, 100), 'Percent');

      // 内存使用率
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const memoryUsage = ((totalMemory - freeMemory) / totalMemory) * 100;

      await publishMetric('MemoryUsage', memoryUsage, 'Percent');

      // 进程数
      const processes = require('child_process').exec('ps aux | wc -l', (error: any, stdout: any) => {
        if (!error) {
          const processCount = parseInt(stdout.trim());
          publishMetric('ProcessCount', processCount, 'Count');
        }
      });

      console.log(`📊 System metrics: CPU=${cpuUsage.toFixed(2)}%, MEM=${memoryUsage.toFixed(2)}%`);
    } catch (error) {
      console.error('Failed to collect system metrics:', error);
    }
  }, intervalMs);
}

/**
 * 应用启动时初始化监控
 */
export async function initializeCloudWatchMonitoring() {
  console.log('🚀 初始化 CloudWatch 监控...');

  // 设置告警
  await setupCloudWatchMonitoring();

  // 启动系统资源监控
  startSystemResourceMonitoring(60000); // 每 60 秒采集一次

  console.log('✅ CloudWatch 监控已启动');
}

export default {
  publishMetric,
  createAlarm,
  setupCloudWatchMonitoring,
  sendToCloudWatchLogs,
  performanceMonitoringMiddleware,
  startSystemResourceMonitoring,
  initializeCloudWatchMonitoring,
};
