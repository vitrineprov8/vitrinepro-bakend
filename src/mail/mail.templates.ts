/**
 * Templates de e-mail transacional (B14). HTML inline simples e responsivo,
 * sem dependência de engine de template. Cada função retorna { subject, html }.
 */

const BRAND = '#16a34a';
const INK = '#0f172a';
const MUTED = '#64748b';

function layout(title: string, bodyHtml: string, cta?: { label: string; url: string }): string {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${INK};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">
        <tr><td style="padding:24px 32px;border-bottom:1px solid #e2e8f0;">
          <span style="font-weight:700;font-size:18px;color:${INK};">Vitrine<span style="color:${BRAND};">Pro</span></span>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 12px;font-size:20px;color:${INK};">${title}</h1>
          <div style="font-size:15px;line-height:1.6;color:#334155;">${bodyHtml}</div>
          ${cta ? `<div style="margin-top:24px;"><a href="${cta.url}" style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:15px;">${cta.label}</a></div>` : ''}
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid #e2e8f0;font-size:12px;color:${MUTED};">
          Você recebeu este e-mail da VitrinePro. Se não reconhece esta mensagem, pode ignorá-la.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export interface MailContent {
  subject: string;
  html: string;
}

/** LGPD consent request sent to a candidate a hunter wants to add/submit (B3). */
export function consentRequestTemplate(candidateName: string, link: string): MailContent {
  const first = candidateName.trim().split(/\s+/)[0] || 'Olá';
  return {
    subject: 'Um recrutador quer te indicar para vagas — autorize',
    html: layout(
      'Autorização para indicação',
      `Olá <strong>${first}</strong>,<br><br>
       Um recrutador da VitrinePro gostaria de incluir seu perfil no banco de talentos dele e indicá-lo a vagas.
       Para prosseguir, precisamos da sua autorização (LGPD).<br><br>
       É rápido: clique no botão abaixo para <strong>autorizar</strong> ou <strong>recusar</strong>.`,
      { label: 'Revisar e responder', url: link },
    ),
  };
}

/** Welcome e-mail after signup. */
export function welcomeTemplate(firstName: string, appUrl: string): MailContent {
  return {
    subject: 'Bem-vindo(a) à VitrinePro',
    html: layout(
      `Bem-vindo(a), ${firstName}!`,
      `Sua conta foi criada com sucesso. Agora você pode acessar seu painel e começar a usar a VitrinePro.`,
      { label: 'Acessar meu painel', url: appUrl },
    ),
  };
}

/** Password reset (B2 — usado quando o fluxo real de reset for ligado). */
export function passwordResetTemplate(link: string): MailContent {
  return {
    subject: 'Redefinição de senha — VitrinePro',
    html: layout(
      'Redefinir sua senha',
      `Recebemos um pedido para redefinir a senha da sua conta. O link expira em 1 hora.<br><br>
       Se não foi você, ignore este e-mail — sua senha continua a mesma.`,
      { label: 'Redefinir senha', url: link },
    ),
  };
}

/** B17 — confirmação de e-mail após cadastro. Link expira em 24h. */
export function emailVerificationTemplate(firstName: string, link: string): MailContent {
  return {
    subject: 'Confirme seu e-mail — VitrinePro',
    html: layout(
      'Confirme seu e-mail',
      `Olá <strong>${firstName}</strong>, falta pouco! Confirme seu e-mail para ativar sua conta na VitrinePro.
       O link expira em 24 horas.<br><br>
       Se não foi você quem se cadastrou, pode ignorar esta mensagem.`,
      { label: 'Confirmar e-mail', url: link },
    ),
  };
}

const TEAM_ROLE_LABEL: Record<string, string> = {
  OWNER: 'Proprietário(a)',
  MANAGER: 'Gerente',
  RECRUITER: 'Recrutador(a)',
};

/** Convite de time por token (B7). */
export function teamInviteTemplate(
  teamName: string,
  inviterName: string,
  role: string,
  link: string,
): MailContent {
  const roleLabel = TEAM_ROLE_LABEL[role] ?? role;
  return {
    subject: `${inviterName} te convidou para o time "${teamName}" na VitrinePro`,
    html: layout(
      'Convite para um time',
      `<strong>${inviterName}</strong> te convidou para participar do time <strong>${teamName}</strong> na VitrinePro,
       com a função de <strong>${roleLabel}</strong>.<br><br>
       Clique no botão abaixo para revisar e aceitar o convite.`,
      { label: 'Ver convite', url: link },
    ),
  };
}

/** B8 — verificação de hunter aprovada: libera o selo "Verificado" e o marketplace. */
export function verificationApprovedTemplate(
  firstName: string,
  marketplaceUrl: string,
): MailContent {
  return {
    subject: 'Seu perfil foi verificado — VitrinePro',
    html: layout(
      'Perfil verificado! ✅',
      `Olá <strong>${firstName}</strong>, boas notícias: analisamos seus documentos e seu perfil de hunter foi <strong>verificado</strong>.<br><br>
       Agora você já pode trabalhar vagas com fee no marketplace, com o selo "Verificado" visível no seu perfil público.`,
      { label: 'Ir para o marketplace', url: marketplaceUrl },
    ),
  };
}

/** B8 — verificação de hunter recusada, com motivo para o hunter corrigir e reenviar. */
export function verificationRejectedTemplate(
  firstName: string,
  reason: string,
  profileUrl: string,
): MailContent {
  return {
    subject: 'Sua verificação de hunter precisa de ajustes — VitrinePro',
    html: layout(
      'Verificação não aprovada',
      `Olá <strong>${firstName}</strong>, analisamos seus documentos, mas ainda não foi possível aprovar sua verificação.<br><br>
       <strong>Motivo:</strong> ${reason}<br><br>
       Você pode corrigir as informações e enviar novamente a qualquer momento.`,
      { label: 'Revisar meu perfil', url: profileUrl },
    ),
  };
}

// ── B9 — Placements (§P) ────────────────────────────────────────────────────

/** P1 — empresa marcou o candidato indicado como contratado; hunter precisa confirmar. */
export function placementHiredTemplate(
  hunterFirstName: string,
  vagaTitle: string,
  hunterShareAmount: number,
  deskUrl: string,
): MailContent {
  const fee = hunterShareAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  return {
    subject: `Placement em confirmação — ${vagaTitle}`,
    html: layout(
      'Placement em confirmação! 🎉',
      `Olá <strong>${hunterFirstName}</strong>, a empresa marcou seu candidato indicado para <strong>${vagaTitle}</strong> como contratado.<br><br>
       Sua parte do fee: <strong>${fee}</strong>. Confira os dados e confirme (ou conteste) — se não houver ação em 7 dias, o placement é confirmado automaticamente.`,
      { label: 'Ver e confirmar', url: deskUrl },
    ),
  };
}

/** P2 — hunter confirmou (ou auto-confirmou) o placement; avisa a empresa. */
export function placementConfirmedTemplate(
  companyFirstName: string,
  vagaTitle: string,
  autoConfirmed: boolean,
  guaranteeEndsAt: Date,
  placementUrl: string,
): MailContent {
  const dateLabel = guaranteeEndsAt.toLocaleDateString('pt-BR');
  return {
    subject: `Placement confirmado — ${vagaTitle}`,
    html: layout(
      'Placement confirmado ✅',
      `Olá <strong>${companyFirstName}</strong>, o placement de <strong>${vagaTitle}</strong> foi ${
        autoConfirmed ? 'confirmado automaticamente (sem resposta em 7 dias)' : 'confirmado pelo hunter'
      }.<br><br>
       A garantia de 90 dias vai até <strong>${dateLabel}</strong>. Se o candidato sair antes disso, você pode solicitar reposição gratuita.`,
      { label: 'Ver placement', url: placementUrl },
    ),
  };
}

/** P2 — hunter contestou os dados do placement; empresa e admin precisam revisar. */
export function placementDisputedTemplate(
  companyFirstName: string,
  vagaTitle: string,
  reason: string,
  placementUrl: string,
): MailContent {
  return {
    subject: `Placement contestado — ${vagaTitle}`,
    html: layout(
      'Placement contestado',
      `Olá <strong>${companyFirstName}</strong>, o hunter contestou os dados do placement de <strong>${vagaTitle}</strong>.<br><br>
       <strong>Motivo:</strong> ${reason}<br><br>
       Nossa equipe vai analisar a disputa.`,
      { label: 'Ver placement', url: placementUrl },
    ),
  };
}

/** P4 — empresa reportou saída do candidato dentro da garantia; hunter indica substituto. */
export function placementGuaranteeBrokenTemplate(
  hunterFirstName: string,
  vagaTitle: string,
  reason: string,
  marketplaceUrl: string,
): MailContent {
  return {
    subject: `Reposição necessária — ${vagaTitle}`,
    html: layout(
      'O candidato saiu — reposição gratuita',
      `Olá <strong>${hunterFirstName}</strong>, a empresa informou que o candidato contratado para <strong>${vagaTitle}</strong> saiu dentro do período de garantia.<br><br>
       <strong>Motivo informado:</strong> ${reason}<br><br>
       Você pode indicar um novo candidato sem custo adicional para a empresa.`,
      { label: 'Indicar substituto', url: marketplaceUrl },
    ),
  };
}

/** Fee liberado ao hunter — garantia expirou sem quebra. */
export function placementFeeReleasedTemplate(
  hunterFirstName: string,
  vagaTitle: string,
  hunterShareAmount: number,
  deskUrl: string,
): MailContent {
  const fee = hunterShareAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  return {
    subject: `Fee liberado — ${vagaTitle} 💸`,
    html: layout(
      'Fee liberado! 💸',
      `Boas notícias, <strong>${hunterFirstName}</strong>! A garantia do placement de <strong>${vagaTitle}</strong> expirou sem quebra e seu fee de <strong>${fee}</strong> foi liberado.`,
      { label: 'Ver meus ganhos', url: deskUrl },
    ),
  };
}

/** B22 — admin ajustou o split de placement negociado desta empresa. */
export function placementSplitChangedTemplate(
  companyName: string,
  newPlatformSharePercent: number,
  reason: string,
): MailContent {
  const newHunterSharePercent = 100 - newPlatformSharePercent;
  return {
    subject: 'Atualização no acordo de split de placements — VitrinePro',
    html: layout(
      'Split de placement atualizado',
      `Olá <strong>${companyName}</strong>, o acordo de split de fee de placements da sua conta foi atualizado por nossa equipe.<br><br>
       Novo split: <strong>${newHunterSharePercent}% hunter / ${newPlatformSharePercent}% plataforma</strong>.<br><br>
       <strong>Motivo:</strong> ${reason}<br><br>
       Esta mudança vale apenas para placements criados a partir de agora — os já existentes não são afetados.`,
    ),
  };
}
