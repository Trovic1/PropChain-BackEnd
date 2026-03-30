/**
 * @fileoverview Service for handling user reputation logic.
 * This service is designed to be used within Prisma transactions to ensure atomicity.
 * @issue #207
 */

import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UpdateReputationDto } from './dto/update-reputation.dto';

type PrismaTransactionalClient = Omit<
  Prisma.DefaultPrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use'
>;

@Injectable()
export class ReputationService {
  private readonly logger = new Logger(ReputationService.name);

  /**
   * Updates a user's reputation score and logs the action.
   * This method is designed to be called within a Prisma transaction.
   *
   * @param tx - The Prisma transactional client.
   * @param dto - The data for the reputation update.
   */
  async updateReputationOnAction(
    tx: PrismaTransactionalClient,
    dto: UpdateReputationDto,
  ): Promise<void> {
    const { userId, action, points } = dto;

    this.logger.log(
      `Updating reputation for user ${userId} due to action '${action}' by ${points} points.`,
    );

    // Use the transactional client to update the user's reputation
    await tx.user.update({
      where: { id: userId },
      data: {
        reputation: {
          increment: points,
        },
      },
    });
  }
}