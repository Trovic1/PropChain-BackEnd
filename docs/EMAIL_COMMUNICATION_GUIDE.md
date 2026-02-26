# Email and Communication System Guide

This guide covers the comprehensive email and communication system implemented in the PropChain Backend project, providing advanced features for multi-channel communication, automation, and deliverability optimization.

## Table of Contents

- [Overview](#overview)
- [Email Template System](#email-template-system)
- [Email Automation and Workflows](#email-automation-and-workflows)
- [Multi-Channel Communication](#multi-channel-communication)
- [Email Analytics and Tracking](#email-analytics-and-tracking)
- [Email Scheduling and Batch Processing](#email-scheduling-and-batch-processing)
- [Email Personalization and A/B Testing](#email-personalization-and-ab-testing)
- [Email Preference Management](#email-preference-management)
- [Email Deliverability Optimization](#email-deliverability-optimization)
- [Configuration](#configuration)
- [Best Practices](#best-practices)

## Overview

The communication system provides enterprise-grade email and multi-channel communication capabilities with:

- **Dynamic Email Templates** - Personalized content with conditional logic
- **Advanced Automation** - Workflow-based triggers and actions
- **Multi-Channel Support** - Email, SMS, Push, In-App, Webhook
- **Comprehensive Analytics** - Real-time tracking and performance metrics
- **Intelligent Scheduling** - Batch processing and timed delivery
- **A/B Testing** - Automated testing and optimization
- **Preference Management** - User-controlled communication preferences
- **Deliverability Optimization** - Sender reputation and inbox placement

## Email Template System

### Template Rendering

The `EmailTemplateService` provides powerful template rendering with:

```typescript
// Basic template rendering
const rendered = templateService.renderTemplate('welcome', {
  firstName: 'John',
  verificationUrl: 'https://app.propchain.com/verify/abc123'
});

// A/B testing variant
const variant = templateService.createABTestVariant('welcome', 'A', {
  subject: 'Welcome to PropChain, John! 🎉'
});

// Template preview
const preview = templateService.previewTemplate('welcome', data);
```

### Template Features

- **Dynamic Content** - Variable substitution with dot notation
- **Conditional Blocks** - `{{#if condition}}...{{/if}}`
- **Loop Blocks** - `{{#each items}}...{{/each}}`
- **Localization** - Multi-language template support
- **A/B Testing** - Built-in variant creation
- **Preview Mode** - Test templates with sample data

### Template Types

- **Welcome Emails** - User onboarding and verification
- **Transaction Emails** - Password resets, notifications, alerts
- **Marketing Emails** - Newsletters, promotions, announcements
- **Security Emails** - Login alerts, suspicious activity warnings

## Email Automation and Workflows

### Workflow Engine

The `WorkflowService` enables complex automated communication:

```typescript
// Create custom workflow
const workflow = await workflowService.createWorkflow({
  name: 'Cart Recovery',
  description: 'Recover abandoned shopping carts',
  steps: [
    {
      id: 'check_cart',
      type: 'condition',
      config: { condition: 'context.event.data.cartValue > 50' }
    },
    {
      id: 'send_recovery_email',
      type: 'send_email',
      config: { templateName: 'cart_recovery' }
    }
  ]
});

// Execute workflow
const result = await workflowService.executeWorkflow('cart_recovery', {
  userId: 'user_123',
  trigger: 'cart_abandoned',
  event: {
    type: 'cart_abandoned',
    data: { cartValue: 75, items: 3 }
  }
});
```

### Workflow Capabilities

- **Trigger System** - Event-based workflow initiation
- **Step Types** - Email, SMS, Push, Delay, Condition, Webhook, Script
- **Conditional Logic** - Complex decision trees and branching
- **Error Handling** - Step-level failure handling and retry logic
- **Scheduling** - Time-based and recurring workflow execution

### Built-in Workflows

- **Welcome Series** - Multi-step onboarding sequence
- **Cart Recovery** - Abandoned cart email series
- **Re-engagement** - Inactive user reactivation campaigns
- **Security Alerts** - Suspicious activity notifications

## Multi-Channel Communication

### Channel Support

The `MultichannelService` provides unified communication across:

```typescript
// Send via multiple channels
const result = await multichannelService.sendMultichannel(
  'user_123',
  {
    subject: 'Security Alert',
    content: 'New login detected from new device',
    priority: 'high'
  },
  ['email', 'sms', 'push'],
  {
    email: { priority: 'high' },
    sms: { priority: 'high' },
    push: { priority: 'normal' }
  }
);

// Channel-specific sending
await multichannelService.sendSMS('+1234567890', 'Your verification code is 123456');
await multichannelService.sendPushNotification('user_123', {
  title: 'New Message',
  body: 'You have a new notification'
});
```

### Supported Channels

- **Email** - Rich HTML templates with tracking
- **SMS** - Transactional and marketing messages
- **Push Notifications** - Mobile app notifications with actions
- **In-App** - Real-time application notifications
- **Webhook** - HTTP callbacks to external systems
- **Slack/Discord** - Team communication integrations

### Channel Features

- **Fallback Logic** - Automatic channel switching on failure
- **Rate Limiting** - Per-channel throttling
- **Personalization** - Channel-specific content adaptation
- **Analytics** - Unified tracking across all channels

## Email Analytics and Tracking

### Real-time Analytics

The `EmailAnalyticsService` provides comprehensive tracking:

```typescript
// Track email events
await analyticsService.trackEmailSent({
  emailId: 'email_123',
  templateName: 'welcome',
  recipientCount: 1,
  provider: 'smtp',
  deliveryTime: 1200,
  success: true
});

// Get template performance
const performance = await analyticsService.getTemplatePerformance('welcome', {
  start: new Date('2024-01-01'),
  end: new Date('2024-01-31')
});

// A/B test results
const abTest = await analyticsService.getABTestResults('welcome_test_2024');
```

### Analytics Features

- **Delivery Tracking** - Sent, delivered, bounced, complained
- **Engagement Tracking** - Opens, clicks, read status
- **Performance Metrics** - Delivery rates, open rates, click-through rates
- **A/B Testing** - Statistical significance and winner determination
- **Real-time Monitoring** - Live dashboards and alerts

### Tracking Implementation

- **Tracking Pixels** - Automatic open tracking pixel insertion
- **Tracking Links** - Click tracking with link IDs
- **Webhook Events** - Real-time delivery status updates
- **Bounce Processing** - Automated bounce handling and list cleaning

## Email Scheduling and Batch Processing

### Advanced Queue System

The `EmailQueueService` provides enterprise-grade queuing:

```typescript
// Schedule email for later
const jobId = await queueService.addScheduled(emailData, new Date('2024-01-15 09:00'));

// Batch email processing
const batchResult = await queueService.addBatch([
  { data: email1, metadata: { campaignId: 'campaign_1' } },
  { data: email2, metadata: { campaignId: 'campaign_1' } },
  { data: email3, metadata: { campaignId: 'campaign_1' } }
], {
  rateLimit: 1000, // 1 second between emails
  maxConcurrency: 5
});

// High priority email
await queueService.addHighPriority(securityAlert);
```

### Queue Features

- **Priority Queues** - Separate queues for different priority levels
- **Rate Limiting** - Configurable throttling between sends
- **Retry Logic** - Exponential backoff with max attempts
- **Batch Processing** - Efficient bulk email handling
- **Monitoring** - Real-time queue statistics and health

### Scheduling Capabilities

- **Time Zone Support** - User-localized scheduling
- **Recurring Jobs** - Daily, weekly, monthly automated sends
- **Optimal Send Times** - AI-powered send time optimization
- **Volume Control** - Daily/hourly sending limits

## Email Personalization and A/B Testing

### Dynamic Personalization

The system supports advanced personalization:

```typescript
// Personalized email with rules
const result = await emailService.sendPersonalizedEmail(
  'user@example.com',
  'welcome',
  baseData,
  [
    {
      condition: 'data.userType === "premium"',
      transformation: {
        type: 'set',
        field: 'premiumFeatures',
        value: 'Get premium support and exclusive features!'
      }
    }
  ]
);
```

### A/B Testing Framework

- **Automated Testing** - Split traffic between variants
- **Statistical Analysis** - Confidence intervals and significance testing
- **Winner Selection** - Automatic winner determination
- **Traffic Allocation** - Configurable percentage splits
- **Test Duration** - Time-based or conversion-based test ending

### Personalization Features

- **Conditional Content** - Rules-based content variation
- **Dynamic Variables** - User data integration
- **Behavioral Targeting** - Past interaction-based content
- **Demographic Segmentation** - Age, location, preference-based targeting

## Email Preference Management

### Comprehensive Preferences

The `PreferenceService` provides full user control:

```typescript
// Get user preferences
const preferences = await preferenceService.getUserPreferences('user_123');

// Update specific channel preferences
await preferenceService.updateEmailPreferences('user_123', {
  marketing: false,
  frequency: 'daily'
});

// Unsubscribe from specific type
await preferenceService.unsubscribe('user_123', 'email', 'marketing', 'token_abc123');
```

### Preference Features

- **Channel Control** - Enable/disable per communication channel
- **Content Types** - Marketing, transactional, security preferences
- **Frequency Control** - Immediate, hourly, daily, weekly delivery
- **Quiet Hours** - Do-not-disturb time windows
- **Bulk Operations** - Import/export preference management

### Unsubscribe System

- **Token-based Unsubscribes** - Secure, time-limited unsubscribe links
- **One-click Unsubscribes** - Easy opt-out for all communications
- **Preference Centers** - User-friendly preference management interface
- **Compliance Reporting** - CAN-SPAM compliance and audit trails

## Email Deliverability Optimization

### Sender Reputation Management

The `DeliverabilityService` ensures maximum inbox placement:

```typescript
// Analyze deliverability
const analysis = await deliverabilityService.analyzeDeliverability({
  emailId: 'email_123',
  sender: 'noreply@propchain.com',
  recipients: ['user@example.com'],
  subject: 'Welcome to PropChain',
  content: '<h1>Welcome!</h1>'
});

// IP warmup
const warmupResult = await deliverabilityService.warmupIP('192.168.1.100', {
  name: 'Standard Warmup',
  durationDays: 14,
  dailyVolume: [10, 20, 40, 60, 100, 200, 300, 500, 800, 1000]
});

// Get recommendations
const recommendations = await deliverabilityService.getDeliverabilityRecommendations('noreply@propchain.com');
```

### Deliverability Features

- **Reputation Monitoring** - Real-time sender score tracking
- **Authentication Setup** - SPF, DKIM, DMARC configuration guidance
- **Content Optimization** - Spam trigger detection and avoidance
- **List Hygiene** - Automated email list cleaning and validation
- **IP Warmup** - Gradual IP reputation building
- **Inbox Placement** - Gmail, Outlook, Yahoo optimization

### Optimization Tools

- **Content Analysis** - Spam score calculation and improvement suggestions
- **Technical Audit** - DNS records, authentication setup verification
- **Performance Monitoring** - Delivery rates, bounce rates, complaint tracking
- **Recommendation Engine** - AI-powered optimization suggestions

## Configuration

### Environment Variables

```bash
# Email Configuration
EMAIL_FROM=noreply@propchain.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Multi-channel Configuration
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
FIREBASE_SERVER_KEY=your_firebase_key

# Queue Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# Deliverability Configuration
DEFAULT_SENDER_EMAIL=noreply@propchain.com
PREFERENCE_EXPORT_SECRET=your_export_secret
BASE_URL=https://api.propchain.com
```

### Service Configuration

```typescript
// app.module.ts
import { CommunicationModule } from './communication/communication.module';

@Module({
  imports: [
    CommunicationModule.forRoot({
      email: {
        templates: {
          path: './templates',
          defaultLocale: 'en'
        },
        providers: {
          smtp: {
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true'
          }
        }
      },
      multichannel: {
        providers: {
          sms: 'twilio',
          push: 'firebase'
        }
      },
      analytics: {
        tracking: {
          enabled: true,
          pixelDomain: 'track.propchain.com'
        }
      }
    })
  ],
})
export class AppModule {}
```

## Best Practices

### 1. Template Management

- **Keep Templates Simple** - Avoid complex nested structures
- **Mobile-First Design** - Ensure templates work on all devices
- **Test Thoroughly** - Preview across email clients and devices
- **Use Semantic HTML** - Proper heading structure and accessibility
- **Include Plain Text** - Fallback for email clients that don't support HTML

### 2. Personalization Strategies

- **Use Real Data** - Leverage user behavior and preferences
- **Avoid Over-Personalization** - Don't be creepy with excessive personal data
- **Test Personalization Rules** - Ensure conditional logic works correctly
- **Respect Privacy** - Follow data protection regulations
- **Segment Appropriately** - Group users by behavior, not just demographics

### 3. Deliverability Optimization

- **Warm Up New IPs** - Gradually increase sending volume
- **Monitor Reputation** - Track sender scores across providers
- **Clean Lists Regularly** - Remove invalid addresses and complainers
- **Use Authentication** - Implement SPF, DKIM, and DMARC
- **Test Before Sending** - Use seed lists and spam checkers

### 4. Analytics and Monitoring

- **Track Key Metrics** - Monitor delivery, open, and click rates
- **Set Up Alerts** - Immediate notification of deliverability issues
- **Analyze A/B Tests** - Use statistical significance testing
- **Monitor Sender Health** - Track reputation across all sending domains
- **Use Real-time Dashboards** - Live monitoring of campaign performance

### 5. Compliance and Legal

- **Honor Unsubscribes** - Process opt-outs promptly
- **Include Physical Address** - When required by law
- **Provide Clear Privacy Policy** - Transparent data usage explanation
- **Follow CAN-SPAM Rules** - Include unsubscribe links and physical addresses
- **Maintain Audit Trails** - Log all consent and preference changes

### 6. Performance Optimization

- **Use Queue Systems** - Prevent overwhelming receiving servers
- **Implement Rate Limiting** - Respect provider and ISP limits
- **Optimize Send Times** - Schedule for optimal engagement
- **Monitor Queue Health** - Prevent bottlenecks and failures
- **Use Connection Pooling** - Efficient SMTP connection management

## Troubleshooting

### Common Issues

1. **Low Delivery Rates**
   - Check sender reputation
   - Verify SPF/DKIM/DMARC records
   - Clean email lists
   - Reduce sending frequency

2. **High Spam Complaints**
   - Review content for spam triggers
   - Ensure proper consent
   - Check list acquisition methods
   - Improve personalization relevance

3. **Template Rendering Issues**
   - Verify template syntax
   - Check data variable availability
   - Test with sample data
   - Review conditional logic

4. **Queue Bottlenecks**
   - Monitor queue sizes
   - Check worker counts
   - Review processing times
   - Scale horizontally if needed

### Debug Tools

```typescript
// Enable debug logging
const logger = new Logger('EmailService', { level: 'debug' });

// Test email configuration
const testResult = await emailService.testConfiguration();

// Preview templates
const preview = templateService.previewTemplate('welcome', testData);

// Check queue status
const stats = await queueService.getAllQueueStats();
```

## Conclusion

The email and communication system provides enterprise-grade capabilities for managing all aspects of digital communication. With advanced templates, automation, multi-channel support, analytics, and deliverability optimization, it ensures reliable and effective communication with your users.

For questions or contributions to the communication system, please refer to the development team or create an issue in the project repository.
