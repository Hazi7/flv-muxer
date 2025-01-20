/**
 * 表示可能的日志级别。
 */
type LogLevel = 'info' | 'warn' | 'error' | 'debug';

/**
 * Logger 类用于处理不同日志级别的日志记录。
 */
export class Logger {
  /**
   * 当前日志记录器的日志级别。
   * @default 'debug'
   */
  static logLevel: LogLevel = 'debug';

  /**
   * 设置日志记录器的日志级别。
   * @param level - 要设置的日志级别。
   */
  static setLogLevel(level: LogLevel) {
    this.logLevel = level;
  }

  /**
   * 确定给定日志级别的消息是否应被记录。
   * @param level - 消息的日志级别。
   * @returns 一个布尔值，指示消息是否应被记录。
   */
  private static canLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.logLevel);
  }

  /**
   * 使用时间戳和日志级别将日志消息打印到控制台。
   * @param level - 消息的日志级别。
   * @param message - 要记录的消息。
   */
  private static printMessage(level: LogLevel, message: string) {
    const timestamp = new Date().toISOString();
    console[level](`[${timestamp}] [${level.toUpperCase()}] ${message}`);
  }

  /**
   * 记录调试消息。
   * @param message - 要记录的调试消息。
   */
  static debug(message: string) {
    if (this.canLog('debug')) {
      this.printMessage('debug', message);
    }
  }

  /**
   * 记录信息性消息。
   * @param message - 要记录的信息性消息。
   */
  static info(message: string) {
    if (this.canLog('info')) {
      this.printMessage('info', message);
    }
  }

  /**
   * 记录警告消息。
   * @param message - 要记录的警告消息。
   */
  static warn(message: string) {
    if (this.canLog('warn')) {
      this.printMessage('warn', message);
    }
  }

  /**
   * 记录错误消息。
   * @param message - 要记录的错误消息。
   */
  static error(message: string) {
    if (this.canLog('error')) {
      this.printMessage('error', message);
    }
  }
}
