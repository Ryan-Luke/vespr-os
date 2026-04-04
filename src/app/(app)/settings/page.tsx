import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Key, Building2, Bell, CreditCard, Shield } from "lucide-react"

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
        </TabsList>

        <TabsContent value="general" className="space-y-4 mt-4">
          <div className="bg-card border border-border rounded-md">
            <div>
              <p className="section-label mb-2">
                <Building2 className="h-4 w-4" />
                Business Profile
              </p>
            </div>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Business Name</Label>
                  <Input defaultValue="My Company" />
                </div>
                <div className="space-y-2">
                  <Label>Industry</Label>
                  <Input defaultValue="Technology" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Business Description</Label>
                <Input defaultValue="SaaS company focused on small business solutions" />
              </div>
              <Button size="sm">Save Changes</Button>
            </div>
          </div>

          <div className="bg-card border border-border rounded-md">
            <div>
              <p className="section-label mb-2">
                <Shield className="h-4 w-4" />
                Agent Controls
              </p>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Require approval for external actions</p>
                  <p className="text-xs text-muted-foreground">
                    Agents must get your approval before sending emails, posting content, etc.
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Monthly budget cap</p>
                  <p className="text-xs text-muted-foreground">
                    Pause all agents if monthly AI costs exceed this amount
                  </p>
                </div>
                <Input defaultValue="$500" className="w-24 text-right" />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Auto-pause on errors</p>
                  <p className="text-xs text-muted-foreground">
                    Automatically pause agents after 3 consecutive errors
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="api-keys" className="space-y-4 mt-4">
          <div className="bg-card border border-border rounded-md">
            <div>
              <p className="section-label mb-2">
                <Key className="h-4 w-4" />
                AI Provider Keys
              </p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Anthropic API Key</Label>
                <div className="flex gap-2">
                  <Input type="password" defaultValue="sk-ant-•••••••••••" className="font-mono" />
                  <Badge variant="secondary" className="shrink-0 self-center">
                    Connected
                  </Badge>
                </div>
              </div>
              <div className="space-y-2">
                <Label>OpenAI API Key</Label>
                <div className="flex gap-2">
                  <Input type="password" defaultValue="sk-•••••••••••" className="font-mono" />
                  <Badge variant="secondary" className="shrink-0 self-center">
                    Connected
                  </Badge>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Google AI API Key</Label>
                <div className="flex gap-2">
                  <Input placeholder="Enter API key..." className="font-mono" />
                  <Badge variant="outline" className="shrink-0 self-center text-muted-foreground">
                    Not set
                  </Badge>
                </div>
              </div>
              <Button size="sm">Save Keys</Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4 mt-4">
          <div className="bg-card border border-border rounded-md">
            <div>
              <p className="section-label mb-2">
                <Bell className="h-4 w-4" />
                Notification Preferences
              </p>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Agent errors</p>
                  <p className="text-xs text-muted-foreground">Get notified when an agent encounters an error</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Approval requests</p>
                  <p className="text-xs text-muted-foreground">Get notified when an agent needs your approval</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Daily summary</p>
                  <p className="text-xs text-muted-foreground">Receive a daily email with your workforce summary</p>
                </div>
                <Switch />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Budget alerts</p>
                  <p className="text-xs text-muted-foreground">Alert when spending exceeds 80% of monthly budget</p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="billing" className="space-y-4 mt-4">
          <div className="bg-card border border-border rounded-md">
            <div>
              <p className="section-label mb-2">
                <CreditCard className="h-4 w-4" />
                Usage & Billing
              </p>
            </div>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">This Month</p>
                  <p className="text-2xl font-bold">$174.90</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Budget Remaining</p>
                  <p className="text-2xl font-bold text-green-500">$325.10</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Last Month</p>
                  <p className="text-2xl font-bold">$190.40</p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
