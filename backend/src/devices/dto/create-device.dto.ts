import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class CreateDeviceDto {
  @IsNotEmpty()
  @IsString()
  deviceName: string;

  @IsOptional()
  @IsString()
  deviceStatus?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9._/-]+$/, {
    message: 'Feed key chỉ cho phép ký tự a-z, A-Z, 0-9, ., _, /, -',
  })
  mqttTopicSensor?: string;

  @IsOptional()
  @IsString()
  @IsIn(['TemperatureSensor', 'HumiditySensor', 'Fan', 'Led', 'Lcd'])
  deviceType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  zoneID?: number;

  @IsOptional()
  @IsObject()
  metaData?: Record<string, unknown>;
}
