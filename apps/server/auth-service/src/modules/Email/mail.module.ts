// File: apps/server/auth-service/src/modules/Email/mail.module.ts

import { MailerModule } from '@nestjs-modules/mailer';
import { EjsAdapter } from '@nestjs-modules/mailer';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';
import { join } from 'path';

@Global()
@Module({
  imports: [
    MailerModule.forRootAsync({
      useFactory: async (config: ConfigService) => {
        
        // ✅ FIX: Trỏ thẳng vào thư mục dist thay vì __dirname
        // NestJS thường build từ 'src' ra thẳng 'dist' (bỏ qua đoạn apps/server...) đối với assets
        const templateDir = join(process.cwd(), 'dist/modules/Email/templates');
        
        console.log('--------------------------------------------------');
        console.log('📧 PWD:', process.cwd()); 
        console.log('📧 Template Directory set to:', templateDir);
        console.log('--------------------------------------------------');

        return {
          transport: {
            host: config.get('MAIL_HOST'),
            port: config.get<number>('MAIL_PORT'),
            secure: false,
            auth: {
              user: config.get('MAIL_USER'),
              pass: config.get('MAIL_PASS'),
            },
          },
          defaults: {
            from: `"PON Support" <${config.get('MAIL_USER')}>`,
          },
          template: {
            dir: templateDir, // Sử dụng đường dẫn cứng đã fix
            adapter: new EjsAdapter(),
            options: {
              strict: false,
            },
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule { }