import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import session from 'express-session';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  // NestJS sẽ tự động nạp .env thông qua ConfigModule nếu bạn cấu hình nó trong AppModule
  const app = await NestFactory.create(AppModule);

  // 1. Cấu hình Session
  app.use(cookieParser());
  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'pon_chat_app_default_secret',
      resave: false, // Để false sẽ tốt hơn cho performance
      saveUninitialized: false,
      cookie: {
        maxAge: 3600000,
        secure: false, // Vì chạy local/ngrok nên để false
        httpOnly: true,
      },
    }),
  );

  // 2. Cấu hình CORS (Sửa lỗi Network Error)
  app.enableCors({
    origin: true,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    // 2. QUAN TRỌNG: Liệt kê đích danh cái header Ngrok vào đây
    allowedHeaders: [
      'Content-Type',
      'Accept',
      'Authorization',
      'ngrok-skip-browser-warning', // "Chìa khóa" ở đây
      'X-Requested-With'
    ],
  });

  // 3. Validation chuẩn
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // 4. Port và Host
  const port = process.env.PORT || 4000;

  // Lắng nghe trên 0.0.0.0 để Ngrok có thể chuyển tiếp dữ liệu vào
  await app.listen(port, '0.0.0.0');
  // tree -I 'node_modules|.git|dist|.next|infra/mongodb_config/data|*.wt|*.lock|*.turtle' > project_tree.txt
  console.log('--- CHECK ENV ---');
  console.log('FB ID:', process.env.FACEBOOK_CLIENT_ID);
  console.log(`🚀 PON Server is running on: http://localhost:${port}`);
  console.log(`🌐 Public Tunnel: https://donnie-readaptable-ai.ngrok-free.dev`);
}
bootstrap();