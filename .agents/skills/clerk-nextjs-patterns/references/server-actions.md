# Server Actions

Server Actions are public endpoints. Always verify auth.

## Basic Protection

```typescript
'use server';
import { auth } from '@clerk/nextjs/server';

export async function createPost(formData: FormData) {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated) throw new Error('Unauthorized');

  const title = formData.get('title') as string;
  await db.posts.create({ data: { title, authorId: userId } });
  revalidatePath('/posts');
}
```

## Org + Role Check (B2B)

```typescript
'use server';
import { auth } from '@clerk/nextjs/server';

export async function createTeamProject(formData: FormData) {
  const { userId, orgId, orgRole } = await auth();
  if (!userId || !orgId) throw new Error('Must be in an organization');
  if (orgRole !== 'org:admin') throw new Error('Only admins can create projects');

  const name = formData.get('name') as string;
  await db.projects.create({ data: { name, organizationId: orgId } });
}
```

## Permission Check (RBAC)

```typescript
'use server';
import { auth } from '@clerk/nextjs/server';

export async function deleteProject(projectId: string) {
  const { userId, orgId, has } = await auth();
  if (!userId || !orgId) throw new Error('Must be in an organization');

  const canDelete = await has({ permission: 'org:project:delete' });
  if (!canDelete) throw new Error('Missing permission');

  // The permission applies to the active org only, so scope the delete to it.
  const { count } = await db.projects.deleteMany({
    where: { id: projectId, organizationId: orgId },
  });
  if (count === 0) throw new Error('Project not found');
}
```

> **Core 2 ONLY (skip if current SDK):** `isAuthenticated` is not available. Use `if (!userId)` instead.

[Docs](https://clerk.com/docs/reference/nextjs/server-actions)
