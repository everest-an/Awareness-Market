// Batch A · What to do with one pending delivery, right now. Pure decision function:
// no clock, no IO, no mutation — the caller supplies the time and applies the outcome.
//
// Split out from the worker on purpose. The retry rules are the part that is easy to
// get subtly wrong (off-by-one on attempts, TTL checked after the send, backoff that
// silently never fires) and hard to observe once they are tangled with HTTP and SQLite.
// Isolated, every branch is a two-line test.
//
// Order of checks is itself a decision, not an accident:
//
//   1. TTL first. An expired message must stop even if it has attempts left — otherwise
//      a long outage produces a burst of writes whose intent is hours stale, and for a
//      memory system a late write is not a harmless one: it can resurrect a card the
//      user already deleted.
//   2. Attempts second. Bounded retries put a ceiling on damage from a poison message.
//   3. Schedule last, so a message that is neither dead nor due simply waits.
//
// Fixed backoff, not exponential. Exponential is the right default when the failure is
// contention and backing off relieves it; here the realistic failures are "laptop is
// offline" and "the cloud is down", which backing off does not help. Fixed keeps the
// worst-case delivery latency legible (attempts x delay) and makes the tests
// deterministic without a fake clock. Revisit if we ever see self-inflicted 429s.

export const DEFAULT_MAX_ATTEMPTS = 3;
export const DEFAULT_RETRY_DELAY_MS = 1000;

/** @typedef {{action:'send'}|{action:'wait',nextAttemptAtMs:number}|{action:'failed',reason:'MAX_ATTEMPTS'}|{action:'expired',reason:'TTL_EXPIRED'}} DeliveryAction */

/**
 * @returns {DeliveryAction} Terminal outcomes carry a reason so the stored row says why
 * it stopped; "failed" with no reason is the kind of row that costs an hour later.
 */
export function nextDeliveryAction({attempts, maxAttempts, nowMs, expiresAtMs, nextAttemptAtMs}) {
  if (nowMs >= expiresAtMs) return {action: 'expired', reason: 'TTL_EXPIRED'};
  if (attempts >= maxAttempts) return {action: 'failed', reason: 'MAX_ATTEMPTS'};
  if (nowMs >= nextAttemptAtMs) return {action: 'send'};
  return {action: 'wait', nextAttemptAtMs};
}

/**
 * When to try again after a failed attempt, clamped to the TTL so a scheduled retry is
 * never past the deadline it would be judged against. Without the clamp a row can sit
 * "pending, retry at T+1s" while already expired — a state that reads as healthy in a
 * status view and never sends.
 */
export function scheduleNextAttempt({nowMs, expiresAtMs, delayMs = DEFAULT_RETRY_DELAY_MS}) {
  return Math.min(nowMs + delayMs, expiresAtMs);
}

/** Terminal states are the ones a worker must stop touching. */
export function isTerminal(status) {
  return status === 'acked' || status === 'failed' || status === 'expired';
}
