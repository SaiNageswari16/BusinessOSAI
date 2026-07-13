import os

target = os.path.join("frontend", "src", "components", "hrms", "PayrollManagement.tsx")
with open(target, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update imports
old_imports = "import { payrollApi, employeesApi, SalaryStructure, Payslip, Employee } from \"../../lib/api-client\";"
new_imports = "import { payrollApi, employeesApi, designationsApi, SalaryStructure, Payslip, Employee, PayGrade, Designation } from \"../../lib/api-client\";\nimport { Briefcase, Settings } from \"lucide-react\";"

content = content.replace(old_imports, new_imports)

# 2. Add states
old_states = """export function PayrollManagement({ tab = "salary_structure" }: Props) {
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);"""

new_states = """export function PayrollManagement({ tab = "salary_structure" }: Props) {
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payGrades, setPayGrades] = useState<PayGrade[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [loading, setLoading] = useState(false);

  // Pay Grade form states
  const [gradeDialogOpen, setGradeDialogOpen] = useState(false);
  const [gradeName, setGradeName] = useState("");
  const [gradeDesigId, setGradeDesigId] = useState("");"""

content = content.replace(old_states, new_states)

# 3. Update loadPayrollData
old_load = """      const structsRes = await payrollApi.listSalaryStructures();
      setStructures(structsRes || []);
      
      const slipsRes = await payrollApi.listPayslips();
      setPayslips(slipsRes || []);

      const empsRes = await employeesApi.list(1, 100);
      setEmployees(empsRes.items || []);"""

new_load = """      const structsRes = await payrollApi.listSalaryStructures();
      setStructures(structsRes || []);
      
      const slipsRes = await payrollApi.listPayslips();
      setPayslips(slipsRes || []);

      const empsRes = await employeesApi.list(1, 100);
      setEmployees(empsRes.items || []);

      const gradesRes = await payrollApi.listPayGrades();
      setPayGrades(gradesRes || []);

      const desigsRes = await designationsApi.list(1, 100);
      setDesignations(desigsRes.items || []);"""

content = content.replace(old_load, new_load)

# 4. Add Pay Grade handler
old_handler = """  const handleCreateStructure = async (e: React.FormEvent) => {"""

new_handler = """  const handleCreatePayGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradeName || !gradeDesigId) return;
    try {
      await payrollApi.createPayGrade({
        name: gradeName,
        designation_id: gradeDesigId,
        basic_salary: parseFloat(basicSalary) || 0,
        hra: parseFloat(hra) || 0,
        other_allowances: parseFloat(otherAllow) || 0,
        pf_deduction: parseFloat(pf) || 0,
        esi_deduction: parseFloat(esi) || 0,
        tds_deduction: parseFloat(tds) || 0,
      });
      setGradeDialogOpen(false);
      setGradeName("");
      setGradeDesigId("");
      setBasicSalary("");
      setHra("");
      setOtherAllow("");
      setPf("");
      setEsi("");
      setTds("");
      loadPayrollData();
    } catch (err: any) {
      alert("Failed to create pay grade: " + err.message);
    }
  };

  const handleCreateStructure = async (e: React.FormEvent) => {"""

content = content.replace(old_handler, new_handler)

# 5. Add Render for tab === "pay_grades"
old_render_start = """  if (tab === "payroll_processing") {"""

pay_grades_render_block = """  if (tab === "pay_grades") {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Designation Pay Grades</h1>
            <p className="text-sm text-muted-foreground">Define default salary structure templates mapped to designations.</p>
          </div>
          <Button onClick={() => setGradeDialogOpen(true)} className="gradient-brand text-white border-0">
            <Plus className="size-4 mr-1.5" /> Create Pay Grade
          </Button>
        </div>

        {loading && payGrades.length === 0 && (
          <div className="flex justify-center py-12"><Loader2 className="size-8 animate-spin text-primary" /></div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {payGrades.map((g, i) => {
            const allowances = g.hra + g.other_allowances;
            const deductions = g.pf_deduction + g.esi_deduction + g.tds_deduction;
            const net = (g.basic_salary + allowances) - deductions;
            return (
              <motion.div key={g.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                className="glass-panel p-6 rounded-xl border border-border/50 hover:shadow-sm transition-shadow flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-primary/10 rounded-xl"><Briefcase className="size-6 text-primary" /></div>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold uppercase bg-emerald-500/10 text-emerald-500">
                      Mapped
                    </span>
                  </div>
                  <h3 className="font-bold text-foreground text-lg mb-1 leading-tight">{g.name}</h3>
                  <p className="text-xs text-muted-foreground mb-4">Designation: <span className="font-semibold text-foreground">{g.designation_name || "Unassigned"}</span></p>
                  
                  <div className="grid grid-cols-3 gap-3 text-xs mb-4">
                    <div className="bg-muted/40 p-2 rounded border"><p className="text-muted-foreground uppercase font-bold text-[9px]">Basic</p><p className="font-semibold text-foreground">${g.basic_salary.toLocaleString()}</p></div>
                    <div className="bg-muted/40 p-2 rounded border"><p className="text-muted-foreground uppercase font-bold text-[9px]">Allowances</p><p className="font-semibold text-emerald-500">+${allowances.toLocaleString()}</p></div>
                    <div className="bg-muted/40 p-2 rounded border"><p className="text-muted-foreground uppercase font-bold text-[9px]">Deductions</p><p className="font-semibold text-red-500">-${deductions.toLocaleString()}</p></div>
                  </div>
                </div>
                <div className="border-t pt-4 flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Estimated Net Payout:</span>
                  <span className="text-sm font-bold text-emerald-500">${net.toLocaleString()} / mo</span>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Create Pay Grade Dialog */}
        {gradeDialogOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl bg-card border p-6 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                <Briefcase className="size-5 text-primary" /> Create Pay Grade Template
              </h3>
              <form onSubmit={handleCreatePayGrade} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Grade Name *</label>
                    <input type="text" value={gradeName} onChange={e => setGradeName(e.target.value)} placeholder="e.g. Lead Dev Grade" className="w-full h-10 px-3 text-sm rounded-md border bg-background" required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Target Designation *</label>
                    <select value={gradeDesigId} onChange={e => setGradeDesigId(e.target.value)} className="w-full h-10 px-3 text-sm rounded-md border bg-background" required>
                      <option value="">-- Choose Designation --</option>
                      {designations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Basic Salary *</label>
                    <input type="number" value={basicSalary} onChange={e => setBasicSalary(e.target.value)} placeholder="e.g. 5000" className="w-full h-10 px-3 text-sm rounded-md border bg-background" required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">HRA Allowance</label>
                    <input type="number" value={hra} onChange={e => setHra(e.target.value)} placeholder="e.g. 2000" className="w-full h-10 px-3 text-sm rounded-md border bg-background" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Other Allowances</label>
                    <input type="number" value={otherAllow} onChange={e => setOtherAllow(e.target.value)} placeholder="e.g. 1000" className="w-full h-10 px-3 text-sm rounded-md border bg-background" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">PF Deduction</label>
                    <input type="number" value={pf} onChange={e => setPf(e.target.value)} placeholder="e.g. 600" className="w-full h-10 px-3 text-sm rounded-md border bg-background" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">ESI Deduction</label>
                    <input type="number" value={esi} onChange={e => setEsi(e.target.value)} placeholder="37" className="w-full h-10 px-2 text-xs rounded-md border bg-background" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">TDS Deduction</label>
                    <input type="number" value={tds} onChange={e => setTds(e.target.value)} placeholder="500" className="w-full h-10 px-2 text-xs rounded-md border bg-background" />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setGradeDialogOpen(false)} className="px-4 py-2 border rounded-md text-sm">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-primary text-white rounded-md text-sm">Create pay grade</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (tab === "payroll_processing") {"""

line_ending = "\r\n" if "\r\n" in content else "\n"
content = content.replace(old_render_start.replace("\n", line_ending), pay_grades_render_block.replace("\n", line_ending))

with open(target, "w", encoding="utf-8", newline=line_ending) as f:
    f.write(content)

print("Updated PayrollManagement.tsx with Pay Grades template configuration view successfully")
