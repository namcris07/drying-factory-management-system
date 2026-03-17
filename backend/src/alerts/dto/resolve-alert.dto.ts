import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ResolveAlertDto {
  @IsNotEmpty()
  @IsString()
  resolveStatus: string;

  @IsOptional()
  @IsString()
  resolveNote?: string;

  @IsOptional()
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
}
