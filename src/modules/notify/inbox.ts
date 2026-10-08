import { visiblePage } from "@/modules/master/query";
import { denied, type ServiceResult } from "@/modules/master/result";
import { can, type AuthUser } from "@/modules/rbac/policy";
import { countInbox, listInbox, markInboxRead } from "./repo";

export type NotificationDto = {
  id: string;
  title: string;
  body: string;
  anomalyId: string | null;
  correctionId: string | null;
  requestId: string | null;
  readAt: string | null;
  createdAt: string;
};

export async function listNotificationPage(
  actor: AuthUser,
  query: { page: number; pageSize: number },
): Promise<ServiceResult<{ items: NotificationDto[]; unread: number; page: number; pageSize: number; total: number }>> {
  if (!can(actor, "notification.read")) return denied();
  const [{ total, unread }, rows] = await Promise.all([
    countInbox(actor.id),
    listInbox(actor.id, query.page, query.pageSize),
  ]);
  const page = visiblePage(query.page, query.pageSize, total);
  const items = page === query.page ? rows : await listInbox(actor.id, page, query.pageSize);
  return {
    ok: true,
    data: {
      items: items.map((row) => ({
        id: row.id,
        title: row.title,
        body: row.body,
        anomalyId: row.anomalyId,
        correctionId: row.correctionId,
        requestId: row.requestId,
        readAt: row.readAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
      unread,
      page,
      pageSize: query.pageSize,
      total,
    },
  };
}

export async function markNotificationsRead(actor: AuthUser, ids: string[] | undefined): Promise<ServiceResult<{ updated: number }>> {
  if (!can(actor, "notification.read")) return denied();
  const result = await markInboxRead(actor.id, ids, new Date());
  return { ok: true, data: { updated: result.count } };
}
