import {
  BadRequestException,
  Injectable,
  Logger,
  type OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isEmail } from 'class-validator';
import { createHash, randomBytes } from 'node:crypto';
import nodemailer, { type Transporter } from 'nodemailer';
import { hash } from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { MessageGateway } from '../message/message.gateway';
import { lockResource } from '../common/utils/transaction-lock';

const digest = (token: string) =>
  createHash('sha256').update(token).digest('hex');
const INVALID_LINK = 'Ссылка недействительна или истекла. Запросите новую.';
const UNAVAILABLE =
  'Восстановление пароля временно недоступно. Попробуйте позже.';

@Injectable()
export class PasswordRecoveryService implements OnModuleDestroy {
  private readonly logger = new Logger(PasswordRecoveryService.name);
  private readonly pending = new Set<Promise<void>>();
  private readonly mail: Transporter | null = null;
  private readonly from: string = '';
  private readonly origin: URL | null = null;
  private stopping = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: MessageGateway,
    config: ConfigService,
  ) {
    const host = (config.get<string>('SMTP_HOST') ?? '').trim();
    if (!host) return;
    const port = Number(config.get<string>('SMTP_PORT') ?? '587');
    const secureValue = config.get<string>('SMTP_SECURE');
    if (
      !Number.isInteger(port) ||
      port < 1 ||
      port > 65535 ||
      (secureValue !== undefined && !['true', 'false'].includes(secureValue))
    )
      throw new Error('Настройте SMTP_PORT и SMTP_SECURE');
    const secure =
      secureValue === undefined ? port === 465 : secureValue === 'true';
    if (port === 465 && !secure)
      throw new Error('Для SMTP_PORT=465 нужен SMTP_SECURE=true');
    const production = config.get<string>('NODE_ENV') === 'production';
    this.from = config.getOrThrow<string>('SMTP_FROM');
    this.origin = new URL(config.getOrThrow<string>('FRONTEND_ORIGIN'));
    if (
      !isEmail(this.from) ||
      !['http:', 'https:'].includes(this.origin.protocol) ||
      this.origin.username ||
      this.origin.password ||
      this.origin.search ||
      this.origin.hash ||
      this.origin.pathname !== '/' ||
      (production && this.origin.protocol !== 'https:')
    )
      throw new Error('Настройте SMTP_FROM и FRONTEND_ORIGIN');
    const user = config.get<string>('SMTP_USER');
    const pass = config.get<string>('SMTP_PASS');
    if (!!user !== !!pass)
      throw new Error('SMTP_USER и SMTP_PASS задаются вместе');
    this.mail = nodemailer.createTransport({
      host,
      port,
      secure,
      pool: true,
      maxConnections: 2,
      maxMessages: 50,
      requireTLS: production && !secure,
      auth: user && pass ? { user, pass } : undefined,
      tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
      dnsTimeout: 5000,
      disableFileAccess: true,
      disableUrlAccess: true,
      logger: false,
      debug: false,
    });
  }

  public request(email: string): { message: string } {
    if (this.stopping || !this.mail || this.pending.size >= 32)
      throw new ServiceUnavailableException(UNAVAILABLE);
    // Ответ не ждёт поиска аккаунта или SMTP, поэтому не раскрывает наличие email по времени доставки.
    const job = Promise.resolve()
      .then(() => this.deliver(email))
      .catch(() => {
        this.logger.warn('Не удалось отправить письмо восстановления пароля');
      })
      .finally(() => this.pending.delete(job));
    this.pending.add(job);
    return {
      message:
        'Если такой аккаунт существует, письмо со ссылкой будет отправлено. Повторный запрос — не раньше чем через минуту.',
    };
  }

  private async deliver(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!user) return;
    const issued = await this.prisma.$transaction(async (tx) => {
      await lockResource(tx, `user:${user.id}`);
      const current = await tx.user.findUnique({
        where: { id: user.id },
        select: { email: true, blockedAt: true, authVersion: true },
      });
      if (!current || current.blockedAt) return null;
      const previous = await tx.passwordReset.findUnique({
        where: { userId: user.id },
      });
      if (previous && previous.createdAt.getTime() > Date.now() - 60000)
        return null;
      const token = randomBytes(32).toString('hex');
      const data = {
        tokenHash: digest(token),
        authVersion: current.authVersion,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 15 * 60000),
      };
      await tx.passwordReset.upsert({
        where: { userId: user.id },
        create: { userId: user.id, ...data },
        update: data,
      });
      return { email: current.email, token };
    });
    if (!issued || !this.mail || !this.origin) return;
    const link = new URL('/reset-password', this.origin);
    link.hash = new URLSearchParams({ token: issued.token }).toString();
    await this.mail.sendMail({
      from: { name: 'Favorite', address: this.from },
      to: issued.email,
      subject: 'Восстановление пароля Favorite',
      text: `Чтобы задать новый пароль, откройте ссылку в течение 15 минут:\n\n${link.href}\n\nСсылка одноразовая. Если вы не запрашивали восстановление, просто проигнорируйте письмо.`,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
  }

  public async reset(
    token: string,
    password: string,
  ): Promise<{ message: string }> {
    if (!/^[a-f0-9]{64}$/.test(token))
      throw new BadRequestException(INVALID_LINK);
    const tokenHash = digest(token);
    const reset = await this.prisma.passwordReset.findUnique({
      where: { tokenHash },
    });
    if (!reset || reset.expiresAt.getTime() <= Date.now())
      throw new BadRequestException(INVALID_LINK);
    const passwordHash = await hash(password);
    await this.prisma.$transaction(async (tx) => {
      await lockResource(tx, `user:${reset.userId}`);
      const current = await tx.passwordReset.findUnique({
        where: { tokenHash },
      });
      const user = await tx.user.findUnique({
        where: { id: reset.userId },
        select: { blockedAt: true, authVersion: true },
      });
      if (
        !current ||
        current.expiresAt.getTime() <= Date.now() ||
        !user ||
        user.blockedAt ||
        user.authVersion !== current.authVersion
      )
        throw new BadRequestException(INVALID_LINK);
      await tx.user.update({
        where: { id: reset.userId },
        data: { password: passwordHash, authVersion: { increment: 1 } },
      });
      await tx.passwordReset.delete({ where: { userId: reset.userId } });
    });
    try {
      this.gateway.disconnectUser(reset.userId);
    } catch {
      this.logger.warn('Не удалось отключить соединения после смены пароля');
    }
    return { message: 'Пароль изменён. Войдите с новым паролем.' };
  }

  public async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    this.mail?.close();
    await Promise.allSettled([...this.pending]);
  }
}
