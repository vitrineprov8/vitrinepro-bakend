import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Coupon } from './coupon.entity';
import { User } from '../users/user.entity';

export enum RedemptionStatus {
  PENDING_VALIDATION = 'PENDING_VALIDATION',
  VALIDATED = 'VALIDATED',
  REJECTED = 'REJECTED',
}

/** One redemption record per coupon × user pair — prevents duplicate use */
@Unique(['couponId', 'redeemedById'])
@Entity('coupon_redemptions')
export class CouponRedemption {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Coupon, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'couponId' })
  coupon: Coupon;

  @Column({ type: 'uuid' })
  couponId: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'redeemedById' })
  redeemedBy: User | null;

  @Column({ type: 'uuid', nullable: true })
  redeemedById: string | null;

  /** The subscription that triggered this redemption */
  @Column({ type: 'uuid', nullable: true })
  subscriptionId: string | null;

  @Column({ type: 'enum', enum: RedemptionStatus, default: RedemptionStatus.PENDING_VALIDATION })
  status: RedemptionStatus;

  @Column({ type: 'timestamp', nullable: true })
  validatedAt: Date | null;

  /** The admin who validated or rejected this redemption */
  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'validatedById' })
  validatedBy: User | null;

  @Column({ type: 'uuid', nullable: true })
  validatedById: string | null;

  /** True once the referral bonus (30 extra days) has been granted to the coupon owner */
  @Column({ type: 'boolean', default: false })
  bonusGranted: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
