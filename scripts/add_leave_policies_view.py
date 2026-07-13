import os

target = os.path.join("frontend", "src", "components", "hrms", "LeaveManagement.tsx")
with open(target, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update imports
old_imports = "import { leavesApi, LeaveRequest, LeaveBalance } from \"../../lib/api-client\";"
new_imports = "import { leavesApi, LeaveRequest, LeaveBalance, LeavePolicy } from \"../../lib/api-client\";\nimport { BookOpen, FileText } from \"lucide-react\";"

content = content.replace(old_imports, new_imports)

# 2. Add states inside LeaveManagement
old_states = """export function LeaveManagement({ tab = "leave_requests" }: Props) {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(false);"""

new_states = """export function LeaveManagement({ tab = "leave_requests" }: Props) {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [policies, setPolicies] = useState<LeavePolicy[]>([]);
  const [loading, setLoading] = useState(false);

  // Policy form states
  const [policyDialogOpen, setPolicyDialogOpen] = useState(false);
  const [policyName, setPolicyName] = useState("");
  const [policyType, setPolicyType] = useState("Annual");
  const [policyDays, setPolicyDays] = useState("12");
  const [policyApplicable, setPolicyApplicable] = useState("All");"""

content = content.replace(old_states, new_states)

# 3. Update loadLeavesData
old_load = """      const reqsRes = await leavesApi.list(1, 100);
      setRequests(reqsRes.items || []);
      const balsRes = await leavesApi.listBalances();
      setBalances(balsRes || []);"""

new_load = """      const reqsRes = await leavesApi.list(1, 100);
      setRequests(reqsRes.items || []);
      const balsRes = await leavesApi.listBalances();
      setBalances(balsRes || []);
      const polsRes = await leavesApi.listPolicies();
      setPolicies(polsRes || []);"""

content = content.replace(old_load, new_load)

# 4. Add policy creation handler
old_review = """  const handleReview = async (id: string, approve: boolean) => {"""

new_review = """  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await leavesApi.createPolicy({
        name: policyName,
        leave_type: policyType,
        entitled_days: parseInt(policyDays) || 12,
        applicable_to: policyApplicable,
      });
      setPolicyDialogOpen(false);
      setPolicyName("");
      loadLeavesData();
    } catch (err: any) {
      alert("Failed to create policy: " + err.message);
    }
  };

  const handleReview = async (id: string, approve: boolean) => {"""

content = content.replace(old_review, new_review)

# 5. Add Render for tab === "leave_policies"
old_calendar_render = """  if (tab === "leave_calendar") {"""

policies_render_block = """  if (tab === "leave_policies") {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Leave Schemes & Policies</h1>
            <p className="text-sm text-muted-foreground">Configure yearly leave allocation policies for staff.</p>
          </div>
          <Button onClick={() => setPolicyDialogOpen(true)} className="gradient-brand text-white border-0">
            <Plus className="size-4 mr-1.5" /> Create Leave Policy
          </Button>
        </div>

        {loading && policies.length === 0 && (
          <div className="flex justify-center py-12"><Loader2 className="size-8 animate-spin text-primary" /></div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {policies.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className="glass-panel p-6 rounded-xl border border-border/50 hover:shadow-sm transition-shadow flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-primary/10 rounded-xl"><BookOpen className="size-6 text-primary" /></div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${leaveTypeColor(p.leave_type)}`}>
                    {p.leave_type} Leave
                  </span>
                </div>
                <h3 className="font-bold text-foreground text-lg mb-1 leading-tight">{p.name}</h3>
                <p className="text-sm text-muted-foreground mb-4">Entitled limit: <span className="font-bold text-foreground">{p.entitled_days} days / year</span></p>
              </div>
              <div className="border-t pt-4 text-xs flex justify-between text-muted-foreground">
                <span>Applicable To: <span className="font-semibold text-foreground">{p.applicable_to}</span></span>
                <span>Yearly Accrual</span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Create Policy Dialog */}
        {policyDialogOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-2xl bg-card border p-6 space-y-4 shadow-2xl">
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                <BookOpen className="size-5 text-primary" /> Create Leave Policy
              </h3>
              <form onSubmit={handleCreatePolicy} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Policy Name</label>
                  <input type="text" value={policyName} onChange={e => setPolicyName(e.target.value)} placeholder="e.g. Standard Paid Leave" className="w-full h-10 px-3 text-sm rounded-md border bg-background" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Leave Type</label>
                    <select value={policyType} onChange={e => setPolicyType(e.target.value)} className="w-full h-10 px-3 text-sm rounded-md border bg-background">
                      <option>Annual</option>
                      <option>Sick</option>
                      <option>Casual</option>
                      <option>Maternity</option>
                      <option>Unpaid</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Yearly Entitled Days</label>
                    <input type="number" value={policyDays} onChange={e => setPolicyDays(e.target.value)} className="w-full h-10 px-3 text-sm rounded-md border bg-background" required />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Applicable Group</label>
                  <select value={policyApplicable} onChange={e => setPolicyApplicable(e.target.value)} className="w-full h-10 px-3 text-sm rounded-md border bg-background">
                    <option>All</option>
                    <option>Engineering</option>
                    <option>Human Resources</option>
                    <option>Marketing</option>
                    <option>Sales</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setPolicyDialogOpen(false)} className="px-4 py-2 border rounded-md text-sm">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-primary text-white rounded-md text-sm">Save Policy</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (tab === "leave_calendar") {"""

line_ending = "\r\n" if "\r\n" in content else "\n"
content = content.replace(old_calendar_render.replace("\n", line_ending), policies_render_block.replace("\n", line_ending))

with open(target, "w", encoding="utf-8", newline=line_ending) as f:
    f.write(content)

print("Updated LeaveManagement.tsx with Leave Policies configuration dashboard view successfully")
