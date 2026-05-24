import { Injectable } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof import('pdfkit');
import { VagaApplication } from '../vaga-applications/vaga-application.entity';
import { ProcessShareLink } from './process-share-link.entity';

// Brand colours (matches dashboard CSS primary tokens)
const COLOR_PRIMARY = '#5B4FCF';   // VitrinePro purple
const COLOR_TEXT = '#1A1A2E';
const COLOR_MUTED = '#6B7280';
const COLOR_DIVIDER = '#E5E7EB';
const COLOR_ACCENT = '#10B981';    // green — used for score highlight

@Injectable()
export class PdfService {
  /**
   * Generates a PDF buffer for the given application.
   *
   * @param app - fully loaded application (with vaga + user relations)
   * @param authorMap - userId → full name map for stageHistory entries
   * @param activeLink - if present, public share URL is printed in the footer
   */
  async generateApplicationPdf(
    app: VagaApplication & { user?: { firstName: string; lastName: string; profession?: string | null; avatarUrl?: string | null } | null; vaga?: { title: string; segment?: string | null; location?: string | null } | null },
    authorMap: Map<string, string>,
    activeLink: ProcessShareLink | null,
  ): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        info: {
          Title: `Processo Seletivo — ${app.snapshotFullName}`,
          Author: 'VitrinePro',
          Creator: 'VitrinePro v8pro.com.br',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth =
        doc.page.width - doc.page.margins.left - doc.page.margins.right;

      // ── Header ────────────────────────────────────────────────────────────
      doc
        .fontSize(22)
        .fillColor(COLOR_PRIMARY)
        .font('Helvetica-Bold')
        .text('VitrinePro', doc.page.margins.left, 50, { continued: false });

      doc
        .fontSize(11)
        .fillColor(COLOR_MUTED)
        .font('Helvetica')
        .text('Processo Seletivo', { continued: false });

      // Horizontal rule
      doc.moveDown(0.5);
      const ruleY = doc.y;
      doc
        .moveTo(doc.page.margins.left, ruleY)
        .lineTo(doc.page.margins.left + pageWidth, ruleY)
        .strokeColor(COLOR_PRIMARY)
        .lineWidth(2)
        .stroke();

      doc.moveDown(1);

      // ── Candidate section ─────────────────────────────────────────────────
      this.sectionTitle(doc, 'Candidato');

      const candidateName = app.snapshotFullName;
      const profession =
        (app as any).user?.profession ?? null;

      this.labelValue(doc, 'Nome', candidateName);
      if (profession) this.labelValue(doc, 'Profissão', profession);
      if (app.snapshotLocation)
        this.labelValue(doc, 'Localização', app.snapshotLocation);

      doc.moveDown(0.5);

      // ── Vaga section ──────────────────────────────────────────────────────
      if (app.vaga) {
        this.sectionTitle(doc, 'Vaga');
        this.labelValue(doc, 'Título', app.vaga.title);
        if (app.vaga.segment)
          this.labelValue(doc, 'Segmento', app.vaga.segment);
        if (app.vaga.location)
          this.labelValue(doc, 'Local', app.vaga.location);
        doc.moveDown(0.5);
      }

      // ── Pipeline status ───────────────────────────────────────────────────
      this.sectionTitle(doc, 'Status do Pipeline');
      this.labelValue(doc, 'Etapa atual', app.pipelineStage);
      this.labelValue(doc, 'Rejeitado', app.isRejected ? 'Sim' : 'Não');
      doc.moveDown(0.5);

      // ── General evaluation ────────────────────────────────────────────────
      this.sectionTitle(doc, 'Avaliação Geral');

      if (app.generalScore !== null && app.generalScore !== undefined) {
        doc
          .fontSize(28)
          .fillColor(COLOR_ACCENT)
          .font('Helvetica-Bold')
          .text(String(app.generalScore), { align: 'left' });

        doc
          .fontSize(10)
          .fillColor(COLOR_MUTED)
          .font('Helvetica')
          .text('(0–10)', { align: 'left' });
        doc.moveDown(0.25);
      } else {
        this.labelValue(doc, 'Nota geral', 'Não atribuída');
      }

      if (app.generalNote) {
        doc
          .fontSize(10)
          .fillColor(COLOR_TEXT)
          .font('Helvetica')
          .text(app.generalNote, {
            width: pageWidth,
            lineGap: 3,
          });
      }

      doc.moveDown(0.5);

      // ── Stage history ─────────────────────────────────────────────────────
      const history = [...app.stageHistory].reverse();

      if (history.length > 0) {
        this.sectionTitle(doc, 'Histórico de Etapas');

        for (const entry of history) {
          const authorName =
            authorMap.get(entry.byUserId) ?? 'Recrutador';
          const date = new Date(entry.enteredAt).toLocaleDateString('pt-BR');

          doc
            .fontSize(10)
            .fillColor(COLOR_TEXT)
            .font('Helvetica-Bold')
            .text(`${entry.stage}`, { continued: true })
            .font('Helvetica')
            .fillColor(COLOR_MUTED)
            .text(`   ${date} — ${authorName}`);

          if (entry.note) {
            doc
              .fontSize(9)
              .fillColor(COLOR_MUTED)
              .text(entry.note, { indent: 10 });
          }

          doc.moveDown(0.3);
        }

        doc.moveDown(0.5);
      }

      // ── Stage notes ───────────────────────────────────────────────────────
      const stageNoteKeys = Object.keys(app.stageNotes ?? {});

      if (stageNoteKeys.length > 0) {
        this.sectionTitle(doc, 'Observações por Etapa');

        for (const key of stageNoteKeys) {
          const note = app.stageNotes[key];

          doc
            .fontSize(10)
            .fillColor(COLOR_PRIMARY)
            .font('Helvetica-Bold')
            .text(key);

          if (note.nota !== null && note.nota !== undefined) {
            doc
              .fontSize(9)
              .fillColor(COLOR_MUTED)
              .font('Helvetica')
              .text(`Nota: ${note.nota}`);
          }

          if (note.observacoes) {
            doc
              .fontSize(9)
              .fillColor(COLOR_TEXT)
              .font('Helvetica')
              .text(note.observacoes, { width: pageWidth, lineGap: 2 });
          }

          const updatedDate = new Date(note.updatedAt).toLocaleDateString(
            'pt-BR',
          );
          doc
            .fontSize(8)
            .fillColor(COLOR_MUTED)
            .text(`Atualizado em ${updatedDate}`);

          doc.moveDown(0.5);
        }
      }

      // ── Footer ────────────────────────────────────────────────────────────
      const footerY = doc.page.height - doc.page.margins.bottom - 30;

      doc
        .moveTo(doc.page.margins.left, footerY)
        .lineTo(doc.page.margins.left + pageWidth, footerY)
        .strokeColor(COLOR_DIVIDER)
        .lineWidth(1)
        .stroke();

      const emittedDate = new Date().toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });

      const footerTextY = footerY + 6;

      doc
        .fontSize(8)
        .fillColor(COLOR_MUTED)
        .font('Helvetica')
        .text(
          `Emitido em ${emittedDate} · VitrinePro · v8pro.com.br`,
          doc.page.margins.left,
          footerTextY,
          { align: 'left', width: pageWidth / 2 },
        );

      if (activeLink) {
        const baseUrl =
          process.env.PUBLIC_BASE_URL?.replace(/\/$/, '') ??
          'https://v8pro.com.br';
        const publicUrl = `${baseUrl}/processo/${activeLink.token}`;
        doc
          .fontSize(8)
          .fillColor(COLOR_PRIMARY)
          .text(publicUrl, doc.page.margins.left + pageWidth / 2, footerTextY, {
            align: 'right',
            width: pageWidth / 2,
          });
      }

      doc.end();
    });
  }

  // ── Layout helpers ────────────────────────────────────────────────────────

  private sectionTitle(doc: PDFKit.PDFDocument, title: string): void {
    doc.moveDown(0.5);
    doc
      .fontSize(13)
      .fillColor(COLOR_PRIMARY)
      .font('Helvetica-Bold')
      .text(title.toUpperCase());
    doc
      .moveTo(doc.x, doc.y)
      .lineTo(doc.x + 200, doc.y)
      .strokeColor(COLOR_PRIMARY)
      .lineWidth(0.5)
      .stroke();
    doc.moveDown(0.4);
  }

  private labelValue(
    doc: PDFKit.PDFDocument,
    label: string,
    value: string,
  ): void {
    doc
      .fontSize(10)
      .fillColor(COLOR_MUTED)
      .font('Helvetica-Bold')
      .text(`${label}: `, { continued: true })
      .font('Helvetica')
      .fillColor(COLOR_TEXT)
      .text(value);
  }
}
