import { BadRequestException, Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { DonationWebhookDto } from './dto/donation-webhook.dto';
import { PrismaService } from '../database/prisma/prisma.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { CacheService } from '../common/services/cache.service';
import { ConfigService } from '@nestjs/config';
import { EventEmitter } from 'events';
import * as crypto from 'crypto';

@Injectable()
export class DonationsService {
  private readonly logger = new Logger(DonationsService.name);
  private readonly usdRates = {
    USD: 1,
    EUR: 1.1,
    GBP: 1.25,
    BTC: 45000,
    ETH: 1800,
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchainService: BlockchainService,
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
    @Inject('DONATION_EVENTS') private readonly donationEvents: EventEmitter,
  ) {}

  private computeWebhookSignature(payload: any, secret: string): string {
    const payloadString = JSON.stringify(payload);
    return crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
  }

  private verifySignature(payload: any, signature: string | undefined) {
    const secret = process.env.DONATION_WEBHOOK_SECRET;
    if (!secret) {
      this.logger.error('Missing DONATION_WEBHOOK_SECRET environment variable');
      throw new Error('Webhook secret is not configured');
    }

    if (!signature) {
      this.logger.warn('Donation webhook called without signature header');
      throw new UnauthorizedException('Missing webhook signature');
    }

    const normalized = signature.replace(/^sha256=/, '').trim();
    const expected = this.computeWebhookSignature(payload, secret);

    const expectedBuffer = Buffer.from(expected, 'utf8');
    const incomingBuffer = Buffer.from(normalized, 'utf8');

    if (expectedBuffer.length !== incomingBuffer.length || !crypto.timingSafeEqual(expectedBuffer, incomingBuffer)) {
      this.logger.warn('Invalid webhook signature', { expected, normalized });
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }

  private convertToUsd(amount: number, currency: string): number {
    const upperCurrency = currency.toUpperCase();
    const rate = this.usdRates[upperCurrency] ?? 1;
    return Number(amount) * rate;
  }

  private async invalidateLeaderboardCache(): Promise<void> {
    try {
      const keys = await this.cacheService.keys('donations:leaderboard:*');
      await Promise.all(keys.map(key => this.cacheService.del(key)));
    } catch (err) {
      this.logger.warn('Could not invalidate donation leaderboard cache', err as Error);
    }
  }

  async processWebhook(payload: DonationWebhookDto, signature: string): Promise<any> {
    this.verifySignature(payload, signature);

    const donationModel = (this.prisma as any).donation;
    const existing = await donationModel.findUnique({
      where: { providerTransactionId: payload.providerTransactionId },
    });

    if (existing) {
      this.logger.log(`Duplicate donation webhook received for providerTransactionId=${payload.providerTransactionId}`);
      return { donation: existing, isDuplicate: true };
    }

    let donationStatus = 'PENDING';
    if (payload.blockchainHash) {
      const receipt = await this.blockchainService.getTransactionReceipt(payload.blockchainHash);
      if (!receipt) {
        throw new BadRequestException('Blockchain transaction not found');
      }

      if ((receipt as any).status === 1 && (receipt as any).confirmations >= 1) {
        donationStatus = 'CONFIRMED';
      } else {
        donationStatus = 'FAILED';
      }
    }

    const donation = await donationModel.create({
      data: {
        provider: payload.provider,
        providerTransactionId: payload.providerTransactionId,
        amount: payload.amount,
        currency: payload.currency,
        donorName: payload.donorName ?? null,
        donorEmail: payload.donorEmail ?? null,
        blockchainHash: payload.blockchainHash ?? null,
        status: donationStatus,
      },
    });

    this.logger.log(`Donation stored with id=${donation.id}, status=${donation.status}`);

    this.donationEvents.emit('donation.created', donation);
    await this.invalidateLeaderboardCache();

    return { donation, isDuplicate: false };
  }

  async getLeaderboard(options: {
    scope?: 'global' | 'project';
    projectId?: string;
    page?: number;
    limit?: number;
  }) {
    const scope = options.scope || 'global';
    const projectId = options.projectId;
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, options.limit || 20);

    if (scope === 'project' && !projectId) {
      throw new BadRequestException('projectId is required when scope=project');
    }

    const cacheKey = `donations:leaderboard:${scope}:${projectId || 'all'}:${page}:${limit}`;
    const ttl = this.configService.get<number>('DONATIONS_LEADERBOARD_TTL', 300);

    return this.cacheService.wrap(cacheKey, async () => {
      const where: any = { status: 'CONFIRMED' };
      if (scope === 'project') {
        where.projectId = projectId;
      }

      const donations = await (this.prisma as any).donation.findMany({
        where,
        include: { user: true },
      });

      const grouped = new Map<string, any>();

      donations.forEach((donation: any) => {
        const user = donation.user;
        const donationsPublic = user?.privacySettings?.donationsPublic !== false;

        const displayName = donationsPublic
          ? donation.donorName || user?.email || 'Anonymous'
          : 'Anonymous';
        const displayEmail = donationsPublic
          ? donation.donorEmail || user?.email || null
          : null;

        const key = donation.userId ? `user:${donation.userId}` : `anon:${displayEmail || displayName}`;

        const usdAmount = this.convertToUsd(Number(donation.amount), donation.currency);

        if (!grouped.has(key)) {
          grouped.set(key, {
            donorId: donation.userId || null,
            donorName: displayName,
            donorEmail: displayEmail,
            totalUsd: 0,
            donationCount: 0,
            latestDonation: donation.createdAt,
          });
        }

        const current = grouped.get(key);
        current.totalUsd += usdAmount;
        current.donationCount += 1;
        if (new Date(donation.createdAt) > new Date(current.latestDonation)) {
          current.latestDonation = donation.createdAt;
        }
      });

      const leaderboard = Array.from(grouped.values())
        .sort((a, b) => b.totalUsd - a.totalUsd)
        .slice(0, 100);

      const totalCount = leaderboard.length;
      const start = (page - 1) * limit;
      const resultPage = leaderboard.slice(start, start + limit);

      return {
        scope,
        projectId: projectId || null,
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        data: resultPage,
      };
    }, { ttl });
  }

  async getDonation(providerTransactionId: string) {
    return (this.prisma as any).donation.findUnique({ where: { providerTransactionId } });
  }
}
