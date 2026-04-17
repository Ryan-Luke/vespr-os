import Link from "next/link"

export default function NotFound() {
  return (
    <div className="flex h-screen items-center justify-center bg-background bg-ambient">
      <div className="text-center glass-card rounded-2xl p-12">
        <h1 className="text-4xl font-bold text-foreground mb-2">404</h1>
        <p className="text-muted-foreground mb-4">Page not found</p>
        <Link href="/" className="text-primary hover:underline">
          Go home
        </Link>
      </div>
    </div>
  )
}
