import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import * as StellarSdk from 'stellar-sdk';

/**
 * Wallet Signature Verification Service
 * 
 * Handles verification of Stellar wallet signatures to authenticate users.
 * This service addresses issue #270 by ensuring that wallet address ownership
 * is verified before allowing sensitive operations like email updates.
 */
@Injectable()
export class WalletSignatureService {
  private readonly logger = new Logger(WalletSignatureService.name);

  /**
   * Verify Stellar wallet signature
   * 
   * @param signature - The signature from x-signature header
   * @param walletAddress - The wallet address claiming ownership
   * @param message - The message that was signed (default: "Login to SoroSusu")
   * @returns {boolean} True if signature is valid
   * @throws {UnauthorizedException} If signature is invalid
   */
  verifySignature(signature: string, walletAddress: string, message: string = 'Login to SoroSusu'): boolean {
    try {
      if (!signature) {
        throw new UnauthorizedException('Signature is required');
      }

      if (!walletAddress) {
        throw new UnauthorizedException('Wallet address is required');
      }

      // Create a keypair from the wallet address
      const keypair = StellarSdk.Keypair.fromPublicKey(walletAddress);
      
      // Verify the signature
      const isValid = keypair.verify(message, signature);

      if (!isValid) {
        this.logger.warn(`Invalid signature for wallet ${walletAddress}`);
        throw new UnauthorizedException('Invalid signature');
      }

      this.logger.log(`Signature verified successfully for wallet ${walletAddress}`);
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      this.logger.error('Signature verification failed', error);
      throw new UnauthorizedException('Signature verification failed');
    }
  }

  /**
   * Extract signature from request headers
   * 
   * @param request - Express request object
   * @returns {string} The signature from x-signature header
   * @throws {UnauthorizedException} If signature header is missing
   */
  extractSignature(request: Request): string {
    const signature = request.headers['x-signature'] as string;

    if (!signature) {
      this.logger.warn('Missing x-signature header in request');
      throw new UnauthorizedException('x-signature header is required');
    }

    return signature;
  }

  /**
   * Verify wallet ownership for user update operations
   * 
   * @param request - Express request object
   * @param userWalletAddress - The user's stored wallet address
   * @returns {boolean} True if ownership is verified
   * @throws {UnauthorizedException} If ownership cannot be verified
   */
  verifyWalletOwnership(request: Request, userWalletAddress: string): boolean {
    try {
      const signature = this.extractSignature(request);
      
      if (!userWalletAddress) {
        throw new UnauthorizedException('User does not have a wallet address');
      }

      return this.verifySignature(signature, userWalletAddress);
    } catch (error) {
      this.logger.error('Wallet ownership verification failed', error);
      throw error;
    }
  }

  /**
   * Generate message for signing
   * 
   * @param customMessage - Optional custom message
   * @returns {string} Message to be signed by user
   */
  generateSigningMessage(customMessage?: string): string {
    return customMessage || 'Login to SoroSusu';
  }

  /**
   * Validate Stellar address format
   * 
   * @param address - The Stellar address to validate
   * @returns {boolean} True if address is valid
   */
  isValidStellarAddress(address: string): boolean {
    try {
      StellarSdk.StrKey.decodeEd25519PublicKey(address);
      return true;
    } catch (error) {
      return false;
    }
  }
}
