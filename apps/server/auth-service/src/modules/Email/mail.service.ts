import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';

@Injectable()
export class MailService {
  constructor(private mailerService: MailerService) {}

  async sendOtpEmail(email: string, otp: string) {
    await this.mailerService.sendMail({
      to: email,
      subject: 'Mã xác thực OTP - Ứng dụng PON',
      template: './otp', // Đường dẫn tới file otp.ejs
      context: { 
        otp,
        email
      },
    });
  }
}