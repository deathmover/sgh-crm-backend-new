import { BadRequestException, Body, Controller, Get, Injectable, Module, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../config/database.config';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OWNER_ROLES, OwnerOnly } from '../../common/decorators/owner-only.decorator';
import { checkNewPassword } from '../auth/auth.service';

const ROLES = ['owner', 'staff'] as const;
const select = { id: true, username: true, role: true, isActive: true, mustChangePassword: true, createdAt: true } as const;

export class CreateUserDto {
  @ApiProperty({ example: 'ravi' })
  @Matches(/^[a-z0-9._-]{3,30}$/, { message: 'Username: 3–30 lowercase letters, digits, dots, dashes' })
  username: string;

  @ApiProperty({ description: 'Temporary password; they must change it at first login' })
  @IsString()
  @MaxLength(100)
  password: string;

  @ApiProperty({ enum: ROLES })
  @IsIn(ROLES)
  role: (typeof ROLES)[number];
}

export class UpdateUserDto {
  @ApiPropertyOptional({ enum: ROLES })
  @IsOptional()
  @IsIn(ROLES)
  role?: (typeof ROLES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'New temporary password' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  password?: string;
}

/** Logins for the café: owners see everything, staff run the floor. */
@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.user.findMany({ select, orderBy: { createdAt: 'asc' } });
  }

  async create(dto: CreateUserDto) {
    checkNewPassword(dto.password, dto.username);
    if (await this.prisma.user.findUnique({ where: { username: dto.username } })) {
      throw new BadRequestException('That username is taken');
    }
    return this.prisma.user.create({
      data: {
        username: dto.username,
        password: await bcrypt.hash(dto.password, 10),
        role: dto.role === 'owner' ? 'super_admin' : 'staff',
        mustChangePassword: true,
      },
      select,
    });
  }

  async update(id: string, dto: UpdateUserDto, me: { id: string }) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Login not found');
    const role = dto.role ? (dto.role === 'owner' ? 'super_admin' : 'staff') : user.role;
    const isActive = dto.isActive ?? user.isActive;

    // Never lock everyone out of the owner screens
    const losesOwner = OWNER_ROLES.includes(user.role) && user.isActive && (!OWNER_ROLES.includes(role) || !isActive);
    if (losesOwner) {
      if (id === me.id) throw new BadRequestException('You cannot remove your own owner access');
      const owners = await this.prisma.user.count({ where: { role: { in: OWNER_ROLES }, isActive: true } });
      if (owners <= 1) throw new BadRequestException('There must be at least one active owner');
    }

    const data: { role: string; isActive: boolean; password?: string; mustChangePassword?: boolean } = { role, isActive };
    if (dto.password) {
      checkNewPassword(dto.password, user.username);
      data.password = await bcrypt.hash(dto.password, 10);
      data.mustChangePassword = true; // a reset password is temporary too
    }
    return this.prisma.user.update({ where: { id }, data, select });
  }
}

@ApiTags('Users')
@ApiBearerAuth()
@OwnerOnly()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'All logins' })
  list() {
    return this.users.list();
  }

  @Post()
  @ApiOperation({ summary: 'Add a login (they set their own password at first login)' })
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Change role, switch off/on, or reset the password' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() me: { id: string }) {
    return this.users.update(id, dto, me);
  }
}

@Module({
  controllers: [UsersController],
  providers: [UsersService, PrismaService],
})
export class UsersModule {}
