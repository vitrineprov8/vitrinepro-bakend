import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { UserSession } from '../auth/user-session.entity';
import { Vaga } from '../vagas/vaga.entity';
import { VagaApplication } from '../vaga-applications/vaga-application.entity';
import { PortfolioItem } from '../portfolio/portfolio.entity';
import { CV } from '../cv/cv.entity';
import { Education } from '../education/education.entity';
import { SavedVaga } from '../saved-vagas/saved-vaga.entity';
import { HunterCandidate } from '../hunter-candidates/hunter-candidate.entity';
import { Notification } from '../notifications/notification.entity';
import { Invoice } from '../invoices/invoice.entity';
import { Payout } from '../payouts/payout.entity';
import { TeamMember } from '../teams/team-member.entity';
import { HunterReview } from '../reviews/hunter-review.entity';
import { UsersModule } from '../users/users.module';
import { AccountService } from './account.service';
import { AccountController } from './account.controller';

/**
 * B26 — módulo self-service de conta (sessões ativas, exportar dados LGPD,
 * excluir/anonimizar conta). `UsersModule` traz `UsersService.applyAnonymization`
 * (mesma lógica compartilhada com o B24 admin). `AdminAuditLogService` vem do
 * `AdminAuditLogModule`, que é `@Global()` — não precisa import aqui.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserSession,
      Vaga,
      VagaApplication,
      PortfolioItem,
      CV,
      Education,
      SavedVaga,
      HunterCandidate,
      Notification,
      Invoice,
      Payout,
      TeamMember,
      HunterReview,
    ]),
    UsersModule,
  ],
  providers: [AccountService],
  controllers: [AccountController],
})
export class AccountModule {}
