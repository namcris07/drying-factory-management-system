import { IsDateString, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateBatchDto {
  @IsOptional()
  @IsString()
  batchStatus?: string;

  @IsOptional()
  @IsString()
  operationMode?: string;

  @IsInt()
  recipeID: number;

  @IsOptional()
  @IsInt()
  deviceID?: number;

  @IsOptional()
  @IsInt()
  chamberID?: number;

  @IsOptional()
  @IsInt()
  organizationID?: number;

  @IsOptional()
  @IsInt()
  factoryID?: number;

  @IsOptional()
  @IsInt()
  siteID?: number;

  @IsDateString()
  startTime: string;
}

export class UpdateBatchDto {
  @IsOptional()
  @IsString()
  batchStatus?: string;

  @IsOptional()
  @IsString()
  batchResult?: string;

  @IsOptional()
  @IsInt()
  currentStep?: number;

  @IsOptional()
  @IsInt()
  currentStage?: number;

  @IsOptional()
  @IsInt()
  organizationID?: number;

  @IsOptional()
  @IsInt()
  factoryID?: number;

  @IsOptional()
  @IsInt()
  siteID?: number;
}
