/**
 * Webhook Dispatcher for Collaboration Workflows
 *
 * Dispatches HTTP POST notifications for workflow lifecycle events
 * (Propose, Execute, step completion, etc.) with HMAC-SHA256 signed payloads.
 */

import crypto from 'crypto';
import { createLogger } from '../utils/logger';

const logger = createLogger('Collab:Webhook');

export type WebhookEventType =
  | 'workflow.created'
  | 'workflow.propose'
  | 'workflow.execute'
  | 'workflow.step.started'
  | 'workflow.step.completed'
  | 'workflow.step.failed'
  | 'workflow.completed'
  | 'workflow.failed';

export interface WebhookPayload {
  event: WebhookEventType;
  workflowId: string;
  timestamp: string;
  data: Record<string, unknown>;
}

/**
 * Dispatch a webhook event to the configured URL.
 * Signs the payload with HMAC-SHA256 using the workflow's webhook secret.
 */
export async function dispatchWebhook(
  webhookUrl: string,
  webhookSecret: string | null,
  payload: WebhookPayload,
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const signature = webhookSecret
    ? crypto.createHmac('sha256', webhookSecret).update(`${timestamp}.${body}`).digest('hex')
    : '';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': `t=${timestamp},v1=${signature}`,
        'X-Webhook-Event': payload.event,
        'X-Workflow-Id': payload.workflowId,
        'User-Agent': 'AwarenessMarket-Webhook/1.0',
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      logger.warn('Webhook delivery failed', {
        url: webhookUrl,
        status: response.status,
        event: payload.event,
      });
      return { success: false, statusCode: response.status };
    }

    logger.info('Webhook delivered', { url: webhookUrl, event: payload.event });
    return { success: true, statusCode: response.status };
  } catch (error: any) {
    logger.error('Webhook dispatch error', { url: webhookUrl, error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Fire-and-forget webhook dispatch for a workflow.
 */
export function fireWorkflowWebhook(
  workflowId: string,
  webhookUrl: string | undefined | null,
  webhookSecret: string | undefined | null,
  event: WebhookEventType,
  data: Record<string, unknown>,
): void {
  if (!webhookUrl) return;

  dispatchWebhook(webhookUrl, webhookSecret || null, {
    event,
    workflowId,
    timestamp: new Date().toISOString(),
    data,
  }).catch((err) => {
    logger.error('Background webhook dispatch failed', { workflowId, event, error: err });
  });
}
