import { IsOptional, IsString, IsInt } from 'class-validator';

export class CreateBatchDto {
  @IsOptional()
  @IsString()
  batchStatus?: string;

  @IsOptional()
  @IsString()
  operationMode?: string;

  @IsOptional()
  @IsInt()
  recipeID?: number;

  @IsOptional()
  @IsInt()
  deviceID?: number;
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
}
