import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ReleaseNoteDto } from './announcement.dto';

export async function parseReleaseNote(
  content: string,
): Promise<ReleaseNoteDto | null> {
  const value: unknown = JSON.parse(content);
  if (value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value))
    throw new Error('INVALID_RELEASE_NOTE');
  const dto = plainToInstance(ReleaseNoteDto, value);
  if (
    (await validate(dto, { whitelist: true, forbidNonWhitelisted: true }))
      .length
  )
    throw new Error('INVALID_RELEASE_NOTE');
  return dto;
}
