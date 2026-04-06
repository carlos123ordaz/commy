import QRCode from 'qrcode';

export async function generateQRDataURL(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 400,
    color: { dark: '#1E293B', light: '#FFFFFF' },
  });
}

export async function generateQRBuffer(text: string): Promise<Buffer> {
  return QRCode.toBuffer(text, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 400,
    color: { dark: '#1E293B', light: '#FFFFFF' },
  });
}
