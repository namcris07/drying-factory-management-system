import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity('SensorLog')
export class SensorLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'deviceId', type: 'varchar', length: 255 })
  deviceId: string;

  @Column({ name: 'sensorType', type: 'varchar', length: 100 })
  sensorType: string;

  @Column({ name: 'value', type: 'float' })
  value: number;

  @CreateDateColumn({ name: 'timestamp' })
  timestamp: Date;
}
