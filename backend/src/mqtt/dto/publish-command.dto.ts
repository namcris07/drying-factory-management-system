import {
  IsBoolean,
  IsDefined,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class PublishCommandDto {
  @IsString()
  @IsNotEmpty()
  // Tên feed command ở Adafruit IO, ví dụ: fan_cmd, relay_cmd, led_cmd
  feed: string;

  @IsDefined()
  // Giá trị gửi xuống thiết bị: ON/OFF, số level, JSON string...
  value: unknown;

  @IsOptional()
  @IsBoolean()
  // true: cập nhật ngay state trên app để UI phản hồi nhanh
  optimisticSync?: boolean;
}
