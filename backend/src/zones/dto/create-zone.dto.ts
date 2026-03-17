import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateZoneDto {
  @IsNotEmpty()
  @IsString()
  zoneName: string;

  @IsOptional()
  @IsString()
  zoneDescription?: string;

  @IsOptional()
  userID?: number;
}
