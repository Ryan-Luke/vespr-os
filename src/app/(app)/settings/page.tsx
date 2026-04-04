import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Key, Building2, Bell, CreditCard, Shield, Download } from "lucide-react"
import { DataExport } from "@/components/data-export"
import ApiKeyManager from "@/components/api-key-manager"
import { ThemeSettings } from "@/components/theme-settings"

export default function SettingsPage() {
  return (
    <div className="p-6 space-y-5 max-w-3xl h-full overflow-y-auto">
      <h1 className="text-lg font-semibold tracking-tight">Settings</h1>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="data">Data</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4 mt-4">
          <ThemeSettings />

          <div className="bg-card border border-border rounded-md p-4 space-y-4">
            <p className="section-label">Business Profile</p>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium">Business Name</label>
                <input defaultValue="My Company" className="w-full h-8 rounded-md border border-border bg-muted/50 px-3 text-[13px] outline-none focus:border-muted-foreground/30 transition-colors" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium">Industry</label>
                <input defaultValue="Technology" className="w-full h-8 rounded-md border border-border bg-muted/50 px-3 text-[13px] outline-none focus:border-muted-foreground/30 transition-colors" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium">Description</label>
              <input defaultValue="SaaS company focused on small business solutions" className="w-full h-8 rounded-md border border-border bg-muted/50 px-3 text-[13px] outline-none focus:border-muted-foreground/30 transition-colors" />
            </div>
            <button className="h-7 px-2.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">Save</button>
          </div>

          <div className="bg-card border border-border rounded-md p-4 space-y-4">
            <p className="section-label">Agent Controls</p>
            <div className="space-y-4 divide-y divide-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-medium">Require approval for external actions</p>
                  <p className="text-xs text-muted-foreground">Agents ask before sending emails, posting content, etc.</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between pt-4">
                <div>
                  <p className="text-[13px] font-medium">Monthly budget cap</p>
                  <p className="text-xs text-muted-foreground">Pause agents if costs exceed this amount</p>
                </div>
                <input defaultValue="$500" className="w-20 h-8 rounded-md border border-border bg-muted/50 px-3 text-[13px] text-right outline-none focus:border-muted-foreground/30 transition-colors tabular-nums" />
              </div>
              <div className="flex items-center justify-between pt-4">
                <div>
                  <p className="text-[13px] font-medium">Auto-pause on errors</p>
                  <p className="text-xs text-muted-foreground">Pause after 3 consecutive errors</p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="api-keys" className="space-y-4 mt-4">
          <ApiKeyManager />
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4 mt-4">
          <div className="bg-card border border-border rounded-md p-4">
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
                    <p className="text-[13px] font-medium">{pref.label}</p>
                    <p className="text-xs text-muted-foreground">{pref.desc}</p>
                  </div>
                  <Switch defaultChecked={pref.on} />
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="billing" className="space-y-4 mt-4">
          <div className="bg-card border border-border rounded-md p-4">
            <p className="section-label mb-4">Usage</p>
            <div className="grid gap-px bg-border rounded-md overflow-hidden md:grid-cols-3">
              {[
                { label: "This Month", value: "$174.90" },
                { label: "Budget Left", value: "$325.10", color: "text-emerald-500" },
                { label: "Last Month", value: "$190.40" },
              ].map((s) => (
                <div key={s.label} className="bg-card p-4">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
                  <p className={`text-xl font-semibold tabular-nums mt-0.5 ${s.color || ""}`}>{s.value}</p>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="data" className="space-y-4 mt-4">
          <DataExport />
        </TabsContent>
      </Tabs>
    </div>
  )
}
