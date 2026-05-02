import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class ResolveAlertDto {
  @IsNotEmpty()
  @IsString()
  resolveStatus!: string;

  @IsOptional()
  @IsString()
  resolveNote?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userID?: number;
}

export class CreateAlertDto {
  @IsOptional()
  @IsString()
  alertType?: string;

  @IsOptional()
  @IsString()
  alertMessage?: string;

  @IsOptional()
  @IsString()
  alertStatus?: string;

  @IsOptional()
  deviceID?: number;

  @IsOptional()
  batchesID?: number;

  @IsOptional()
  organizationID?: number;

  @IsOptional()
  factoryID?: number;

  @IsOptional()
  siteID?: number;
}
