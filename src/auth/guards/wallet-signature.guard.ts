import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WalletSignatureService } from './wallet-signature.service';

/**
 * Wallet Signature Guard
 * 
 * Protects endpoints by requiring valid wallet signature verification.
 * This guard addresses issue #270 by ensuring wallet ownership is verified.
 */
@Injectable()
export class WalletSignatureGuard {
  constructor(
    private readonly walletSignatureService: WalletSignatureService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    // Check if user has a wallet address
    if (!user.walletAddress) {
      throw new UnauthorizedException('User must have a wallet address for this operation');
    }

    // Verify wallet ownership using signature
    try {
      this.walletSignatureService.verifyWalletOwnership(request, user.walletAddress);
      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid wallet signature');
    }
  }
}
