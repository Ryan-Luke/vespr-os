import { db } from "@/lib/db"
import { agentThreadMessages, agents } from "@/lib/db/schema"
import { eq, asc } from "drizzle-orm"
import { withAuth } from "@/lib/auth/with-auth"

// GET /api/agent-threads/[threadId]/messages — List messages in a thread
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  await withAuth()
  const { threadId } = await params

  const messages = await db
    .select({
      id: agentThreadMessages.id,
      threadId: agentThreadMessages.threadId,
      senderAgentId: agentThreadMessages.senderAgentId,
      content: agentThreadMessages.content,
      messageType: agentThreadMessages.messageType,
      referencedArtifactIds: agentThreadMessages.referencedArtifactIds,
      metadata: agentThreadMessages.metadata,
      createdAt: agentThreadMessages.createdAt,
      senderName: agents.name,
      senderAvatar: agents.avatar,
      senderPixelAvatarIndex: agents.pixelAvatarIndex,
    })
    .from(agentThreadMessages)
    .leftJoin(agents, eq(agentThreadMessages.senderAgentId, agents.id))
    .where(eq(agentThreadMessages.threadId, threadId))
    .orderBy(asc(agentThreadMessages.createdAt))

  return Response.json({ messages })
}
