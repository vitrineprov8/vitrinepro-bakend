import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

/**
 * B27 — TOTP (RFC 6238) implementado sobre o `crypto` nativo do Node.
 *
 * **Por que sem biblioteca**: TOTP é HMAC-SHA1 + truncamento dinâmico, ~60
 * linhas. Trazer `otplib`/`speakeasy` adicionaria superfície de supply chain
 * num caminho crítico de segurança em troca de pouquíssimo código. Também
 * evita o gargalo de `npm install` no ambiente de dev (ver §Ambiente no
 * CLAUDE.md — só o Andres consegue popular `node_modules`).
 *
 * Correção verificada contra os vetores de teste oficiais do RFC 6238
 * (Appendix B) — ver `totp.util.spec-vectors.md` ao lado deste arquivo.
 */

/** Alfabeto Base32 do RFC 4648 — o que os apps autenticadores esperam. */
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Janela de tempo de cada código, em segundos. 30 é o universal. */
export const TOTP_PERIOD_SECONDS = 30;

/** Dígitos do código. 6 é o universal. */
export const TOTP_DIGITS = 6;

/**
 * Quantas janelas de 30s antes/depois da atual são aceitas.
 * 1 = tolera até ±30s de desvio de relógio entre servidor e celular, que é o
 * padrão da indústria: menos que isso gera falso-negativo em celular com
 * relógio levemente dessincronizado, mais que isso alarga a janela de replay.
 */
const DEFAULT_WINDOW = 1;

/**
 * Base32 sem padding (`=`). Apps autenticadores aceitam sem padding, e é o
 * formato mais limpo pra digitação manual quando o QR não pode ser escaneado.
 */
export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';

  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return out;
}

export function base32Decode(input: string): Buffer {
  // Tolera espaços e minúsculas — usuário pode colar o segredo formatado.
  const clean = input.replace(/[\s-]/g, '').replace(/=+$/, '').toUpperCase();

  let bits = 0;
  let value = 0;
  const out: number[] = [];

  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) {
      throw new Error('Segredo Base32 inválido.');
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(out);
}

/**
 * Gera um segredo novo. 20 bytes (160 bits) é o tamanho recomendado pelo
 * RFC 4226 §4 para HMAC-SHA1 e o que o Google Authenticator usa.
 */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** HOTP (RFC 4226) — o bloco de construção do TOTP. */
function hotp(secret: Buffer, counter: number, digits: number): string {
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter));

  const digest = createHmac('sha1', secret).update(counterBuf).digest();

  // Truncamento dinâmico (RFC 4226 §5.3): os 4 bits baixos do último byte
  // dizem de onde começar a ler os 4 bytes do código.
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return (binary % 10 ** digits).toString().padStart(digits, '0');
}

/** Gera o código atual — usado nos testes e para depuração, não no fluxo real. */
export function generateTotpCode(
  secretBase32: string,
  atMs: number = Date.now(),
  digits: number = TOTP_DIGITS,
): string {
  const counter = Math.floor(atMs / 1000 / TOTP_PERIOD_SECONDS);
  return hotp(base32Decode(secretBase32), counter, digits);
}

/** Comparação em tempo constante — evita timing oracle no código de 6 dígitos. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Valida um código contra o segredo, tolerando ±`window` janelas de 30s.
 * Retorna `false` (nunca lança) para qualquer entrada malformada — quem chama
 * trata code inválido e code errado da mesma forma, de propósito.
 */
export function verifyTotp(
  secretBase32: string | null | undefined,
  code: string | null | undefined,
  window: number = DEFAULT_WINDOW,
): boolean {
  if (!secretBase32 || !code) return false;

  // Usuário costuma digitar "123 456" — normaliza antes de comparar.
  const normalized = code.replace(/\D/g, '');
  if (normalized.length !== TOTP_DIGITS) return false;

  let secret: Buffer;
  try {
    secret = base32Decode(secretBase32);
  } catch {
    return false;
  }

  const counter = Math.floor(Date.now() / 1000 / TOTP_PERIOD_SECONDS);

  let matched = false;
  for (let drift = -window; drift <= window; drift++) {
    // Sem early-return: percorre todas as janelas sempre, pra que o tempo de
    // resposta não vaze QUAL janela bateu (nem se bateu logo na primeira).
    if (safeEqual(hotp(secret, counter + drift, TOTP_DIGITS), normalized)) {
      matched = true;
    }
  }

  return matched;
}

/**
 * URI `otpauth://` que o app autenticador lê do QR. O `issuer` aparece como
 * nome da entrada na lista do app; o `account` desambigua múltiplas contas.
 */
export function buildOtpauthUri(
  secretBase32: string,
  account: string,
  issuer = 'VitrinePro',
): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/**
 * Formata o segredo em grupos de 4 pra digitação manual (fallback de quem não
 * consegue escanear o QR). `base32Decode` já tolera os espaços na volta.
 */
export function formatSecretForDisplay(secretBase32: string): string {
  return secretBase32.match(/.{1,4}/g)?.join(' ') ?? secretBase32;
}

/** Códigos de recuperação: 10 códigos de 8 caracteres, formato `XXXX-XXXX`. */
export function generateBackupCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    const raw = randomBytes(4).toString('hex').toUpperCase(); // 8 chars
    return `${raw.slice(0, 4)}-${raw.slice(4)}`;
  });
}

/** Normaliza pra comparação: sem hífen/espaço, maiúsculo. */
export function normalizeBackupCode(code: string): string {
  return code.replace(/[\s-]/g, '').toUpperCase();
}
