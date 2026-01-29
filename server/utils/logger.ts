/**
 * Unified Logging System for Awareness Network
 *
 * Features:
 * - Multiple log levels (debug, info, warn, error)
 * - Environment-aware (development vs production)
 * - Structured logging with context
 * - Timestamp formatting
 * - Optional JSON output for production
 *
 * Usage:
 * import { logger } from './utils/logger';
 *
 * logger.info('User logged in', { userId: 123 });
 * logger.error('Database connection failed', { error });
 * logger.debug('Cache hit', { key: 'user:123' });
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogContext {
  [key: string]: unknown;
}

interface LoggerConfig {
  level: LogLevel;
  enableColors: boolean;
  enableTimestamps: boolean;
  jsonOutput: boolean;
  prefix?: string;
}

export class Logger {
  private config: LoggerConfig;
  private readonly colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',

    // Log level colors
    debug: '\x1b[36m',    // Cyan
    info: '\x1b[32m',     // Green
    warn: '\x1b[33m',     // Yellow
    error: '\x1b[31m',    // Red

    // Context colors
    gray: '\x1b[90m',
    white: '\x1b[37m',
  };

  constructor(config?: Partial<LoggerConfig>) {
    const nodeEnv = process.env.NODE_ENV || 'development';
    const isDevelopment = nodeEnv === 'development' || nodeEnv === 'test';

    this.config = {
      level: this.parseLogLevel(process.env.LOG_LEVEL || (isDevelopment ? 'DEBUG' : 'INFO')),
      enableColors: isDevelopment && process.stdout.isTTY,
      enableTimestamps: true,
      jsonOutput: !isDevelopment,
      ...config,
    };
  }

  private parseLogLevel(level: string): LogLevel {
    const upperLevel = level.toUpperCase();
    switch (upperLevel) {
      case 'DEBUG': return LogLevel.DEBUG;
      case 'INFO': return LogLevel.INFO;
      case 'WARN': return LogLevel.WARN;
      case 'ERROR': return LogLevel.ERROR;
      default: return LogLevel.INFO;
    }
  }

  private formatTimestamp(): string {
    const now = new Date();
    return now.toISOString();
  }

  private colorize(text: string, color: string): string {
    if (!this.config.enableColors) return text;
    return `${color}${text}${this.colors.reset}`;
  }

  private formatMessage(
    level: LogLevel,
    message: string,
    context?: LogContext
  ): string {
    const levelName = LogLevel[level];
    const timestamp = this.config.enableTimestamps ? this.formatTimestamp() : '';

    if (this.config.jsonOutput) {
      // JSON format for production (easy to parse by log aggregators)
      return JSON.stringify({
        timestamp,
        level: levelName,
        message,
        prefix: this.config.prefix,
        ...context,
      });
    }

    // Human-readable format for development
    const parts: string[] = [];

    if (timestamp) {
      parts.push(this.colorize(`[${timestamp}]`, this.colors.gray));
    }

    // Level indicator with color
    let levelColor: string;
    switch (level) {
      case LogLevel.DEBUG:
        levelColor = this.colors.debug;
        break;
      case LogLevel.INFO:
        levelColor = this.colors.info;
        break;
      case LogLevel.WARN:
        levelColor = this.colors.warn;
        break;
      case LogLevel.ERROR:
        levelColor = this.colors.error;
        break;
      default:
        levelColor = this.colors.white;
    }

    parts.push(this.colorize(`[${levelName}]`, levelColor));

    if (this.config.prefix) {
      parts.push(this.colorize(`[${this.config.prefix}]`, this.colors.bright));
    }

    parts.push(message);

    // Add context if provided
    if (context && Object.keys(context).length > 0) {
      const contextStr = JSON.stringify(context, this.jsonReplacer, 2);
      parts.push(this.colorize(contextStr, this.colors.gray));
    }

    return parts.join(' ');
  }

  private jsonReplacer(_key: string, value: unknown): unknown {
    // Handle errors specially
    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: value.stack,
      };
    }
    return value;
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    // Check if this log level is enabled
    if (level < this.config.level) {
      return;
    }

    const formatted = this.formatMessage(level, message, context);

    // Output to appropriate stream
    if (level >= LogLevel.ERROR) {
      console.error(formatted);
    } else if (level >= LogLevel.WARN) {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
  }

  /**
   * Log debug message (verbose information for development)
   */
  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log informational message (general information)
   */
  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log warning message (potential issues)
   */
  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log error message (errors and exceptions)
   */
  error(message: string, context?: LogContext): void {
    this.log(LogLevel.ERROR, message, context);
  }

  /**
   * Create a child logger with a prefix
   */
  child(prefix: string): Logger {
    return new Logger({
      ...this.config,
      prefix: this.config.prefix ? `${this.config.prefix}:${prefix}` : prefix,
    });
  }
}

// Export singleton instance
export const logger = new Logger();

// Export factory for creating prefixed loggers
export function createLogger(prefix: string): Logger {
  return logger.child(prefix);
}

// Compatibility exports for gradual migration
export default logger;
