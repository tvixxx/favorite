import 'reflect-metadata';
import { readFile, stat } from 'node:fs/promises';
import { parseReleaseNote } from './release-note';
import { PrismaService } from '../prisma/prisma.service';
import { AnnouncementService } from './announcement.service';

async function main(): Promise<void> {
  const file = process.argv[2];
  if (!file || (await stat(file)).size > 24000)
    throw new Error('INVALID_RELEASE_FILE');
  const dto = await parseReleaseNote(await readFile(file, 'utf8'));
  if (!dto) {
    process.stdout.write('RELEASE_ANNOUNCEMENT_SKIPPED\n');
    return;
  }
  const prisma = new PrismaService();
  try {
    await prisma.$connect();
    await new AnnouncementService(prisma).publishRelease(dto);
    process.stdout.write('RELEASE_ANNOUNCEMENT_OK ' + dto.id + '\n');
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module)
  void main().catch(() => {
    process.stderr.write(
      'RELEASE_ANNOUNCEMENT_FAILED: check the release file and database migration\n',
    );
    process.exitCode = 1;
  });
