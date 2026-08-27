/**
 * Daemon availability probe that refuses to go quietly green in CI.
 *
 * Several suites are written as `if (!(await daemonAlive())) { t.skip(...) }`.
 * Locally that is the right call — not every developer has a daemon on 37800.
 * In CI it is actively harmful: the job reports success while the tests that
 * actually exercise cross-workspace isolation never ran even once. F-055 was
 * filed for a real data-leak between workspaces, and its regression suite has
 * been silently skipping in CI, so the leak could have returned unnoticed.
 *
 * Skipping is a local convenience, never a CI outcome. In CI, a missing daemon
 * is an environment bug that must fail loudly so someone fixes the harness.
 */

const CI_ENV_KEYS = ['CI', 'GITHUB_ACTIONS', 'GITLAB_CI', 'BUILDKITE', 'CIRCLECI'];

/** True when any common CI marker is set to a truthy value. */
export function isCI() {
  return CI_ENV_KEYS.some((k) => {
    const v = process.env[k];
    return v != null && v !== '' && v !== '0' && v.toLowerCase() !== 'false';
  });
}

/**
 * Probe a daemon's /healthz.
 *
 * @param {string} baseUrl e.g. 'http://localhost:37800'
 * @param {{ timeoutMs?: number }} [opts]
 * @returns {Promise<boolean>}
 */
export async function probeDaemon(baseUrl, { timeoutMs = 2000 } = {}) {
  try {
    const r = await fetch(`${baseUrl}/healthz`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/**
 * Probe the daemon; throw in CI when it is absent, so the suite fails instead
 * of skipping. Returns the liveness boolean for the caller's own skip logic.
 *
 * @param {string} baseUrl
 * @param {string} suiteLabel shown in the CI failure message
 * @returns {Promise<boolean>}
 */
export async function daemonAliveOrFailInCI(baseUrl, suiteLabel) {
  const alive = await probeDaemon(baseUrl);
  if (!alive && isCI()) {
    throw new Error(
      `[${suiteLabel}] no daemon on ${baseUrl} and CI is set. `
      + 'These journeys must actually run in CI — a skip here would report green '
      + 'while nothing was verified. Start a daemon before this suite '
      + `(awareness-local start --port ${new URL(baseUrl).port || '37800'}) `
      + 'or drop the suite from the CI job deliberately.',
    );
  }
  return alive;
}
