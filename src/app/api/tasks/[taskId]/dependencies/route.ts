import { db } from "@/lib/db"
import { taskDependencies, tasks as tasksTable } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { withAuth } from "@/lib/auth/with-auth"

// GET /api/tasks/[taskId]/dependencies
// Returns tasks this task depends on (blockedBy) and tasks that depend on it (blocks)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  await withAuth()
  const { taskId } = await params

  // Tasks this task depends on (blockedBy)
  const blockedByRaw = await db
    .select({
      id: taskDependencies.id,
      taskId: taskDependencies.taskId,
      dependsOnTaskId: taskDependencies.dependsOnTaskId,
      status: taskDependencies.status,
      dependsOnTitle: tasksTable.title,
      dependsOnStatus: tasksTable.status,
    })
    .from(taskDependencies)
    .leftJoin(tasksTable, eq(taskDependencies.dependsOnTaskId, tasksTable.id))
    .where(eq(taskDependencies.taskId, taskId))

  // Tasks that depend on this task (blocks)
  const blocksRaw = await db
    .select({
      id: taskDependencies.id,
      taskId: taskDependencies.taskId,
      dependsOnTaskId: taskDependencies.dependsOnTaskId,
      status: taskDependencies.status,
      blocksTitle: tasksTable.title,
      blocksStatus: tasksTable.status,
    })
    .from(taskDependencies)
    .leftJoin(tasksTable, eq(taskDependencies.taskId, tasksTable.id))
    .where(eq(taskDependencies.dependsOnTaskId, taskId))

  return Response.json({
    blockedBy: blockedByRaw,
    blocks: blocksRaw,
  })
}
