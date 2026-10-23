import type { Prisma } from '../generated/prisma/client';

export async function markMessageNotificationsRead(
  tx: Prisma.TransactionClient,
  userId: string,
  through: Date,
  actorId?: string,
): Promise<void> {
  // Прочтение связываем с сообщением, чтобы новая запись между запросами не потеряла свой статус.
  await tx.$executeRaw`
    UPDATE notifications n SET read_at=CURRENT_TIMESTAMP
    WHERE n.user_id=${userId} AND n.type='CHAT_MESSAGE' AND n.read_at IS NULL
      AND (${actorId ?? null}::text IS NULL OR n.actor_id=${actorId ?? null})
      AND EXISTS (SELECT 1 FROM messages m WHERE m.id=n.payload->>'messageId'
        AND m.receiver_id=${userId} AND m.is_read=true AND m.created_at<=${through})
  `;
}

export async function readConversation(
  tx: Prisma.TransactionClient,
  userId: string,
  actorId: string,
  through: Date,
): Promise<void> {
  await tx.message.updateMany({
    where: {
      receiverId: userId,
      senderId: actorId,
      isRead: false,
      createdAt: { lte: through },
    },
    data: { isRead: true },
  });
  await markMessageNotificationsRead(tx, userId, through, actorId);
}
