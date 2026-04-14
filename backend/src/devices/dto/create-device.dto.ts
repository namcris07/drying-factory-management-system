import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

const parseSensorFeeds = (input: unknown): string[] => {
  if (Array.isArray(input)) {
    return input.map((item) => String(item ?? '').trim()).filter(Boolean);
  }

  if (typeof input === 'string') {
    return input
      .split(/[\n,;]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

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
  @Transform(({ value }) => parseSensorFeeds(value))
  @IsArray()
  @IsString({ each: true })
  sensorFeeds?: string[];

  @IsOptional()
  @IsString()
  mqttTopicCmd?: string;

  @IsOptional()
  @IsString()
  deviceType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  zoneID?: number;

  @IsOptional()
  @IsObject()
  metaData?: Record<string, unknown>;
}
