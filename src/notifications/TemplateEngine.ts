import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class NotificationTemplateEngine {
  private readonly logger = new Logger(NotificationTemplateEngine.name);
  private templates: Map<string, { subject: string; body: string }>;

  constructor() {
    this.templates = new Map();
    this.registerDefaultTemplates();
  }

  /**
   * Render template with provided data variables
   */
  render(templateId: string, data: Record<string, any>) {
    const template = this.templates.get(templateId);
    if (!template) {
      this.logger.error(`Template not found: ${templateId}`);
      throw new Error(`TemplateNotFound: ${templateId}`);
    }

    const { subject, body } = template;
    return {
      subject: this.replaceVariables(subject, data),
      body: this.replaceVariables(body, data),
    };
  }

  private replaceVariables(text: string, data: Record<string, any>): string {
    return text.replace(/{{(\w+)}}/g, (match, key) => {
      return data[key] !== undefined ? String(data[key]) : match;
    });
  }

  private registerDefaultTemplates() {
    this.templates.set('WELCOME_EMAIL', {
      subject: 'Welcome to PropChain, {{name}}!',
      body: 'Hi {{name}}, we are excited to have you on board! Your account is now active.',
    });
    this.templates.set('TRANSACTION_CONFIRMED', {
      subject: 'Transaction Confirmed: {{txId}}',
      body: 'Great news! Your transaction for property {{propertyName}} has been confirmed on the blockchain.',
    });
    this.templates.set('SECURITY_ALERT', {
      subject: 'Security Alert: New Login from {{ip}}',
      body: 'A new login was detected from IP {{ip}}. If this was not you, please contact support immediately.',
    });
  }

  /**
   * Register a dynamic template during runtime or from DB
   */
  registerTemplate(id: string, subject: string, body: string) {
    this.templates.set(id, { subject, body });
  }
}
