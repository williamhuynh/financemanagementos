import { NextResponse } from 'next/server';
import { Query } from 'node-appwrite';
import { createSessionClient } from '../../../../lib/api-auth';
import { COLLECTIONS } from '../../../../lib/collection-names';
import { rateLimit, DATA_RATE_LIMITS } from '../../../../lib/rate-limit';
import { validateBody, WorkspaceSwitchSchema } from '../../../../lib/validations';

export async function POST(request: Request) {
  const blocked = await rateLimit(request, DATA_RATE_LIMITS.write);
  if (blocked) return blocked;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = validateBody(WorkspaceSwitchSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { workspaceId } = parsed.data;

    // Get session client
    const sessionClient = await createSessionClient();
    if (!sessionClient) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await sessionClient.account.get();

    // Verify user is member of target workspace
    const membership = await sessionClient.databases.listDocuments(
      sessionClient.databaseId,
      COLLECTIONS.WORKSPACE_MEMBERS,
      [
        Query.equal('user_id', user.$id),
        Query.equal('workspace_id', workspaceId),
      ]
    );

    if (membership.documents.length === 0) {
      return NextResponse.json(
        { error: 'Not a member of this workspace' },
        { status: 403 }
      );
    }

    // Update user preference
    await sessionClient.account.updatePrefs({ activeWorkspaceId: workspaceId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Workspace switch error:', error);
    return NextResponse.json(
      { error: 'Failed to switch workspace' },
      { status: 500 }
    );
  }
}
