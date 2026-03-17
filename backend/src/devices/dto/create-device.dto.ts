import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateDeviceDto {
  @IsNotEmpty()
  @IsString()
  deviceName: string;

  @IsOptional()
  @IsString()
  deviceStatus?: string;

  @IsOptional()
  @IsString()
  mqttTopicSensor?: string;

  @IsOptional()
  @IsString()
  mqttTopicCmd?: string;

  @IsOptional()
  @IsString()
  deviceType?: string;

  @IsOptional()
  zoneID?: number;

  @IsOptional()
  metaData?: Record<string, unknown>;
}
