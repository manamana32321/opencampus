import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  async dispatch(url: string, payload: Record<string, unknown>): Promise<boolean> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        this.logger.warn(`Webhook ${url} returned ${response.status}`);
      }
      return response.ok;
    } catch (error) {
      this.logger.warn(`Webhook ${url} failed: ${error}`);
      return false;
    }
  }
}
