import { Injectable, Logger } from '@nestjs/common';
import {
  consentRequestTemplate,
  welcomeTemplate,
  passwordResetTemplate,
  teamInviteTemplate,
  verificationApprovedTemplate,
  verificationRejectedTemplate,
  emailVerificationTemplate,
  placementHiredTemplate,
  placementConfirmedTemplate,
  placementDisputedTemplate,
  placementGuaranteeBrokenTemplate,
  placementFeeReleasedTemplate,
  type MailContent,
} from './mail.templates';

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export interface SendMailResult {
  sent: boolean;
  stubbed?: boolean;
  id?: string;
  error?: string;
}

/**
 * B14 — E-mail transacional via Resend (https://resend.com).
 *
 * Usa a API REST do Resend por `fetch` (Node 18+/22), sem dependência nova.
 * Se `RESEND_API_KEY` não estiver definido, cai no modo STUB: apenas loga o
 * e-mail (comportamento de dev anterior), sem quebrar o fluxo chamador.
 *
 * Nunca lança: falha de envio é logada e retornada em `{ sent:false }`, pois
 * um e-mail que falha não deve derrubar a request de negócio.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly apiKey = process.env.RESEND_API_KEY;
  private readonly from =
    process.env.MAIL_FROM || 'VitrinePro <onboarding@resend.dev>';
  private readonly frontendUrl = (
    process.env.FRONTEND_URL || 'http://localhost:4321'
  ).replace(/\/$/, '');

  get enabled(): boolean {
    return !!this.apiKey;
  }

  async send(input: SendMailInput): Promise<SendMailResult> {
    if (!this.apiKey) {
      this.logger.warn(
        `[MAIL stub] Para: ${input.to} - Assunto: "${input.subject}" (defina RESEND_API_KEY para enviar de verdade)`,
      );
      return { sent: false, stubbed: true };
    }

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.from,
          to: [input.to],
          subject: input.subject,
          html: input.html,
          ...(input.replyTo ? { reply_to: input.replyTo } : {}),
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        this.logger.error(
          `Falha ao enviar e-mail para ${input.to}: ${res.status} ${text}`,
        );
        return { sent: false, error: `${res.status}` };
      }

      const data = (await res.json().catch(() => ({}))) as { id?: string };
      this.logger.log(`E-mail enviado para ${input.to} (id: ${data.id})`);
      return { sent: true, id: data.id };
    } catch (err) {
      this.logger.error(
        `Erro de rede ao enviar e-mail para ${input.to}: ${(err as Error).message}`,
      );
      return { sent: false, error: (err as Error).message };
    }
  }

  private sendTemplate(to: string, tpl: MailContent): Promise<SendMailResult> {
    return this.send({ to, subject: tpl.subject, html: tpl.html });
  }

  // ── Conveniências por caso de uso ───────────────────────────────────────────

  /** B3 — pede consentimento LGPD ao candidato, com link para a página pública. */
  sendConsentRequest(
    to: string,
    candidateName: string,
    token: string,
  ): Promise<SendMailResult> {
    const link = `${this.frontendUrl}/consentimento/${token}`;
    return this.sendTemplate(to, consentRequestTemplate(candidateName, link));
  }

  sendWelcome(to: string, firstName: string): Promise<SendMailResult> {
    return this.sendTemplate(
      to,
      welcomeTemplate(firstName, `${this.frontendUrl}/app`),
    );
  }

  /** B2 — link de redefinição de senha (usar quando o fluxo real for ligado). */
  sendPasswordReset(to: string, token: string): Promise<SendMailResult> {
    const link = `${this.frontendUrl}/redefinir-senha/${token}`;
    return this.sendTemplate(to, passwordResetTemplate(link));
  }

  /** B17 — confirmação de e-mail após cadastro (link para /verificar-email/:token). */
  sendEmailVerification(
    to: string,
    firstName: string,
    token: string,
  ): Promise<SendMailResult> {
    const link = `${this.frontendUrl}/verificar-email/${token}`;
    return this.sendTemplate(to, emailVerificationTemplate(firstName, link));
  }

  /** B7 — convite de time (link para a página pública /convite/:token). */
  sendTeamInvite(
    to: string,
    teamName: string,
    inviterName: string,
    role: string,
    token: string,
  ): Promise<SendMailResult> {
    const link = `${this.frontendUrl}/convite/${token}`;
    return this.sendTemplate(
      to,
      teamInviteTemplate(teamName, inviterName, role, link),
    );
  }

  /** B8 — verificação de hunter aprovada. */
  sendVerificationApproved(to: string, firstName: string): Promise<SendMailResult> {
    const link = `${this.frontendUrl}/app/hunter/marketplace`;
    return this.sendTemplate(to, verificationApprovedTemplate(firstName, link));
  }

  /** B8 — verificação de hunter recusada, com motivo. */
  sendVerificationRejected(
    to: string,
    firstName: string,
    reason: string,
  ): Promise<SendMailResult> {
    const link = `${this.frontendUrl}/app/hunter/perfil`;
    return this.sendTemplate(
      to,
      verificationRejectedTemplate(firstName, reason, link),
    );
  }

  // ── B9 — Placements ────────────────────────────────────────────────────────

  /** P1 — empresa marcou o candidato indicado como contratado; hunter precisa confirmar. */
  sendPlacementHired(
    to: string,
    hunterFirstName: string,
    vagaTitle: string,
    hunterShareAmount: number,
  ): Promise<SendMailResult> {
    const link = `${this.frontendUrl}/app/hunter/mesa`;
    return this.sendTemplate(
      to,
      placementHiredTemplate(hunterFirstName, vagaTitle, hunterShareAmount, link),
    );
  }

  /** P2 — hunter confirmou (ou auto-confirm 7d); avisa a empresa. */
  sendPlacementConfirmed(
    to: string,
    companyFirstName: string,
    vagaTitle: string,
    autoConfirmed: boolean,
    guaranteeEndsAt: Date,
    placementId: string,
  ): Promise<SendMailResult> {
    const link = `${this.frontendUrl}/app/placements/${placementId}`;
    return this.sendTemplate(
      to,
      placementConfirmedTemplate(
        companyFirstName,
        vagaTitle,
        autoConfirmed,
        guaranteeEndsAt,
        link,
      ),
    );
  }

  /** P2 — hunter contestou os dados; avisa a empresa. */
  sendPlacementDisputed(
    to: string,
    companyFirstName: string,
    vagaTitle: string,
    reason: string,
    placementId: string,
  ): Promise<SendMailResult> {
    const link = `${this.frontendUrl}/app/placements/${placementId}`;
    return this.sendTemplate(
      to,
      placementDisputedTemplate(companyFirstName, vagaTitle, reason, link),
    );
  }

  /** P4 — quebra de garantia; hunter é notificado para indicar substituto. */
  sendPlacementGuaranteeBroken(
    to: string,
    hunterFirstName: string,
    vagaTitle: string,
    reason: string,
  ): Promise<SendMailResult> {
    const link = `${this.frontendUrl}/app/hunter/marketplace`;
    return this.sendTemplate(
      to,
      placementGuaranteeBrokenTemplate(hunterFirstName, vagaTitle, reason, link),
    );
  }

  /** Garantia expirou sem quebra — fee liberado ao hunter. */
  sendPlacementFeeReleased(
    to: string,
    hunterFirstName: string,
    vagaTitle: string,
    hunterShareAmount: number,
  ): Promise<SendMailResult> {
    const link = `${this.frontendUrl}/app/hunter/mesa`;
    return this.sendTemplate(
      to,
      placementFeeReleasedTemplate(hunterFirstName, vagaTitle, hunterShareAmount, link),
    );
  }
}
