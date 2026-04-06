import PDFDocument from 'pdfkit';
import { generateQRBuffer } from './qrcode.utils';
import { PassThrough } from 'stream';

export interface QRTableData {
  tableName: string;
  qrUrl: string;
  restaurantName: string;
  zone?: string;
}

export async function generateQRPDF(tables: QRTableData[]): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, autoFirstPage: false });
    const chunks: Buffer[] = [];
    const stream = new PassThrough();

    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
    doc.pipe(stream);

    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const cardsPerRow = 2;
    const cardWidth = (pageWidth - 80) / cardsPerRow;
    const cardHeight = 280;
    const cols = cardsPerRow;
    const rows = Math.floor((pageHeight - 80) / cardHeight);
    const cardsPerPage = cols * rows;

    for (let i = 0; i < tables.length; i++) {
      if (i % cardsPerPage === 0) {
        doc.addPage();
      }
      const posOnPage = i % cardsPerPage;
      const col = posOnPage % cols;
      const row = Math.floor(posOnPage / cols);
      const x = 40 + col * cardWidth;
      const y = 40 + row * cardHeight;

      const table = tables[i];

      // Card border
      doc
        .save()
        .roundedRect(x + 5, y + 5, cardWidth - 10, cardHeight - 10, 12)
        .strokeColor('#E2E8F0')
        .lineWidth(1)
        .stroke()
        .restore();

      // Restaurant name
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#6366F1')
        .text(table.restaurantName, x + 10, y + 18, {
          width: cardWidth - 20,
          align: 'center',
        });

      // Zone if present
      if (table.zone) {
        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor('#94A3B8')
          .text(table.zone.toUpperCase(), x + 10, y + 32, {
            width: cardWidth - 20,
            align: 'center',
          });
      }

      // Table name
      doc
        .font('Helvetica-Bold')
        .fontSize(18)
        .fillColor('#1E293B')
        .text(table.tableName, x + 10, y + 46, {
          width: cardWidth - 20,
          align: 'center',
        });

      // QR Code
      try {
        const qrBuffer = await generateQRBuffer(table.qrUrl);
        const qrSize = 140;
        const qrX = x + (cardWidth - qrSize) / 2;
        const qrY = y + 78;
        doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });
      } catch {
        // fallback placeholder
        doc.rect(x + 50, y + 78, 140, 140).fillColor('#F1F5F9').fill();
      }

      // Instruction text
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#64748B')
        .text('Escanea para ordenar', x + 10, y + 228, {
          width: cardWidth - 20,
          align: 'center',
        });

      // Decorative line at bottom
      doc
        .save()
        .moveTo(x + 20, y + 248)
        .lineTo(x + cardWidth - 20, y + 248)
        .strokeColor('#6366F1')
        .lineWidth(2)
        .stroke()
        .restore();
    }

    doc.end();
  });
}
