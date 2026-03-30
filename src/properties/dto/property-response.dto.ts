import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';
import { IsString, IsOptional, IsNumber, IsEnum, IsDate, MaxLength, Min, Max, ValidateNested } from 'class-validator';
import { AddressDto, PropertyType, PropertyStatus } from './create-property.dto';

@Exclude()
export class PropertyResponseDto {
  @Expose()
  @ApiProperty({
    description: 'Property unique identifier',
    example: 'prop_abc123',
  })
  @IsString()
  id: string;

  @Expose()
  @ApiProperty({
    description: 'Property title',
    example: 'Luxury Downtown Apartment',
  })
  @IsString()
  @MaxLength(200)
  title: string;

  @Expose()
  @ApiPropertyOptional({
    description: 'Property description',
    example: 'Beautiful 2-bedroom apartment with city views',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @Expose()
  @ApiProperty({
    description: 'Property price in USD',
    example: 500000,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  @Max(999999999999)
  price: number;

  @Expose()
  @ApiProperty({
    description: 'Property address',
    type: AddressDto,
  })
  @ValidateNested()
  @Type(() => AddressDto)
  address: AddressDto;

  @Expose()
  @ApiPropertyOptional({
    description: 'Property features',
    example: ['Swimming Pool', 'Garage'],
    type: [String],
  })
  @IsOptional()
  @IsString({ each: true })
  features?: string[];

  @Expose()
  @ApiPropertyOptional({
    description: 'Property type',
    enum: PropertyType,
    example: PropertyType.RESIDENTIAL,
  })
  @IsOptional()
  @IsEnum(PropertyType)
  type?: PropertyType;

  @Expose()
  @ApiProperty({
    description: 'Property status',
    enum: PropertyStatus,
    example: PropertyStatus.AVAILABLE,
  })
  @IsEnum(PropertyStatus)
  status: PropertyStatus;

  @Expose()
  @ApiPropertyOptional({
    description: 'Number of bedrooms',
    example: 3,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  bedrooms?: number;

  @Expose()
  @ApiPropertyOptional({
    description: 'Number of bathrooms',
    example: 2,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  bathrooms?: number;

  @Expose()
  @ApiPropertyOptional({
    description: 'Property size in square feet',
    example: 1500,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000000)
  areaSqFt?: number;

  @Expose()
  @ApiProperty({
    description: 'Property owner ID',
    example: 'user_abc123',
  })
  @IsString()
  ownerId: string;

  @Expose()
  @ApiProperty({
    description: 'Creation timestamp',
    example: '2024-01-15T08:00:00.000Z',
  })
  @Type(() => Date)
  @IsDate()
  createdAt: Date;

  @Expose()
  @ApiProperty({
    description: 'Last update timestamp',
    example: '2024-01-22T09:00:00.000Z',
  })
  @Type(() => Date)
  @IsDate()
  updatedAt: Date;


  constructor(partial: Partial<PropertyResponseDto>) {
    Object.assign(this, partial);
  }
}

@Exclude()
export class PropertyListItemDto {
  @Expose()
  @ApiProperty({
    description: 'Property unique identifier',
    example: 'prop_abc123',
  })
  @IsString()
  id: string;

  @Expose()
  @ApiProperty({
    description: 'Property title',
    example: 'Luxury Downtown Apartment',
  })
  @IsString()
  title: string;

  @Expose()
  @ApiProperty({
    description: 'Property price in USD',
    example: 500000,
  })
  @IsNumber()
  price: number;

  @Expose()
  @ApiProperty({
    description: 'Property address',
    type: AddressDto,
  })
  @ValidateNested()
  @Type(() => AddressDto)
  address: AddressDto;

  @Expose()
  @ApiProperty({
    description: 'Property type',
    enum: PropertyType,
    example: PropertyType.RESIDENTIAL,
  })
  @IsEnum(PropertyType)
  type: PropertyType;

  @Expose()
  @ApiProperty({
    description: 'Property status',
    enum: PropertyStatus,
    example: PropertyStatus.AVAILABLE,
  })
  @IsEnum(PropertyStatus)
  status: PropertyStatus;

  @Expose()
  @ApiPropertyOptional({
    description: 'Property size in square feet',
    example: 1500,
  })
  @IsOptional()
  @IsNumber()
  areaSqFt?: number;

  @Expose()
  @ApiProperty({
    description: 'Creation timestamp',
    example: '2024-01-15T08:00:00.000Z',
  })
  @Type(() => Date)
  @IsDate()
  createdAt: Date;

  constructor(partial: Partial<PropertyListItemDto>) {
    Object.assign(this, partial);
  }

  // SEO metadata fields for issue #260
  @ApiPropertyOptional({
    description: 'SEO meta title',
    example: 'Luxury Downtown Apartment - Prime Location',
  })
  metaTitle?: string;

  @ApiPropertyOptional({
    description: 'SEO meta description',
    example: 'Beautiful 2-bedroom apartment with city views, perfect for urban living',
  })
  metaDescription?: string;

  @ApiPropertyOptional({
    description: 'SEO meta keywords',
    example: ['luxury', 'apartment', 'downtown', 'city views', 'urban living'],
    type: [String],
  })
  metaKeywords?: string[];

}
