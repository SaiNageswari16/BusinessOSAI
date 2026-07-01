import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Activity, Cpu, HardDrive, Network, Server, Database, BrainCircuit, RefreshCw } from "lucide-react";

export function SystemHealth() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">System Health</h2>
          <p className="text-sm text-muted-foreground">Real-time infrastructure and application monitoring.</p>
        </div>
        <Button variant="outline" className="bg-background"><RefreshCw className="size-4 mr-2" /> Refresh Status</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6 border-t-4 border-t-emerald-500">
          <div className="flex justify-between items-start mb-4">
            <div className="size-10 rounded-lg bg-emerald-500/10 text-emerald-500 grid place-items-center">
              <Server className="size-5" />
            </div>
            <span className="text-emerald-500 text-xs font-bold bg-emerald-500/10 px-2 py-1 rounded">HEALTHY</span>
          </div>
          <h3 className="text-3xl font-bold font-mono tracking-tight text-foreground">99.99%</h3>
          <p className="text-sm text-muted-foreground mt-1">Global Uptime</p>
        </Card>

        <Card className="p-6 border-t-4 border-t-blue-500">
          <div className="flex justify-between items-start mb-4">
            <div className="size-10 rounded-lg bg-blue-500/10 text-blue-500 grid place-items-center">
              <Cpu className="size-5" />
            </div>
            <span className="text-blue-500 text-xs font-bold bg-blue-500/10 px-2 py-1 rounded">NORMAL</span>
          </div>
          <h3 className="text-3xl font-bold font-mono tracking-tight text-foreground">42%</h3>
          <p className="text-sm text-muted-foreground mt-1">Avg CPU Utilization</p>
        </Card>

        <Card className="p-6 border-t-4 border-t-amber-500">
          <div className="flex justify-between items-start mb-4">
            <div className="size-10 rounded-lg bg-amber-500/10 text-amber-500 grid place-items-center">
              <HardDrive className="size-5" />
            </div>
            <span className="text-amber-500 text-xs font-bold bg-amber-500/10 px-2 py-1 rounded">WARNING</span>
          </div>
          <h3 className="text-3xl font-bold font-mono tracking-tight text-foreground">87%</h3>
          <p className="text-sm text-muted-foreground mt-1">Memory Usage (Peak)</p>
        </Card>

        <Card className="p-6 border-t-4 border-t-primary">
          <div className="flex justify-between items-start mb-4">
            <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
              <BrainCircuit className="size-5" />
            </div>
            <span className="text-primary text-xs font-bold bg-primary/10 px-2 py-1 rounded">ACTIVE</span>
          </div>
          <h3 className="text-3xl font-bold font-mono tracking-tight text-foreground">14.2k</h3>
          <p className="text-sm text-muted-foreground mt-1">AI Tokens Processed /hr</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Card className="p-6">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Database className="size-5 text-primary" /> Database Services</h3>
          <div className="space-y-4">
            {[
              { name: "Primary Master DB (PostgreSQL)", load: "24%", status: "Online" },
              { name: "Read Replica 1 (Asia)", load: "12%", status: "Online" },
              { name: "Redis Cache Cluster", load: "68%", status: "Online" },
            ].map((db, i) => (
              <div key={i} className="flex justify-between items-center p-3 bg-muted/40 rounded-lg">
                <div className="font-medium text-sm">{db.name}</div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground">Load: {db.load}</span>
                  <span className="size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Network className="size-5 text-primary" /> API Gateways & Queues</h3>
          <div className="space-y-4">
            {[
              { name: "Public API Gateway (REST)", metric: "1,245 req/s", status: "Online" },
              { name: "Internal Microservices Mesh", metric: "3.2ms avg latency", status: "Online" },
              { name: "Background Jobs (RabbitMQ)", metric: "14 messages queued", status: "Online" },
            ].map((api, i) => (
              <div key={i} className="flex justify-between items-center p-3 bg-muted/40 rounded-lg">
                <div className="font-medium text-sm">{api.name}</div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground">{api.metric}</span>
                  <span className="size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
