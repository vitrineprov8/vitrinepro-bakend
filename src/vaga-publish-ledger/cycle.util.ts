import { User, PlanStatus } from '../users/user.entity';

export interface BillingCycle {
  start: Date;
  end: Date;
}

/**
 * Derives the current billing cycle for a user.
 *
 * - Paid plans with an active subscription: the cycle is the 30-day window
 *   ending at `planExpiresAt`.  Example: if the plan expires on 2026-06-10,
 *   the current cycle runs from 2026-05-11 00:00:00 UTC to 2026-06-10 00:00:00 UTC.
 *
 * - FREE users (or users with an expired subscription): the cycle is the
 *   current calendar month in UTC (from the 1st at 00:00 to the 1st of the
 *   next month at 00:00, exclusive end).
 *
 * The cycle `end` is used as the exclusive upper bound in queries
 * (publishedAt >= start AND publishedAt < end).
 */
export function getCurrentCycle(user: User): BillingCycle {
  const now = new Date();

  const isSubscriptionActive =
    user.planStatus === PlanStatus.ACTIVE &&
    user.planExpiresAt !== null &&
    user.planExpiresAt > now;

  if (isSubscriptionActive && user.planExpiresAt) {
    // Paid plan: rolling 30-day window ending at plan expiry
    const end = user.planExpiresAt;
    const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { start, end };
  }

  // FREE / expired: calendar month in UTC
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}
