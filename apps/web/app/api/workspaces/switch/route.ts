import { NextResponse } from 'next/server';
import { Query } from 'node-appwrite';
import { createSessionClient } from '../../../../lib/api-auth';
import { COLLECTIONS } from '../../../../lib/collection-names';

export async function POST(request: Request) {
  try {
    const { workspaceId } = await request.json();

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID is required' },
        { status: 400 }
      );
    }

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
