import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Logger, LogLevel, createLogger } from './logger';

describe('Logger', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('Log Levels', () => {
    it('should log debug messages when level is DEBUG', () => {
      const logger = new Logger({ level: LogLevel.DEBUG, enableColors: false });
      logger.debug('Debug message');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('DEBUG')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Debug message')
      );
    });

    it('should log info messages', () => {
      const logger = new Logger({ level: LogLevel.INFO, enableColors: false });
      logger.info('Info message');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('INFO')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Info message')
      );
    });

    it('should log warning messages', () => {
      const logger = new Logger({ level: LogLevel.WARN, enableColors: false });
      logger.warn('Warning message');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('WARN')
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Warning message')
      );
    });

    it('should log error messages', () => {
      const logger = new Logger({ level: LogLevel.ERROR, enableColors: false });
      logger.error('Error message');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('ERROR')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error message')
      );
    });

    it('should respect log level filtering', () => {
      const logger = new Logger({ level: LogLevel.WARN, enableColors: false });

      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message');

      // DEBUG and INFO should be filtered out
      expect(consoleLogSpy).not.toHaveBeenCalled();

      // WARN and ERROR should be logged
      expect(consoleWarnSpy).toHaveBeenCalledOnce();
      expect(consoleErrorSpy).toHaveBeenCalledOnce();
    });
  });

  describe('Context Logging', () => {
    it('should log with context object', () => {
      const logger = new Logger({ level: LogLevel.INFO, enableColors: false, jsonOutput: false });
      logger.info('User action', { userId: 123, action: 'login' });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('User action')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('userId')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('123')
      );
    });

    it('should handle Error objects in context', () => {
      const logger = new Logger({ level: LogLevel.ERROR, enableColors: false, jsonOutput: false });
      const error = new Error('Test error');

      logger.error('Operation failed', { error: error.message });

      const firstCall = consoleErrorSpy.mock.calls[0]?.join(' ') || '';
      expect(firstCall).toContain('Operation failed');
      expect(firstCall).toContain('Test error');
    });
  });

  describe('JSON Output', () => {
    it('should output JSON format when jsonOutput is enabled', () => {
      const logger = new Logger({ level: LogLevel.INFO, jsonOutput: true, enableTimestamps: true });
      logger.info('Test message', { key: 'value' });

      const call = consoleLogSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(call);

      expect(parsed).toHaveProperty('timestamp');
      expect(parsed).toHaveProperty('level', 'INFO');
      expect(parsed).toHaveProperty('message', 'Test message');
      expect(parsed).toHaveProperty('key', 'value');
    });
  });

  describe('Child Loggers', () => {
    it('should create child logger with prefix', () => {
      const logger = new Logger({ level: LogLevel.INFO, enableColors: false });
      const childLogger = logger.child('Database');

      childLogger.info('Connection established');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Database]')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Connection established')
      );
    });

    it('should support nested child loggers', () => {
      const logger = new Logger({ level: LogLevel.INFO, enableColors: false });
      const dbLogger = logger.child('Database');
      const mysqlLogger = dbLogger.child('MySQL');

      mysqlLogger.info('Query executed');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Database:MySQL]')
      );
    });
  });

  describe('Factory Function', () => {
    it('should create logger with prefix using factory', () => {
      const authLogger = createLogger('Auth');
      authLogger.info('User authenticated');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Auth]')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('User authenticated')
      );
    });
  });

  describe('Timestamps', () => {
    it('should include timestamp when enabled', () => {
      const logger = new Logger({ level: LogLevel.INFO, enableColors: false, enableTimestamps: true });
      logger.info('Test message');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/)
      );
    });

    it('should not include timestamp when disabled', () => {
      const logger = new Logger({ level: LogLevel.INFO, enableColors: false, enableTimestamps: false });
      logger.info('Test message');

      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringMatching(/\[\d{4}-\d{2}-\d{2}T/)
      );
    });
  });
});
