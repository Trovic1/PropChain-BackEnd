/**
 * @fileoverview DTOs for reputation updates.
 * @issue #207
 */

import { IsInt, IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class UpdateReputationDto {
  @IsUUID()
  userId: string;

  @IsString()
  @IsNotEmpty()
  action: string;

  @IsInt()
  points: number;
}