import "server-only";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/modules/auth/authorization";
import { checkId, ManagementError } from "./management-types";
export async function getNotifications(cursor?: string) {
  const actor = await requireAdmin();
  if (cursor) {
    checkId(cursor);
    if (
      !(await getDb().notification.findFirst({
        where: { id: cursor, recipientId: actor.id },
        select: { id: true },
      }))
    )
      throw new ManagementError(404, "Notification not found.");
  }
  const rows = await getDb().notification.findMany({
    where: { recipientId: actor.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 21,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      title: true,
      message: true,
      readAt: true,
      createdAt: true,
    },
  });
  const unread = await getDb().notification.count({
    where: { recipientId: actor.id, readAt: null },
  });
  return {
    unread,
    rows: rows.slice(0, 20).map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      readAt: row.readAt?.toISOString() ?? null,
    })),
    nextCursor: rows.length > 20 ? rows[19].id : null,
  };
}
export async function markNotificationRead(id: string) {
  const actor = await requireAdmin();
  checkId(id);
  const result = await getDb().notification.updateMany({
    where: { id, recipientId: actor.id, readAt: null },
    data: { readAt: new Date() },
  });
  if (
    !result.count &&
    !(await getDb().notification.findFirst({
      where: { id, recipientId: actor.id },
      select: { id: true },
    }))
  )
    throw new ManagementError(404, "Notification not found.");
  return { id };
}
