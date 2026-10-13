import { z } from 'zod';
import type { Workspace } from '@/domain/models';

const memberSchema = z.object({
  userId: z.string(),
  username: z.string(),
  email: z.string().nullable(),
  role: z.enum(['owner', 'admin', 'member', 'observer']),
});
const invitationSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: z.string(),
  expiresAt: z.string(),
  acceptedAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
});
const notificationSchema = z.object({
  id: z.string(),
  kind: z.enum(['mention', 'reply']),
  roomId: z.string(),
  roomName: z.string(),
  messageId: z.string(),
  threadRootId: z.string().nullable(),
  authorName: z.string(),
  excerpt: z.string(),
  createdAt: z.string(),
  readAt: z.string().nullable(),
});
export type Member = z.infer<typeof memberSchema> & {
  workspaceId?: string;
  workspaceName?: string;
};
export type Invitation = z.infer<typeof invitationSchema>;
export type Notification = z.infer<typeof notificationSchema>;
export type CollaboratorRole = 'admin' | 'member' | 'observer';

async function call(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`/api/backend/workspaces/${path}`, {
    cache: 'no-store',
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  if (response.status === 204) return null;
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message ?? 'Action indisponible. Réessayez.');
  return body;
}
export async function listMembers(
  workspace: string,
  globalWorkspaces?: Workspace[],
): Promise<Member[]> {
  if (globalWorkspaces) {
    const groups = await Promise.all(
      globalWorkspaces.map(async (space) => {
        const members = await listMembers(space.id);
        return members.map((member) => ({
          ...member,
          workspaceId: space.id,
          workspaceName: space.name,
        }));
      }),
    );
    return groups.flat();
  }
  return z.object({ items: z.array(memberSchema) }).parse(await call(`${workspace}/members`)).items;
}
export async function listInvitations(workspace: string) {
  return z
    .object({ items: z.array(invitationSchema) })
    .parse(await call(`${workspace}/invitations`)).items;
}
export async function inviteMember(workspace: string, email: string, role: CollaboratorRole) {
  return invitationSchema.extend({ token: z.string() }).parse(
    await call(`${workspace}/invitations`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    }),
  );
}
export async function updateMemberRole(workspace: string, userId: string, role: CollaboratorRole) {
  return memberSchema.parse(
    await call(`${workspace}/members/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),
  );
}
export async function revokeInvitation(workspace: string, id: string) {
  await call(`${workspace}/invitations/${id}`, { method: 'DELETE' });
}
export async function acceptInvitation(token: string) {
  return z
    .object({ workspaceId: z.string() })
    .parse(await call('invitations/accept', { method: 'POST', body: JSON.stringify({ token }) }));
}
export async function listNotifications(workspace: string, cursor?: string) {
  return z
    .object({ items: z.array(notificationSchema), nextCursor: z.string().nullable() })
    .parse(
      await call(
        `${workspace}/notifications${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
      ),
    );
}
export async function markNotificationRead(workspace: string, id: string) {
  await call(`${workspace}/notifications/${id}/read`, { method: 'PUT' });
}
