import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../config/database.config';
import { AuthResponseDto } from './dto/auth-response.dto';

/** Passwords everyone knows: the installer's default admin password */
const KNOWN_PASSWORDS = ['Admin@123', process.env.SUPER_ADMIN_PASSWORD].filter(Boolean) as string[];

export function checkNewPassword(password: string, username: string) {
  if (password.length < 8) throw new BadRequestException('Use at least 8 characters');
  if (KNOWN_PASSWORDS.includes(password)) throw new BadRequestException('That is the default password. Pick a new one');
  if (password.toLowerCase().includes(username.toLowerCase())) throw new BadRequestException('Do not use the username in the password');
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateUser(username: string, password: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { username },
    });

    if (!user || !user.isActive) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return null;
    }

    // Still on the installer's default password: make them pick their own
    if (!user.mustChangePassword && KNOWN_PASSWORDS.includes(password)) {
      await this.prisma.user.update({ where: { id: user.id }, data: { mustChangePassword: true } });
      user.mustChangePassword = true;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _password, ...result } = user;
    return result;
  }

  login(user: any): AuthResponseDto {
    const payload = { username: user.username, sub: user.id, role: user.role };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        mustChangePassword: !!user.mustChangePassword,
      },
    };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      throw new BadRequestException('The current password is wrong');
    }
    if (currentPassword === newPassword) throw new BadRequestException('Pick a password different from the current one');
    checkNewPassword(newPassword, user.username);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: await bcrypt.hash(newPassword, 10), mustChangePassword: false },
    });
    return { changed: true };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        role: true,
        mustChangePassword: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }
}
