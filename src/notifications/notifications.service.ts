import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from './notification.entity';
import {
  NotificationPreference,
  NOTIFICATION_DEFAULT_CHANNELS,
} from './notification-preference.entity';
import { User } from '../users/user.entity';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface NotificationChannelPreference {
  type: NotificationType;
  inAppEnabled: boolean;
  emailEnabled: boolean;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private notificationsRepository: Repository<Notification>,
    @InjectRepository(NotificationPreference)
    private preferencesRepository: Repository<NotificationPreference>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  /**
   * Cria uma notificação in-app, respeitando a preferência do usuário
   * (`inAppEnabled`). Fire-and-forget nos call sites (`void this.notifications...`)
   * — nunca deve derrubar a ação principal que está sendo notificada.
   */
  async create(input: CreateNotificationInput): Promise<Notification | null> {
    try {
      const pref = await this.preferencesRepository.findOne({
        where: { userId: input.userId, type: input.type },
      });
      const inAppEnabled = pref?.inAppEnabled ?? NOTIFICATION_DEFAULT_CHANNELS[input.type].inApp;
      if (!inAppEnabled) return null;

      const notification = this.notificationsRepository.create({
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        link: input.link ?? null,
        metadata: input.metadata ?? null,
      });
      return await this.notificationsRepository.save(notification);
    } catch (err) {
      this.logger.error(
        `Falha ao criar notificação (${input.type} para ${input.userId}): ${(err as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Mesma coisa que `create`, mas resolve o destinatário por e-mail — usado
   * em fluxos que só têm o e-mail no momento (ex.: convite de time por
   * e-mail, antes do convidado aceitar). Silenciosamente não faz nada se não
   * existir usuário com esse e-mail (ex.: convidado ainda não tem conta).
   */
  async createForEmailIfExists(
    email: string,
    rest: Omit<CreateNotificationInput, 'userId'>,
  ): Promise<Notification | null> {
    const user = await this.usersRepository.findOne({
      where: { email: email.toLowerCase() },
      select: ['id'],
    });
    if (!user) return null;
    return this.create({ ...rest, userId: user.id });
  }

  async list(
    userId: string,
    opts: { unreadOnly?: boolean; page?: number; limit?: number } = {},
  ): Promise<{ data: Notification[]; total: number; unreadCount: number; page: number; lastPage: number }> {
    const page = Math.max(opts.page ?? 1, 1);
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);

    const qb = this.notificationsRepository
      .createQueryBuilder('n')
      .where('n.userId = :userId', { userId });
    if (opts.unreadOnly) {
      qb.andWhere('n.readAt IS NULL');
    }

    const [data, total] = await qb
      .orderBy('n.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const unreadCount = await this.notificationsRepository
      .createQueryBuilder('n')
      .where('n.userId = :userId', { userId })
      .andWhere('n.readAt IS NULL')
      .getCount();

    return { data, total, unreadCount, page, lastPage: Math.ceil(total / limit) || 1 };
  }

  async markRead(id: string, userId: string): Promise<Notification> {
    const notification = await this.notificationsRepository.findOne({
      where: { id, userId },
    });
    if (!notification) throw new NotFoundException('Notificação não encontrada.');
    if (!notification.readAt) {
      notification.readAt = new Date();
      await this.notificationsRepository.save(notification);
    }
    return notification;
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await this.notificationsRepository
      .createQueryBuilder()
      .update(Notification)
      .set({ readAt: new Date() })
      .where('userId = :userId', { userId })
      .andWhere('readAt IS NULL')
      .execute();
    return { updated: result.affected ?? 0 };
  }

  async getPreferences(userId: string): Promise<NotificationChannelPreference[]> {
    const overrides = await this.preferencesRepository.find({ where: { userId } });
    const overrideMap = new Map(overrides.map((o) => [o.type, o]));

    return Object.values(NotificationType).map((type) => {
      const override = overrideMap.get(type);
      const defaults = NOTIFICATION_DEFAULT_CHANNELS[type];
      return {
        type,
        inAppEnabled: override?.inAppEnabled ?? defaults.inApp,
        emailEnabled: override?.emailEnabled ?? defaults.email,
      };
    });
  }

  async updatePreferences(
    userId: string,
    dto: UpdatePreferencesDto,
  ): Promise<NotificationChannelPreference[]> {
    for (const item of dto.preferences) {
      let pref = await this.preferencesRepository.findOne({
        where: { userId, type: item.type },
      });
      if (!pref) {
        const defaults = NOTIFICATION_DEFAULT_CHANNELS[item.type];
        pref = this.preferencesRepository.create({
          userId,
          type: item.type,
          inAppEnabled: defaults.inApp,
          emailEnabled: defaults.email,
        });
      }
      if (item.inAppEnabled !== undefined) pref.inAppEnabled = item.inAppEnabled;
      if (item.emailEnabled !== undefined) pref.emailEnabled = item.emailEnabled;
      await this.preferencesRepository.save(pref);
    }
    return this.getPreferences(userId);
  }
}
