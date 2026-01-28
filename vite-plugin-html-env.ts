/**
 * Vite Plugin: HTML Environment Variable Replacement
 *
 * Replaces environment variables in HTML files during build
 * Syntax: %VITE_VAR_NAME% will be replaced with process.env.VITE_VAR_NAME
 */

import type { Plugin } from 'vite';

export function htmlEnvPlugin(): Plugin {
  return {
    name: 'html-env-replacement',
    transformIndexHtml(html) {
      // Replace %VITE_*% placeholders with actual environment variables
      return html.replace(/%VITE_(\w+)%/g, (match, envKey) => {
        const value = process.env[`VITE_${envKey}`];

        // If environment variable is not defined, return empty string
        // This prevents broken script tags in production
        if (value === undefined || value === null || value === '') {
          console.warn(`⚠️  Environment variable VITE_${envKey} is not defined`);
          return '';
        }

        return value;
      });
    },
  };
}
