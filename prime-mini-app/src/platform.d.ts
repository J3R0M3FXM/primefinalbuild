export {};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand?: () => void;
        colorScheme?: 'light' | 'dark';
        themeParams?: Record<string, string>;
        Serverless?: {
          call: <T>(
            name: string,
            input: Record<string, unknown>,
            callback: (error: TelegramServerlessError | null, result?: T) => void,
          ) => void;
        };
      };
    };
  }
}

export interface TelegramServerlessError extends Error {
  type?: string;
  status?: number;
  parameters?: Record<string, unknown>;
}
