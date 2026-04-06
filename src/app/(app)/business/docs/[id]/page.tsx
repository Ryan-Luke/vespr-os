import { db } from "@/lib/db"
import { knowledgeEntries } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, FileText, Clock, User } from "lucide-react"

export const dynamic = "force-dynamic"

// ── Business Document Detail Page ─────────────────────────────────────
// Full-page view of an agent-generated business document (Business
// Overview, Research Report, Marketing Plan, etc). Linked from the
// My Business page. Renders the document's markdown content in a clean,
// impressive layout.

function renderMarkdown(content: string) {
  // Simple markdown-to-JSX renderer for business documents.
  // Handles: headings, bold, italic, bullet lists, numbered lists,
  // horizontal rules, and paragraphs. No external deps.
  const lines = content.split("\n")
  const elements: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    // Blank line
    if (!trimmed) { i++; continue }

    // Horizontal rule
    if (/^---+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed)) {
      elements.push(<hr key={i} className="border-border my-6" />)
      i++; continue
    }

    // Headings
    if (trimmed.startsWith("## ")) {
      elements.push(
        <h2 key={i} className="text-lg font-semibold mt-8 mb-3 text-foreground">{formatInline(trimmed.slice(3))}</h2>
      )
      i++; continue
    }
    if (trimmed.startsWith("### ")) {
      elements.push(
        <h3 key={i} className="text-base font-medium mt-6 mb-2 text-foreground/90">{formatInline(trimmed.slice(4))}</h3>
      )
      i++; continue
    }
    if (trimmed.startsWith("# ")) {
      elements.push(
        <h1 key={i} className="text-xl font-bold mt-6 mb-4 text-foreground">{formatInline(trimmed.slice(2))}</h1>
      )
      i++; continue
    }

    // Bullet list
    if (/^[-*]\s/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s/, "").trim())
        i++
      }
      elements.push(
        <ul key={`ul-${i}`} className="space-y-1.5 my-3 ml-1">
          {items.map((item, j) => (
            <li key={j} className="flex items-start gap-2.5 text-sm text-foreground/80 leading-relaxed">
              <span className="h-1.5 w-1.5 rounded-full bg-primary/40 mt-2 shrink-0" />
              <span>{formatInline(item)}</span>
            </li>
          ))}
        </ul>
      )
      continue
    }

    // Numbered list
    if (/^\d+\.\s/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s/, "").trim())
        i++
      }
      elements.push(
        <ol key={`ol-${i}`} className="space-y-1.5 my-3 ml-1">
          {items.map((item, j) => (
            <li key={j} className="flex items-start gap-2.5 text-sm text-foreground/80 leading-relaxed">
              <span className="text-xs font-medium text-muted-foreground/60 mt-0.5 w-5 shrink-0 text-right">{j + 1}.</span>
              <span>{formatInline(item)}</span>
            </li>
          ))}
        </ol>
      )
      continue
    }

    // Regular paragraph
    elements.push(
      <p key={i} className="text-sm text-foreground/80 leading-relaxed my-2">{formatInline(trimmed)}</p>
    )
    i++
  }

  return <>{elements}</>
}

function formatInline(text: string): React.ReactNode {
  // Handle **bold** and *italic* inline
  const parts: React.ReactNode[] = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    // Bold
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/)
    // Italic
    const italicMatch = remaining.match(/\*(.+?)\*/)

    const firstMatch = [boldMatch, italicMatch]
      .filter(Boolean)
      .sort((a, b) => (a!.index ?? 0) - (b!.index ?? 0))[0]

    if (!firstMatch || firstMatch.index === undefined) {
      parts.push(remaining)
      break
    }

    if (firstMatch.index > 0) {
      parts.push(remaining.slice(0, firstMatch.index))
    }

    if (firstMatch[0].startsWith("**")) {
      parts.push(<strong key={key++} className="font-semibold text-foreground">{firstMatch[1]}</strong>)
    } else {
      parts.push(<em key={key++} className="italic">{firstMatch[1]}</em>)
    }

    remaining = remaining.slice(firstMatch.index + firstMatch[0].length)
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>
}

export default async function BusinessDocPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [doc] = await db
    .select()
    .from(knowledgeEntries)
    .where(eq(knowledgeEntries.id, id))
    .limit(1)

  if (!doc) notFound()

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Back link */}
        <Link
          href="/business"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to My Business
        </Link>

        {/* Document header */}
        <div className="mb-8">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="h-6 w-6 text-primary/60" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">{doc.title}</h1>
              <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground/60">
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {doc.createdByName}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(doc.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Document body */}
        <div className="prose-container pb-16">
          {renderMarkdown(doc.content)}
        </div>
      </div>
    </div>
  )
}
