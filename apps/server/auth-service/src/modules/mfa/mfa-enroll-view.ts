import * as QRCode from 'qrcode';
import { totpKeyUri } from './totp';

/** What an enroll/start shows: QR code + manual key (sign-in and Settings flows). */
export interface MfaEnrollmentView {
  otpauthUrl: string;
  secret: string;
  qrDataUrl: string;
}

export async function enrollmentView(
  accountName: string,
  secret: string,
): Promise<MfaEnrollmentView> {
  const otpauthUrl = totpKeyUri(accountName, secret);
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 256,
  });
  return { otpauthUrl, secret, qrDataUrl };
}
