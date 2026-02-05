import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty({ message: 'Tên hiển thị không được để trống' })
  @MinLength(2, { message: 'Tên hiển thị quá ngắn' })
  displayName: string;

  @IsEmail({}, { message: 'Email không đúng định dạng' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Mật khẩu phải từ 8 ký tự để đảm bảo bảo mật' }) // Nâng lên 8 ký tự cho pro
  password: string;
}