/**
 * Onboarding layout -- simple centered layout without sidebar.
 * The user hasn't finished setup yet so we don't show the main app chrome.
 */
export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-black">
      {children}
    </div>
  )
}
