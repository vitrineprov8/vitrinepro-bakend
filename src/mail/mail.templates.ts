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
