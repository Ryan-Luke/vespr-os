import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Key, Building2, Bell, CreditCard, Shield, Download, ArrowRight } from "lucide-react"
import { DataExport } from "@/components/data-export"
import ApiKeyManager from "@/components/api-key-manager"
import { ThemeSettings } from "@/components/theme-settings"
import { TeamInvites } from "@/components/team-invites"
import { WorkspaceNameEditor } from "@/components/workspace-name-editor"
import { BillingUsage } from "@/components/billing-usage"
import Link from "next/link"

export default function SettingsPage() {
  return (
    <div className="p-6 space-y-5 max-w-3xl h-full overflow-y-auto">
      <h1 className="text-lg font-semibold tracking-tight">Settings</h1>

      <Tabs defaultValue="general">
        <TabsList className="bg-transparent border-b border-border rounded-none p-0 h-auto gap-0">
          <TabsTrigger value="general" className="rounded-none border-b-2 border-transparent data-[state=active]:border-teal-500 data-[state=active]:text-teal-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-2">General</TabsTrigger>
          <TabsTrigger value="team" className="rounded-none border-b-2 border-transparent data-[state=active]:border-teal-500 data-[state=active]:text-teal-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-2">Team</TabsTrigger>
          <TabsTrigger value="api-keys" className="rounded-none border-b-2 border-transparent data-[state=active]:border-teal-500 data-[state=active]:text-teal-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-2">API Keys</TabsTrigger>
          <TabsTrigger value="notifications" className="rounded-none border-b-2 border-transparent data-[state=active]:border-teal-500 data-[state=active]:text-teal-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-2">Notifications</TabsTrigger>
          <TabsTrigger value="billing" className="rounded-none border-b-2 border-transparent data-[state=active]:border-teal-500 data-[state=active]:text-teal-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-2">Billing</TabsTrigger>
          <TabsTrigger value="data" className="rounded-none border-b-2 border-transparent data-[state=active]:border-teal-500 data-[state=active]:text-teal-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-2">Data</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-8 mt-8 glass-subtle rounded-lg p-4">
          <WorkspaceNameEditor />
          <ThemeSettings />

          <Link href="/business" className="block glass-card border border-border rounded-md p-4 hover:border-muted-foreground/30 transition-colors group">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                  <Building2 className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-[13px] font-medium">Business Profile</p>
                  <p className="text-xs text-muted-foreground">Edit your mission, ICP, verticals, and tool stack</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
          </Link>

          <div className="glass-card border border-border rounded-md p-4 space-y-4">
            <p className="section-label">Agent Controls</p>
            <div className="space-y-4 divide-y divide-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-medium">Require approval for external actions <span className="text-[11px] text-muted-foreground font-normal">(per-agent — set in agent settings)</span></p>
                  <p className="text-xs text-muted-foreground">Agents ask before sending emails, posting content, etc.</p>
                </div>
                <Switch defaultChecked disabled />
              </div>
              <div className="flex items-center justify-between pt-4">
                <div>
                  <p className="text-[13px] font-medium">Monthly budget cap <span className="text-[11px] text-muted-foreground font-normal">(coming soon)</span></p>
                  <p className="text-xs text-muted-foreground">Pause agents if costs exceed this amount</p>
                </div>
                <input defaultValue="$500" disabled className="w-20 h-8 rounded-lg input-glass px-3 text-[13px] text-right outline-none transition-colors tabular-nums opacity-50" />
              </div>
              <div className="flex items-center justify-between pt-4">
                <div>
                  <p className="text-[13px] font-medium">Auto-pause on errors <span className="text-[11px] text-muted-foreground font-normal">(coming soon)</span></p>
                  <p className="text-xs text-muted-foreground">Pause after 3 consecutive errors</p>
                </div>
                <Switch defaultChecked disabled />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="team" className="space-y-8 mt-8 glass-subtle rounded-lg p-4">
          <TeamInvites />
        </TabsContent>

        <TabsContent value="api-keys" className="space-y-8 mt-8 glass-subtle rounded-lg p-4">
          <ApiKeyManager />
        </TabsContent>

        <TabsContent value="notifications" className="space-y-8 mt-8 glass-subtle rounded-lg p-4">
          <div className="glass-card border border-border rounded-md p-4">
            <p className="section-label mb-4">Notification Preferences</p>
            <div className="space-y-4 divide-y divide-border">
              {[
                { label: "Agent errors", desc: "When an agent encounters an error", on: true },
                { label: "Approval requests", desc: "When an agent needs your approval", on: true },
                { label: "Daily summary", desc: "Daily email with workforce summary", on: false },
                { label: "Budget alerts", desc: "When spending exceeds 80% of budget", on: true },
              ].map((pref, i) => (
                <div key={pref.label} className={`flex items-center justify-between ${i > 0 ? "pt-4" : ""}`}>
                  <div>
                    <p className="text-[13px] font-medium">{pref.label} <span className="text-[11px] text-muted-foreground font-normal">(coming soon)</span></p>
                    <p className="text-xs text-muted-foreground">{pref.desc}</p>
                  </div>
                  <Switch defaultChecked={pref.on} disabled />
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="billing" className="space-y-8 mt-8 glass-subtle rounded-lg p-4">
          <BillingUsage />
        </TabsContent>

        <TabsContent value="data" className="space-y-8 mt-8 glass-subtle rounded-lg p-4">
          <DataExport />
        </TabsContent>
      </Tabs>
    </div>
  )
}
