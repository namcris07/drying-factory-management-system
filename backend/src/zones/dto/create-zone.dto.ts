import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateZoneDto {
  @IsNotEmpty()
  @IsString()
  zoneName: string;

  @IsOptional()
  @IsString()
  zoneDescription?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  userID?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  organizationID?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  factoryID?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  siteID?: number;
}
