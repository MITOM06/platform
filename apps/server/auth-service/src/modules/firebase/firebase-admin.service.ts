import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseAdminService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseAdminService.name);

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    // Already initialized (e.g. hot reload guard)
    if (admin.apps.length > 0) return;

    const base64 = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_BASE64');
    if (!base64) {
      this.logger.error(
        'FIREBASE_SERVICE_ACCOUNT_BASE64 is not set — phone auth disabled',
      );
      return;
    }

    const serviceAccount = JSON.parse(
      Buffer.from(base64, 'base64').toString('utf8'),
    ) as admin.ServiceAccount;

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    this.logger.log('Firebase Admin SDK initialized');
  }

  /**
   * Verifies a Firebase ID token and returns the decoded claims.
   * Throws if the token is invalid or expired.
   */
  async verifyIdToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
    return admin.auth().verifyIdToken(idToken);
  }
}
