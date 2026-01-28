/**
 * Analytics Utility - Dynamic Script Loading
 *
 * Loads analytics scripts dynamically to avoid build-time issues
 * with environment variables in HTML
 */

/**
 * Load Umami analytics script if configured
 */
export function loadAnalytics(): void {
  // Only load in production
  if (import.meta.env.DEV) {
    console.log('📊 Analytics disabled in development mode');
    return;
  }

  const endpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT;
  const websiteId = import.meta.env.VITE_ANALYTICS_WEBSITE_ID;

  // Only load if both values are configured
  if (!endpoint || !websiteId) {
    console.warn('⚠️  Analytics not configured (missing VITE_ANALYTICS_ENDPOINT or VITE_ANALYTICS_WEBSITE_ID)');
    return;
  }

  try {
    const script = document.createElement('script');
    script.defer = true;
    script.src = `${endpoint}/umami`;
    script.setAttribute('data-website-id', websiteId);

    // Add error handler
    script.onerror = () => {
      console.error('❌ Failed to load analytics script');
    };

    // Add success handler
    script.onload = () => {
      console.log('✅ Analytics loaded successfully');
    };

    document.head.appendChild(script);
  } catch (error) {
    console.error('❌ Error loading analytics:', error);
  }
}

/**
 * Track custom event (if analytics is loaded)
 */
export function trackEvent(eventName: string, eventData?: Record<string, any>): void {
  if (typeof window !== 'undefined' && (window as any).umami) {
    (window as any).umami.track(eventName, eventData);
  }
}

/**
 * Track page view (if analytics is loaded)
 */
export function trackPageView(url?: string): void {
  if (typeof window !== 'undefined' && (window as any).umami) {
    (window as any).umami.track(url || window.location.pathname);
  }
}
