import { Body, Controller, Get, Headers, HttpCode, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DonationsService } from './donations.service';
import { DonationWebhookDto } from './dto/donation-webhook.dto';

@ApiTags('donations')
@Controller('donations')
export class DonationsController {
  constructor(private readonly donationsService: DonationsService) {}

  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'Receive payment provider donation webhook' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid payload or blockchain verification failed' })
  @ApiResponse({ status: 401, description: 'Invalid signature' })
  async handleWebhook(
    @Headers() headers: Record<string, string | undefined>,
    @Body() payload: DonationWebhookDto,
  ) {
    const signature = headers['x-donation-signature'] || headers['x-signature'];
    const result = await this.donationsService.processWebhook(payload, signature);
    const donationRecord = result?.donation ? result.donation : result;
    const isDuplicate = result?.isDuplicate ?? false;

    return {
      success: true,
      data: donationRecord,
      message: isDuplicate ? 'Donation already exists (duplicate webhook)' : 'Donation recorded',
    };
  }

  @Get('leaderboard')
  @ApiOperation({ summary: 'Get top donors leaderboard' })
  @ApiResponse({ status: 200, description: 'Leaderboard fetched successfully' })
  async getLeaderboard(
    @Query('scope') scope: 'global' | 'project' = 'global',
    @Query('projectId') projectId?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    const leaderboard = await this.donationsService.getLeaderboard({ scope, projectId, page, limit });
    return { success: true, data: leaderboard };
  }
}