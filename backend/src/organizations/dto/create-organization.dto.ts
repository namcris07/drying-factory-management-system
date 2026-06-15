import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateOrganizationDto {
  @IsNotEmpty()
  @IsString()
  organizationName: string;

  @IsOptional()
  @IsString()
  organizationCode?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
