import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Plus, Download, FileText, CreditCard, DollarSign, Shield, Loader2,
  Printer, Sparkles, Zap, CheckCircle2, Edit3, Check, Briefcase, Settings,
  Wallet, Banknote, Award, TrendingUp, Coins, Percent, CalendarCheck,
  CalendarClock, Clock, ArrowUpRight, CheckCheck, AlertCircle, Calendar,
  List, ChevronLeft, ChevronRight, Search, Filter, Sliders, Trash2, Save
} from "lucide-react";
import { payrollApi, employeesApi, designationsApi, resolveImageUrl, SalaryStructure, Payslip, Employee, PayGrade, Designation } from "../../lib/api-client";
import { Button } from "../ui/button";
import { useCurrency } from "@/hooks/use-currency";
import { useTenant } from "@/contexts/tenant-context";
import { getActiveBillingGst } from "@/lib/receipt-template-store";
import { EnterprisePayrollProcessing } from "./EnterprisePayrollProcessing";

interface Props { tab?: string; }

const payslipStatusStyle = (s: string) => {
  if (s === "Paid" || s === "Approved" || s === "Disbursed" || s === "Active") return "bg-emerald-500/10 text-emerald-500";
  if (s === "Processing" || s === "Pending") return "bg-amber-500/10 text-amber-500";
  if (s === "Rejected" || s === "Cancelled") return "bg-red-500/10 text-red-500";
  return "bg-muted text-muted-foreground";
};

export function PayrollManagement({ tab = "salary_structure" }: Props) {
    const { currency, formatCurrency } = useCurrency();
    const { tenant } = useTenant();
    const activeGst = getActiveBillingGst();
    const orgName = activeGst?.trade_name || activeGst?.legal_name || tenant?.name || "BusinessOS Enterprise";
    const rawLogo = (activeGst as any)?.logo_url || tenant?.logo_url || (tenant as any)?.raw?.logo_url || "";
    const orgLogo = resolveImageUrl(rawLogo);
    const orgInitials = orgName.substring(0, 2).toUpperCase();
    const orgAddress = activeGst?.address || tenant?.settings?.address || "100 Innovation Boulevard, Tech District";
    const orgGstin = activeGst?.gstin || tenant?.settings?.gstin || "";
    const orgCin = activeGst?.cin || tenant?.settings?.cin || "";
    const orgEmail = activeGst?.email || tenant?.settings?.email || "hr@businessos.ai";
    const orgPhone = activeGst?.phone || tenant?.settings?.phone || "+91 (800) 555-0199";
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payGrades, setPayGrades] = useState<PayGrade[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [loansList, setLoansList] = useState<any[]>([]);
  const [advancesList, setAdvancesList] = useState<any[]>([]);
  const [bonusesList, setBonusesList] = useState<any[]>([]);
  const [commissionsList, setCommissionsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Pay Grade form states
  const [gradeDialogOpen, setGradeDialogOpen] = useState(false);
  const [gradeName, setGradeName] = useState("");
  const [gradeDesigId, setGradeDesigId] = useState("");

  // Form states for creating structure
  const [structDialogOpen, setStructDialogOpen] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [basicSalary, setBasicSalary] = useState("");
  const [hra, setHra] = useState("");
  const [otherAllow, setOtherAllow] = useState("");
  const [pf, setPf] = useState("");
  const [esi, setEsi] = useState("");
  const [tds, setTds] = useState("");
  const [otherDed, setOtherDed] = useState("");

  // Process payroll states
  const [processDialogOpen, setProcessDialogOpen] = useState(false);
  const [processEmpId, setProcessEmpId] = useState("");
  const [processMonth, setProcessMonth] = useState("7");
  const [processYear, setProcessYear] = useState("2026");

  // Batch process states
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [batchMonth, setBatchMonth] = useState("7");
  const [batchYear, setBatchYear] = useState("2026");
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchSuccess, setBatchSuccess] = useState(false);

  // Loans form states
  const [loanDialogOpen, setLoanDialogOpen] = useState(false);
  const [loanEmpId, setLoanEmpId] = useState("");
  const [loanType, setLoanType] = useState("Personal");
  const [loanPrincipal, setLoanPrincipal] = useState("50000");
  const [loanInterest, setLoanInterest] = useState("0");
  const [loanTenure, setLoanTenure] = useState("12");
  const [loanReason, setLoanReason] = useState("");
  const [loanStartMonth, setLoanStartMonth] = useState("7");
  const [loanStartYear, setLoanStartYear] = useState("2026");

  // Advances form states
  const [advanceDialogOpen, setAdvanceDialogOpen] = useState(false);
  const [advanceEmpId, setAdvanceEmpId] = useState("");
  const [advanceAmount, setAdvanceAmount] = useState("15000");
  const [advanceReason, setAdvanceReason] = useState("");
  const [advanceMonth, setAdvanceMonth] = useState("7");
  const [advanceYear, setAdvanceYear] = useState("2026");

  // Bonuses form states
  const [bonusDialogOpen, setBonusDialogOpen] = useState(false);
  const [bonusEmpId, setBonusEmpId] = useState("");
  const [bonusTitle, setBonusTitle] = useState("");
  const [bonusType, setBonusType] = useState("Festive");
  const [bonusAmount, setBonusAmount] = useState("10000");
  const [bonusMonth, setBonusMonth] = useState("7");
  const [bonusYear, setBonusYear] = useState("2026");
  const [bonusRemarks, setBonusRemarks] = useState("");

  // Commissions form states
  const [commDialogOpen, setCommDialogOpen] = useState(false);
  const [commEmpId, setCommEmpId] = useState("");
  const [commMonth, setCommMonth] = useState("7");
  const [commYear, setCommYear] = useState("2026");
  const [commTarget, setCommTarget] = useState("500000");
  const [commAchieved, setCommAchieved] = useState("650000");
  const [commRate, setCommRate] = useState("5");
  const [commCalcMode, setCommCalcMode] = useState<"progressive" | "tier" | "flat">("progressive");
  const [selectedCommissionDetail, setSelectedCommissionDetail] = useState<any | null>(null);
  const [commNotes, setCommNotes] = useState("");

  // Dynamic Slab Settings State
  const defaultSlabs = [
    { tier: "Slab 1 (Base Tier)", min: 0, max: 10000, rate: 2.0, color: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
    { tier: "Slab 2 (Silver Tier)", min: 10000, max: 50000, rate: 5.0, color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20" },
    { tier: "Slab 3 (Gold Tier)", min: 50000, max: 100000, rate: 8.0, color: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
    { tier: "Slab 4 (Platinum Tier)", min: 100000, max: null, rate: 12.0, color: "text-purple-500 bg-purple-500/10 border-purple-500/20" },
  ];
  const [configuredSlabs, setConfiguredSlabs] = useState<any[]>(defaultSlabs);
  const [milestoneBonusAmt, setMilestoneBonusAmt] = useState<number>(250);
  const [milestoneBonusActive, setMilestoneBonusActive] = useState<boolean>(true);
  const [slabConfigModalOpen, setSlabConfigModalOpen] = useState(false);
  const [savingSlabPlan, setSavingSlabPlan] = useState(false);
  const [inlineCustomizeSlabs, setInlineCustomizeSlabs] = useState(false);

  // Payslips month-wise filtering and calendar view states
  const [payslipFilterMonth, setPayslipFilterMonth] = useState<string>("all");
  const [payslipFilterYear, setPayslipFilterYear] = useState<string>("2026");
  const [payslipSearch, setPayslipSearch] = useState<string>("");
  const [payslipViewMode, setPayslipViewMode] = useState<"table" | "calendar">("table");
  const [calMonth, setCalMonth] = useState<number>(7);
  const [calYear, setCalYear] = useState<number>(2026);
  const [selectedCalDay, setSelectedCalDay] = useState<number | null>(null);

  // Automated statutory formula based on Basic Salary (first entry)
  const calculateStatutory = (basicNum: number) => {
    const basic = Math.max(0, basicNum || 0);
    const calculatedHra = Math.round(basic * 0.40); // Standard 40%
    const calculatedOther = Math.round(basic * 0.10); // Standard 10%
    const gross = basic + calculatedHra + calculatedOther;
    const calculatedPf = basic > 0 ? Math.round(Math.min(basic, 15000) * 0.12) : 0; // EPFO standard 12% capped at 1800
    const calculatedEsi = (gross > 0 && gross <= 21000) ? Math.round(gross * 0.0075) : 0; // ESIC standard 0.75%
    const annualGross = gross * 12;
    const calculatedTds = (annualGross > 700000) ? Math.round(((annualGross - 700000) * 0.10) / 12) : 0;
    const calculatedOtherDed = 0;
    const totalDeductions = calculatedPf + calculatedEsi + calculatedTds + calculatedOtherDed;
    const calculatedNet = gross - totalDeductions;

    return {
      basic,
      hra: calculatedHra,
      otherAllow: calculatedOther,
      pf: calculatedPf,
      esi: calculatedEsi,
      tds: calculatedTds,
      otherDed: calculatedOtherDed,
      gross,
      totalDeductions,
      net: calculatedNet,
    };
  };

  const applyBasicSalaryAutoFill = (val: string) => {
    setBasicSalary(val);
    if (!val) {
      setHra("");
      setOtherAllow("");
      setPf("");
      setEsi("");
      setTds("");
      setOtherDed("");
      return;
    }
    const num = parseFloat(val) || 0;
    const auto = calculateStatutory(num);
    setHra(auto.hra > 0 ? auto.hra.toString() : "");
    setOtherAllow(auto.otherAllow > 0 ? auto.otherAllow.toString() : "");
    setPf(auto.pf > 0 ? auto.pf.toString() : "");
    setEsi(auto.esi > 0 ? auto.esi.toString() : "");
    setTds(auto.tds > 0 ? auto.tds.toString() : "");
    setOtherDed("0");
  };

  const handleSelectEmployeeForStructure = (empId: string) => {
    setSelectedEmpId(empId);
    if (!empId) return;

    // Check if employee already has an existing structure
    const existing = structures.find(s => s.employee_id === empId);
    if (existing) {
      setBasicSalary(existing.basic_salary?.toString() || "");
      setHra(existing.hra?.toString() || "");
      setOtherAllow(existing.other_allowances?.toString() || "");
      setPf(existing.pf_deduction?.toString() || "");
      setEsi(existing.esi_deduction?.toString() || "");
      setTds(existing.tds_deduction?.toString() || "");
      setOtherDed(existing.other_deductions?.toString() || "");
      return;
    }

    // Otherwise check if employee has basic_salary in employee record
    const emp = employees.find(e => e.id === empId);
    if (emp && emp.basic_salary) {
      applyBasicSalaryAutoFill(emp.basic_salary.toString());
    } else {
      applyBasicSalaryAutoFill("45000");
    }
  };

  const loadPayrollData = useCallback(async () => {
    setLoading(true);
    try {
      const [structsRes, slipsRes, empsRes, gradesRes, desigsRes, loansRes, advsRes, bonusesRes, commsRes] = await Promise.allSettled([
        payrollApi.listSalaryStructures(),
        payrollApi.listPayslips(),
        employeesApi.list(1, 100),
        payrollApi.listPayGrades(),
        designationsApi.list(1, 100),
        payrollApi.listLoans(),
        payrollApi.listAdvances(),
        payrollApi.listBonuses(),
        payrollApi.listCommissions(),
      ]);

      if (structsRes.status === "fulfilled" && Array.isArray(structsRes.value)) {
        setStructures(structsRes.value);
      }
      if (slipsRes.status === "fulfilled" && Array.isArray(slipsRes.value)) {
        setPayslips(slipsRes.value);
      }
      if (empsRes.status === "fulfilled" && empsRes.value) {
        setEmployees(Array.isArray(empsRes.value) ? empsRes.value : empsRes.value.items || []);
      }
      if (gradesRes.status === "fulfilled" && Array.isArray(gradesRes.value)) {
        setPayGrades(gradesRes.value);
      }
      if (desigsRes.status === "fulfilled" && desigsRes.value) {
        setDesignations(Array.isArray(desigsRes.value) ? desigsRes.value : desigsRes.value.items || []);
      }
      if (loansRes.status === "fulfilled" && Array.isArray(loansRes.value)) {
        setLoansList(loansRes.value);
      }
      if (advsRes.status === "fulfilled" && Array.isArray(advsRes.value)) {
        setAdvancesList(advsRes.value);
      }
      if (bonusesRes.status === "fulfilled" && Array.isArray(bonusesRes.value)) {
        setBonusesList(bonusesRes.value);
      }
      if (commsRes.status === "fulfilled" && Array.isArray(commsRes.value)) {
        setCommissionsList(commsRes.value);
      }

      // Load dynamic slab plan
      try {
        const slabPlanRes = await payrollApi.getCommissionSlabPlan();
        if (slabPlanRes && Array.isArray(slabPlanRes.slabs) && slabPlanRes.slabs.length > 0) {
          const colors = [
            "text-blue-500 bg-blue-500/10 border-blue-500/20",
            "text-indigo-500 bg-indigo-500/10 border-indigo-500/20",
            "text-amber-500 bg-amber-500/10 border-amber-500/20",
            "text-purple-500 bg-purple-500/10 border-purple-500/20",
            "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
            "text-rose-500 bg-rose-500/10 border-rose-500/20",
          ];
          setConfiguredSlabs(slabPlanRes.slabs.map((s, idx) => ({
            ...s,
            color: s.color || colors[idx % colors.length]
          })));
          if (slabPlanRes.milestone_bonus_amount !== undefined) setMilestoneBonusAmt(slabPlanRes.milestone_bonus_amount);
          if (slabPlanRes.milestone_bonus_enabled !== undefined) setMilestoneBonusActive(slabPlanRes.milestone_bonus_enabled);
          if (slabPlanRes.calculation_mode) setCommCalcMode(slabPlanRes.calculation_mode as any);
        }
      } catch (e) {
        console.warn("Could not fetch slab plan, using defaults", e);
      }
    } catch (e) {
      console.error("Failed to load payroll data", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPayrollData();
  }, [loadPayrollData]);

  const handleSaveSlabPlan = async () => {
    setSavingSlabPlan(true);
    try {
      await payrollApi.saveCommissionSlabPlan({
        name: "Standard Corporate Slabs",
        calculation_mode: commCalcMode,
        slabs: configuredSlabs.map(s => ({
          tier: s.tier,
          min: parseFloat(s.min) || 0,
          max: (s.max !== null && s.max !== undefined && String(s.max).trim() !== "" && String(s.max).toLowerCase() !== "infinity") ? parseFloat(s.max) : null,
          rate: parseFloat(s.rate) || 5,
        })),
        milestone_bonus_enabled: milestoneBonusActive,
        milestone_bonus_amount: parseFloat(String(milestoneBonusAmt)) || 0,
      });
      setSlabConfigModalOpen(false);
      loadPayrollData();
    } catch (err: any) {
      alert("Failed to save slab matrix: " + err.message);
    } finally {
      setSavingSlabPlan(false);
    }
  };

  const handleCreateLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loanEmpId || !loanPrincipal) return;
    try {
      await payrollApi.createLoan({
        employee_id: loanEmpId,
        loan_type: loanType,
        principal_amount: parseFloat(loanPrincipal) || 0,
        interest_rate: parseFloat(loanInterest) || 0,
        tenure_months: parseInt(loanTenure) || 12,
        start_month: parseInt(loanStartMonth) || 7,
        start_year: parseInt(loanStartYear) || 2026,
        reason: loanReason || undefined,
        status: "Approved",
      });
      setLoanDialogOpen(false);
      setLoanReason("");
      loadPayrollData();
    } catch (err: any) {
      alert("Failed to create loan application: " + err.message);
    }
  };

  const handleUpdateLoanStatus = async (id: string, status: string) => {
    try {
      await payrollApi.updateLoanStatus(id, status);
      loadPayrollData();
    } catch (err: any) {
      alert("Failed to update loan status: " + err.message);
    }
  };

  const handleCreateAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!advanceEmpId || !advanceAmount || !advanceReason) return;
    try {
      await payrollApi.createAdvance({
        employee_id: advanceEmpId,
        amount: parseFloat(advanceAmount) || 0,
        reason: advanceReason,
        recovery_month: parseInt(advanceMonth) || 7,
        recovery_year: parseInt(advanceYear) || 2026,
        status: "Approved",
      });
      setAdvanceDialogOpen(false);
      setAdvanceReason("");
      loadPayrollData();
    } catch (err: any) {
      alert("Failed to request salary advance: " + err.message);
    }
  };

  const handleUpdateAdvanceStatus = async (id: string, status: string) => {
    try {
      await payrollApi.updateAdvanceStatus(id, status);
      loadPayrollData();
    } catch (err: any) {
      alert("Failed to update advance status: " + err.message);
    }
  };

  const handleCreateBonus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bonusTitle || !bonusAmount) return;
    try {
      await payrollApi.createBonus({
        employee_id: bonusEmpId || null,
        bonus_title: bonusTitle,
        bonus_type: bonusType,
        amount: parseFloat(bonusAmount) || 0,
        distribution_month: parseInt(bonusMonth) || 7,
        distribution_year: parseInt(bonusYear) || 2026,
        status: "Disbursed",
        remarks: bonusRemarks || undefined,
      });
      setBonusDialogOpen(false);
      setBonusTitle("");
      setBonusRemarks("");
      loadPayrollData();
    } catch (err: any) {
      alert("Failed to declare bonus: " + err.message);
    }
  };

  const handleUpdateBonusStatus = async (id: string, status: string) => {
    try {
      await payrollApi.updateBonusStatus(id, status);
      loadPayrollData();
    } catch (err: any) {
      alert("Failed to update bonus status: " + err.message);
    }
  };

  const handleCreateCommission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commEmpId) return;
    try {
      await payrollApi.createCommission({
        employee_id: commEmpId,
        period_month: parseInt(commMonth) || 7,
        period_year: parseInt(commYear) || 2026,
        target_amount: parseFloat(commTarget) || 0,
        achieved_amount: parseFloat(commAchieved) || 0,
        commission_rate: parseFloat(commRate) || 5,
        calculation_mode: commCalcMode,
        custom_slabs: configuredSlabs.map(s => ({
          tier: s.tier,
          min: parseFloat(s.min) || 0,
          max: (s.max !== null && s.max !== undefined && String(s.max).trim() !== "" && String(s.max).toLowerCase() !== "infinity") ? parseFloat(s.max) : null,
          rate: parseFloat(s.rate) || 5,
        })),
        milestone_bonus_amount: milestoneBonusAmt,
        milestone_bonus_enabled: milestoneBonusActive,
        status: "Approved",
        notes: commNotes || undefined,
      });
      setCommDialogOpen(false);
      setCommNotes("");
      loadPayrollData();
    } catch (err: any) {
      alert("Failed to record sales commission: " + err.message);
    }
  };

  const handleUpdateCommissionStatus = async (id: string, status: string) => {
    try {
      await payrollApi.updateCommissionStatus(id, status);
      loadPayrollData();
    } catch (err: any) {
      alert("Failed to update commission status: " + err.message);
    }
  };

  const handleCreatePayGrade = async (e: React.FormEvent) => {
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

  const handleCreateStructure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId || !basicSalary) return;
    try {
      await payrollApi.createSalaryStructure({
        employee_id: selectedEmpId,
        basic_salary: parseFloat(basicSalary) || 0,
        hra: parseFloat(hra) || 0,
        other_allowances: parseFloat(otherAllow) || 0,
        pf_deduction: parseFloat(pf) || 0,
        esi_deduction: parseFloat(esi) || 0,
        tds_deduction: parseFloat(tds) || 0,
        other_deductions: parseFloat(otherDed) || 0
      });
      setStructDialogOpen(false);
      loadPayrollData();
    } catch (err: any) {
      alert("Failed to save structure: " + err.message);
    }
  };

  const handleProcessPayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!processEmpId) return;
    try {
      await payrollApi.generatePayslip({
        employee_id: processEmpId,
        month: parseInt(processMonth) || 7,
        year: parseInt(processYear) || 2026,
        status: "Paid"
      });
      setProcessDialogOpen(false);
      loadPayrollData();
    } catch (err: any) {
      alert("Failed to process payroll: " + err.message);
    }
  };

  const handleProcessBatchPayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setBatchLoading(true);
    try {
      await payrollApi.processBatchPayslips({
        month: parseInt(batchMonth) || 7,
        year: parseInt(batchYear) || 2026,
        status: "Paid",
      });
      setBatchSuccess(true);
      await loadPayrollData();
      setTimeout(() => {
        setBatchDialogOpen(false);
        setBatchSuccess(false);
      }, 1200);
    } catch (err: any) {
      alert("Failed to run batch payroll: " + err.message);
    } finally {
      setBatchLoading(false);
    }
  };

  if (tab === "pay_grades") {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Designation Pay Grades</h2>
            <p className="text-xs text-muted-foreground">Define default salary structure templates mapped to designations.</p>
          </div>
          <Button onClick={() => setGradeDialogOpen(true)} className="h-8 text-xs font-semibold gradient-brand text-white border-0">
            <Plus className="size-3.5 mr-1.5" /> Create Pay Grade
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
                    <div className="bg-muted/40 p-2 rounded border"><p className="text-muted-foreground uppercase font-bold text-[9px]">Basic</p><p className="font-semibold text-foreground">{currency.symbol}{g.basic_salary.toLocaleString()}</p></div>
                    <div className="bg-muted/40 p-2 rounded border"><p className="text-muted-foreground uppercase font-bold text-[9px]">Allowances</p><p className="font-semibold text-emerald-500">+{currency.symbol}{allowances.toLocaleString()}</p></div>
                    <div className="bg-muted/40 p-2 rounded border"><p className="text-muted-foreground uppercase font-bold text-[9px]">Deductions</p><p className="font-semibold text-red-500">-{currency.symbol}{deductions.toLocaleString()}</p></div>
                  </div>
                </div>
                <div className="border-t pt-4 flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Estimated Net Payout:</span>
                  <span className="text-sm font-bold text-emerald-500">{currency.symbol}{net.toLocaleString()} / mo</span>
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

  if (tab === "pay_grades") {
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
                    <div className="bg-muted/40 p-2 rounded border"><p className="text-muted-foreground uppercase font-bold text-[9px]">Basic</p><p className="font-semibold text-foreground">{currency.symbol}{g.basic_salary.toLocaleString()}</p></div>
                    <div className="bg-muted/40 p-2 rounded border"><p className="text-muted-foreground uppercase font-bold text-[9px]">Allowances</p><p className="font-semibold text-emerald-500">+{currency.symbol}{allowances.toLocaleString()}</p></div>
                    <div className="bg-muted/40 p-2 rounded border"><p className="text-muted-foreground uppercase font-bold text-[9px]">Deductions</p><p className="font-semibold text-red-500">-{currency.symbol}{deductions.toLocaleString()}</p></div>
                  </div>
                </div>
                <div className="border-t pt-4 flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Estimated Net Payout:</span>
                  <span className="text-sm font-bold text-emerald-500">{currency.symbol}{net.toLocaleString()} / mo</span>
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

  if (tab === "payroll_processing") {
    return <EnterprisePayrollProcessing />;
  }

  if (tab === "pf") {
    const totalPF = structures.reduce((s, e) => s + e.pf_deduction * 2, 0);
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div><h2 className="text-2xl font-bold tracking-tight text-foreground">Provident Fund (PF)</h2><p className="text-xs text-muted-foreground">Employee and employer PF contributions.</p></div>
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            {loading && <div className="flex justify-center py-6"><Loader2 className="size-6 animate-spin text-primary" /></div>}
            {!loading && (
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b text-slate-600 text-xs uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-4 font-medium">Employee</th>
                    <th className="px-6 py-4 text-right font-medium">Basic Salary</th>
                    <th className="px-6 py-4 text-right font-medium">Employee PF (12%)</th>
                    <th className="px-6 py-4 text-right font-medium">Employer PF (12%)</th>
                    <th className="px-6 py-4 text-right font-medium">Total PF</th>
                  </tr>
                </thead>
                <tbody>
                  {structures.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No PF logs available.</td></tr>
                  ) : structures.map((emp, i) => (
                    <motion.tr key={emp.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.07 }}
                      className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4 font-medium text-foreground">{emp.employee_name}</td>
                      <td className="px-6 py-4 text-right">{currency.symbol}{emp.basic_salary.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right text-blue-500">{currency.symbol}{emp.pf_deduction.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right text-indigo-500">{currency.symbol}{emp.pf_deduction.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right font-bold text-foreground">{currency.symbol}{(emp.pf_deduction * 2).toLocaleString()}</td>
                    </motion.tr>
                  ))}
                  {structures.length > 0 && (
                    <tr className="bg-muted/30 font-semibold border-t border-border/50">
                      <td className="px-6 py-4">Total ECR PF</td>
                      <td className="px-6 py-4 text-right"></td>
                      <td className="px-6 py-4 text-right text-blue-500">{currency.symbol}{structures.reduce((s, e) => s + e.pf_deduction, 0).toLocaleString()}</td>
                      <td className="px-6 py-4 text-right text-indigo-500">{currency.symbol}{structures.reduce((s, e) => s + e.pf_deduction, 0).toLocaleString()}</td>
                      <td className="px-6 py-4 text-right text-foreground">{currency.symbol}{totalPF.toLocaleString()}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (tab === "esi") {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div><h2 className="text-2xl font-bold tracking-tight text-foreground">ESI (Employee State Insurance)</h2><p className="text-xs text-muted-foreground">ESI contributions — Employee 0.75% · Employer 3.25%.</p></div>
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            {loading && <div className="flex justify-center py-6"><Loader2 className="size-6 animate-spin text-primary" /></div>}
            {!loading && (
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b text-slate-600 text-xs uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-4 font-medium">Employee</th>
                    <th className="px-6 py-4 text-right font-medium">ESI Deduction</th>
                    <th className="px-6 py-4 text-right font-medium">Employer Contribution</th>
                    <th className="px-6 py-4 text-right font-medium">Total State Insurance</th>
                  </tr>
                </thead>
                <tbody>
                  {structures.length === 0 ? (
                    <tr><td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">No ESI logs available.</td></tr>
                  ) : structures.map((emp, i) => (
                    <motion.tr key={emp.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.07 }}
                      className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4 font-medium text-foreground">{emp.employee_name}</td>
                      <td className="px-6 py-4 text-right text-orange-500">{currency.symbol}{emp.esi_deduction.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right text-amber-500">{currency.symbol}{(emp.esi_deduction * 4.3).toLocaleString()}</td>
                      <td className="px-6 py-4 text-right font-bold">{currency.symbol}{(emp.esi_deduction * 5.3).toLocaleString()}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (tab === "tds") {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div><h2 className="text-2xl font-bold tracking-tight text-foreground">TDS on Salary</h2><p className="text-xs text-muted-foreground">Tax deducted at source from employee salaries.</p></div>
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            {loading && <div className="flex justify-center py-6"><Loader2 className="size-6 animate-spin text-primary" /></div>}
            {!loading && (
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b text-slate-600 text-xs uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-4 font-medium">Employee</th>
                    <th className="px-6 py-4 font-medium">Department</th>
                    <th className="px-6 py-4 text-right font-medium">Monthly TDS</th>
                    <th className="px-6 py-4 text-right font-medium">Annualized Projections</th>
                  </tr>
                </thead>
                <tbody>
                  {structures.length === 0 ? (
                    <tr><td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">No TDS records found.</td></tr>
                  ) : structures.map((emp, i) => (
                    <motion.tr key={emp.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.07 }}
                      className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4 font-medium text-foreground">{emp.employee_name}</td>
                      <td className="px-6 py-4 text-muted-foreground">{emp.department || "N/A"}</td>
                      <td className="px-6 py-4 text-right font-medium text-red-400">{currency.symbol}{emp.tds_deduction.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right font-bold">{currency.symbol}{(emp.tds_deduction * 12).toLocaleString()}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Print / Export High-Res Official Payslip
  const handlePrintPayslip = (ps: Payslip) => {
    const printWin = window.open("", "_blank", "width=850,height=1100");
    if (!printWin) {
      alert("Please allow popups to preview and print the Payslip.");
      return;
    }

    const targetEmp = employees.find(e => e.id === ps.employee_id || e.full_name === ps.employee_name);
    const empDesignation = targetEmp?.designation?.name || targetEmp?.designation_name || (targetEmp as any)?.designation || "Corporate Staff";
    const empDepartment = targetEmp?.department?.name || targetEmp?.department_name || (targetEmp as any)?.department || "Operations";
    const empCode = ps.employee_code || targetEmp?.employee_code || "EMP-001";
    const empBank = (targetEmp as any)?.bank_account_number ? `${(targetEmp as any)?.bank_name || 'Bank'} (••••${String((targetEmp as any)?.bank_account_number).slice(-4)})` : "Direct Bank Transfer";

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthStr = monthNames[ps.month - 1] || `Month ${ps.month}`;
    const totalDeductions = ps.pf_deduction + ps.esi_deduction + ps.tds_deduction + ps.other_deductions;
    const allowances = ps.hra + ps.other_allowances;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payslip - ${ps.employee_name} (${monthStr} ${ps.year})</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 15mm 18mm;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            }
            body {
              background: #ffffff;
              color: #0f172a;
              padding: 20px;
              font-size: 9.5pt;
              line-height: 1.5;
            }
            .page-container {
              max-width: 720px;
              margin: 0 auto;
              background: #ffffff;
              border: 1.5px solid #cbd5e1;
              padding: 24px;
              border-radius: 8px;
            }
            .header-banner {
              border-bottom: 2px solid #1e1b4b;
              padding-bottom: 14px;
              margin-bottom: 18px;
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
            }
            .header-banner h1 {
              font-size: 16pt;
              font-weight: 900;
              color: #1e1b4b;
              letter-spacing: -0.5px;
            }
            .header-banner p {
              font-size: 8pt;
              color: #64748b;
              margin-top: 1px;
            }
            .payslip-title {
              text-align: center;
              font-size: 12pt;
              font-weight: 800;
              color: #1e1b4b;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 16px;
              background: #f1f5f9;
              padding: 6px 0;
              border-radius: 6px;
            }
            .emp-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 8px;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              padding: 12px;
              margin-bottom: 18px;
              font-size: 8.5pt;
            }
            .emp-row {
              display: flex;
              justify-content: space-between;
              padding: 2px 0;
            }
            .emp-label {
              color: #64748b;
              font-weight: 600;
            }
            .emp-val {
              color: #0f172a;
              font-weight: 700;
            }
            .breakdown-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 18px;
              font-size: 9pt;
            }
            .breakdown-table th {
              background: #1e1b4b;
              color: #ffffff;
              text-align: left;
              padding: 8px 10px;
              font-size: 8pt;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .breakdown-table td {
              padding: 8px 10px;
              border-bottom: 1px solid #e2e8f0;
            }
            .table-col-earn {
              width: 50%;
              border-right: 1.5px solid #cbd5e1;
              vertical-align: top;
            }
            .table-col-ded {
              width: 50%;
              vertical-align: top;
            }
            .inner-row {
              display: flex;
              justify-content: space-between;
              padding: 4px 0;
            }
            .inner-row.subtotal {
              border-top: 1.5px solid #cbd5e1;
              font-weight: 800;
              padding-top: 6px;
              margin-top: 6px;
            }
            .net-box {
              background: #f0fdf4;
              border: 1.5px solid #86efac;
              border-radius: 8px;
              padding: 14px 18px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 24px;
            }
            .net-box .label {
              font-size: 9pt;
              font-weight: 700;
              color: #166534;
              text-transform: uppercase;
            }
            .net-box .val {
              font-size: 16pt;
              font-weight: 900;
              color: #15803d;
            }
            .signatures-grid {
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              margin-top: 36px;
              padding-top: 14px;
              border-top: 1px dashed #cbd5e1;
            }
            .sign-column {
              width: 45%;
            }
            .sign-line {
              height: 40px;
              border-bottom: 1.5px solid #0f172a;
              margin-bottom: 6px;
            }
            .sign-name {
              font-size: 9pt;
              font-weight: 800;
              color: #0f172a;
            }
            .sign-title {
              font-size: 7.5pt;
              color: #64748b;
            }
            .footer-strip {
              margin-top: 24px;
              padding-top: 8px;
              border-top: 1px solid #e2e8f0;
              display: flex;
              justify-content: space-between;
              font-size: 7.5pt;
              color: #94a3b8;
            }
            @media print {
              body { padding: 0; }
              .page-container { border: none; padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="page-container">
            <div class="header-banner">
              <div style="display: flex; align-items: center; gap: 14px;">
                ${orgLogo ? `<img src="${orgLogo}" alt="${orgName}" style="max-height: 48px; max-width: 140px; object-fit: contain;" />` : `<div style="width: 42px; height: 42px; border-radius: 8px; background: #1e1b4b; color: white; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 13pt;">${orgInitials}</div>`}
                <div>
                  <h1>${orgName}</h1>
                  <p>${orgAddress}</p>
                  <p>Email: ${orgEmail} • Phone: ${orgPhone}${orgGstin ? ` • GSTIN: ${orgGstin}` : ""}</p>
                </div>
              </div>
              <div style="text-align: right;">
                <span style="display:inline-block; background:#1e1b4b; color:#fff; font-size:7.5pt; font-weight:800; padding:3px 8px; border-radius:4px; text-transform:uppercase;">Official Payslip</span>
                <p style="font-size:7.5pt; color:#64748b; margin-top:4px;">Period: ${monthStr} ${ps.year}</p>
                <p style="font-size:7.5pt; font-family:monospace; color:#64748b;">REF: PAY-${ps.year}-${ps.month.toString().padStart(2, '0')}-${ps.id.substring(0, 6)}</p>
              </div>
            </div>

            <div class="payslip-title">Salary Slip for ${monthStr} ${ps.year}</div>

            <div class="emp-grid">
              <div>
                <div class="emp-row"><span class="emp-label">Employee Name:</span><span class="emp-val">${ps.employee_name}</span></div>
                <div class="emp-row"><span class="emp-label">Employee Code:</span><span class="emp-val font-mono">${empCode}</span></div>
                <div class="emp-row"><span class="emp-label">Designation:</span><span class="emp-val">${empDesignation}</span></div>
                <div class="emp-row"><span class="emp-label">Department:</span><span class="emp-val">${empDepartment}</span></div>
              </div>
              <div>
                <div class="emp-row"><span class="emp-label">Payment Status:</span><span class="emp-val" style="color:#16a34a;">${ps.status}</span></div>
                <div class="emp-row"><span class="emp-label">Payout Mode:</span><span class="emp-val">${empBank}</span></div>
                <div class="emp-row"><span class="emp-label">Currency:</span><span class="emp-val">${currency.code || "INR"} (${currency.symbol})</span></div>
                <div class="emp-row"><span class="emp-label">Disbursal Date:</span><span class="emp-val">${monthStr} ${ps.year}</span></div>
              </div>
            </div>

            <table class="breakdown-table">
              <thead>
                <tr>
                  <th style="width: 50%; border-right: 1.5px solid #ffffff;">Earnings (A)</th>
                  <th style="width: 50%;">Deductions (B)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="table-col-earn">
                    <div class="inner-row"><span>Basic Salary</span><span>${currency.symbol}${ps.basic_salary.toLocaleString()}</span></div>
                    <div class="inner-row"><span>House Rent Allowance (HRA)</span><span>${currency.symbol}${ps.hra.toLocaleString()}</span></div>
                    <div class="inner-row"><span>Special & Other Allowances</span><span>${currency.symbol}${ps.other_allowances.toLocaleString()}</span></div>
                    <div class="inner-row subtotal"><span>Gross Earnings (A)</span><span>${currency.symbol}${ps.gross_salary.toLocaleString()}</span></div>
                  </td>
                  <td class="table-col-ded">
                    <div class="inner-row"><span>Provident Fund (PF)</span><span>${currency.symbol}${ps.pf_deduction.toLocaleString()}</span></div>
                    <div class="inner-row"><span>ESI Contribution</span><span>${currency.symbol}${ps.esi_deduction.toLocaleString()}</span></div>
                    <div class="inner-row"><span>TDS / Income Tax</span><span>${currency.symbol}${ps.tds_deduction.toLocaleString()}</span></div>
                    <div class="inner-row"><span>Other Deductions</span><span>${currency.symbol}${ps.other_deductions.toLocaleString()}</span></div>
                    <div class="inner-row subtotal"><span>Total Deductions (B)</span><span>${currency.symbol}${totalDeductions.toLocaleString()}</span></div>
                  </td>
                </tr>
              </tbody>
            </table>

            <div class="net-box">
              <div>
                <p class="label">Net Salary Disbursed (A - B)</p>
                <p style="font-size:8pt; color:#15803d; font-style:italic; margin-top:2px;">Transferred to registered corporate salary account</p>
              </div>
              <div class="val">${currency.symbol}${ps.net_salary.toLocaleString()}</div>
            </div>

            <div class="signatures-grid">
              <div class="sign-column">
                <div class="sign-line"></div>
                <div class="sign-name">Employee Acknowledgment</div>
                <div class="sign-title">${ps.employee_name}</div>
              </div>

              <div class="sign-column" style="text-align: right;">
                <div class="sign-line"></div>
                <div class="sign-name">Authorized Finance Signatory</div>
                <div class="sign-title">Payroll Operations • ${orgName}</div>
              </div>
            </div>

            <div class="footer-strip">
              <div>System Generated Electronic Salary Certificate • Valid without physical signature</div>
              <div>${orgName} • Confidential Employee Record</div>
            </div>
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 300);
            };
          </script>
        </body>
      </html>
    `;

    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
  };

  if (tab === "payslips") {
    // Filter payslips based on month, year, and search
    const filteredPayslips = payslips.filter((ps) => {
      const matchMonth = payslipFilterMonth === "all" || String(ps.month) === payslipFilterMonth;
      const matchYear = payslipFilterYear === "all" || String(ps.year) === payslipFilterYear;
      const matchSearch = !payslipSearch || (
        ps.employee_name.toLowerCase().includes(payslipSearch.toLowerCase()) ||
        ps.employee_code.toLowerCase().includes(payslipSearch.toLowerCase())
      );
      return matchMonth && matchYear && matchSearch;
    });

    const totalFilteredGross = filteredPayslips.reduce((acc, p) => acc + (parseFloat(String(p.gross_salary)) || 0), 0);
    const totalFilteredDeductions = filteredPayslips.reduce((acc, p) => {
      return acc + (p.pf_deduction + p.esi_deduction + p.tds_deduction + p.other_deductions);
    }, 0);
    const totalFilteredNet = filteredPayslips.reduce((acc, p) => acc + (parseFloat(String(p.net_salary)) || 0), 0);

    // Available distinct periods from data for quick pills
    const distinctPeriods = Array.from(new Set(payslips.map(p => `${p.year}-${String(p.month).padStart(2, '0')}`))).sort().reverse();

    // Calendar generation helpers
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const daysInCalMonth = new Date(calYear, calMonth, 0).getDate();
    const firstDayOfWeek = new Date(calYear, calMonth - 1, 1).getDay(); // 0 = Sunday

    const monthPayslips = payslips.filter(p => p.year === calYear && p.month === calMonth);

    const prevCalMonth = () => {
      if (calMonth === 1) {
        setCalMonth(12);
        setCalYear(calYear - 1);
      } else {
        setCalMonth(calMonth - 1);
      }
      setSelectedCalDay(null);
    };

    const nextCalMonth = () => {
      if (calMonth === 12) {
        setCalMonth(1);
        setCalYear(calYear + 1);
      } else {
        setCalMonth(calMonth + 1);
      }
      setSelectedCalDay(null);
    };

    return (
      <div className="space-y-6">
        {/* Header & Controls */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              Payslips & Disbursal Archive <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold flex items-center gap-1"><Sparkles className="size-3" /> Live Disbursal Ledger</span>
            </h2>
            <p className="text-xs text-muted-foreground">Month-wise payslip filtering, statutory reconciliation & day-by-day disbursal calendar.</p>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center gap-2 bg-muted/60 p-1 rounded-xl border border-border/60">
            <button
              onClick={() => setPayslipViewMode("table")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                payslipViewMode === "table" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List className="size-3.5" /> Table Ledger
            </button>
            <button
              onClick={() => setPayslipViewMode("calendar")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                payslipViewMode === "calendar" ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Calendar className="size-3.5 text-primary" /> Disbursal Calendar
            </button>
          </div>
        </div>

        {/* Filter Bar & Quick Period Selector */}
        <div className="glass-panel p-4 rounded-xl border border-border/50 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {/* Search Input */}
            <div className="relative md:col-span-2">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={payslipSearch}
                onChange={e => setPayslipSearch(e.target.value)}
                placeholder="Search by employee name or code (e.g. venatic, EMP-0004)..."
                className="w-full h-9 pl-9 pr-3 text-xs rounded-lg border bg-background text-foreground"
              />
            </div>

            {/* Month Filter */}
            <div className="space-y-1">
              <select
                value={payslipFilterMonth}
                onChange={e => {
                  setPayslipFilterMonth(e.target.value);
                  if (e.target.value !== "all") {
                    setCalMonth(parseInt(e.target.value));
                  }
                }}
                className="w-full h-9 px-3 text-xs rounded-lg border bg-background text-foreground font-medium"
              >
                <option value="all">🗓️ All Months</option>
                <option value="1">January</option>
                <option value="2">February</option>
                <option value="3">March</option>
                <option value="4">April</option>
                <option value="5">May</option>
                <option value="6">June</option>
                <option value="7">July</option>
                <option value="8">August</option>
                <option value="9">September</option>
                <option value="10">October</option>
                <option value="11">November</option>
                <option value="12">December</option>
              </select>
            </div>

            {/* Year Filter */}
            <div className="space-y-1">
              <select
                value={payslipFilterYear}
                onChange={e => {
                  setPayslipFilterYear(e.target.value);
                  if (e.target.value !== "all") {
                    setCalYear(parseInt(e.target.value));
                  }
                }}
                className="w-full h-9 px-3 text-xs rounded-lg border bg-background text-foreground font-medium"
              >
                <option value="all">📅 All Years</option>
                <option value="2025">2025</option>
                <option value="2026">2026</option>
                <option value="2027">2027</option>
              </select>
            </div>
          </div>

          {/* Quick Period Pills */}
          {distinctPeriods.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-border/40 text-xs">
              <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                <Filter className="size-3" /> Quick Period:
              </span>
              <button
                onClick={() => {
                  setPayslipFilterMonth("all");
                  setPayslipFilterYear("all");
                }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                  payslipFilterMonth === "all" && payslipFilterYear === "all"
                    ? "bg-primary text-white"
                    : "bg-muted/70 hover:bg-muted text-muted-foreground"
                }`}
              >
                All Cycles ({payslips.length})
              </button>
              {distinctPeriods.map(p => {
                const [y, m] = p.split("-");
                const mNum = parseInt(m, 10);
                const isSelected = payslipFilterYear === y && payslipFilterMonth === String(mNum);
                const count = payslips.filter(item => item.year === parseInt(y) && item.month === mNum).length;
                return (
                  <button
                    key={p}
                    onClick={() => {
                      setPayslipFilterYear(y);
                      setPayslipFilterMonth(String(mNum));
                      setCalYear(parseInt(y));
                      setCalMonth(mNum);
                    }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1 ${
                      isSelected ? "bg-primary text-white shadow-sm" : "bg-muted/70 hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <span>{monthNames[mNum - 1]} {y}</span>
                    <span className={`text-[9px] px-1.5 py-0.2 rounded-full ${isSelected ? "bg-white/20 text-white" : "bg-background/80 text-foreground"}`}>{count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Filtered Financial Metrics Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-panel p-4 rounded-xl border border-border/50">
            <p className="text-[11px] font-bold text-muted-foreground uppercase">Filtered Payslips</p>
            <p className="text-2xl font-black text-foreground mt-0.5">{filteredPayslips.length} <span className="text-xs font-normal text-muted-foreground">profiles</span></p>
          </div>
          <div className="glass-panel p-4 rounded-xl border border-border/50">
            <p className="text-[11px] font-bold text-muted-foreground uppercase">Total Gross Salary</p>
            <p className="text-2xl font-black text-foreground mt-0.5">{currency.symbol}{totalFilteredGross.toLocaleString()}</p>
          </div>
          <div className="glass-panel p-4 rounded-xl border border-border/50">
            <p className="text-[11px] font-bold text-muted-foreground uppercase">Total Deductions</p>
            <p className="text-2xl font-black text-red-500 mt-0.5">-{currency.symbol}{totalFilteredDeductions.toLocaleString()}</p>
          </div>
          <div className="glass-panel p-4 rounded-xl border border-border/50 bg-emerald-500/5 border-emerald-500/20">
            <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Net Disbursed Payout</p>
            <p className="text-2xl font-black text-emerald-500 mt-0.5">{currency.symbol}{totalFilteredNet.toLocaleString()}</p>
          </div>
        </div>

        {/* VIEW 1: TABLE LEDGER */}
        {payslipViewMode === "table" && (
          <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
            <div className="overflow-x-auto">
              {loading && <div className="flex justify-center py-6"><Loader2 className="size-6 animate-spin text-primary" /></div>}
              {!loading && (
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 border-b text-muted-foreground text-xs uppercase font-semibold">
                    <tr>
                      <th className="px-6 py-4 font-medium">Employee</th>
                      <th className="px-6 py-4 font-medium text-center">Period</th>
                      <th className="px-6 py-4 text-right font-medium">Basic Salary</th>
                      <th className="px-6 py-4 text-right font-medium">Gross Salary</th>
                      <th className="px-6 py-4 text-right font-medium text-red-500">Deductions</th>
                      <th className="px-6 py-4 text-right font-medium text-emerald-500">Net Pay</th>
                      <th className="px-6 py-4 text-center font-medium">Status</th>
                      <th className="px-6 py-4 text-center font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayslips.length === 0 ? (
                      <tr><td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">No payslips found matching the selected period and search filters.</td></tr>
                    ) : filteredPayslips.map((ps, i) => (
                      <motion.tr key={ps.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                        className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-semibold text-foreground leading-tight">{ps.employee_name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{ps.employee_code}</p>
                        </td>
                        <td className="px-6 py-4 text-center font-semibold text-xs text-primary">{ps.year}-{ps.month.toString().padStart(2, '0')}</td>
                        <td className="px-6 py-4 text-right font-medium text-foreground">{currency.symbol}{ps.basic_salary.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right font-medium text-foreground">{currency.symbol}{ps.gross_salary.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right font-medium text-red-500">-{currency.symbol}{(ps.pf_deduction + ps.esi_deduction + ps.tds_deduction + ps.other_deductions).toLocaleString()}</td>
                        <td className="px-6 py-4 text-right font-extrabold text-emerald-500">{currency.symbol}{ps.net_salary.toLocaleString()}</td>
                        <td className="px-6 py-4 text-center"><span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${payslipStatusStyle(ps.status)}`}>{ps.status}</span></td>
                        <td className="px-6 py-4 text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-primary/30 text-primary hover:bg-primary/10 gap-1.5 h-8 text-xs font-bold"
                            onClick={() => handlePrintPayslip(ps)}
                          >
                            <Printer className="size-3.5" /> Print / PDF Slip
                          </Button>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* VIEW 2: INTERACTIVE DISBURSAL CALENDAR VIEW */}
        {payslipViewMode === "calendar" && (
          <div className="space-y-6">
            <div className="glass-panel p-6 rounded-2xl border border-border/50 space-y-4">
              {/* Calendar Month & Year Navigator */}
              <div className="flex justify-between items-center pb-3 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-primary/10 text-primary rounded-xl">
                    <Calendar className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-foreground">{monthNames[calMonth - 1]} {calYear}</h3>
                    <p className="text-xs text-muted-foreground">{monthPayslips.length} Payslips Disbursed for this Month Cycle</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={prevCalMonth}
                    className="p-2 rounded-lg border hover:bg-muted/50 text-foreground transition-colors"
                    title="Previous Month"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <span className="text-xs font-bold px-3 py-1 bg-muted/60 rounded-md text-foreground">
                    {monthNames[calMonth - 1]} {calYear}
                  </span>
                  <button
                    onClick={nextCalMonth}
                    className="p-2 rounded-lg border hover:bg-muted/50 text-foreground transition-colors"
                    title="Next Month"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>

              {/* 7-Days Calendar Grid */}
              <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold uppercase text-muted-foreground">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
                  <div key={d} className="py-2 bg-muted/30 rounded-lg">{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {/* Empty cells before month start */}
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} className="min-h-[85px] p-2 bg-muted/10 rounded-xl border border-transparent opacity-30" />
                ))}

                {/* Days of Month */}
                {Array.from({ length: daysInCalMonth }).map((_, i) => {
                  const dayNum = i + 1;
                  // Map payslips to days (either salary cycle milestone day e.g. end of month day, or 1st/30th day)
                  const isEndDay = dayNum === daysInCalMonth || dayNum === 1 || dayNum === 5 || dayNum === 28;
                  const daySlips = (dayNum === daysInCalMonth || (monthPayslips.length > 0 && dayNum === 28)) ? monthPayslips : [];
                  const isSelected = selectedCalDay === dayNum;
                  const hasDisbursal = daySlips.length > 0;
                  const dayNetTotal = daySlips.reduce((s, p) => s + (parseFloat(String(p.net_salary)) || 0), 0);

                  return (
                    <div
                      key={`day-${dayNum}`}
                      onClick={() => hasDisbursal && setSelectedCalDay(isSelected ? null : dayNum)}
                      className={`min-h-[85px] p-2.5 rounded-xl border transition-all flex flex-col justify-between ${
                        isSelected
                          ? "ring-2 ring-primary bg-primary/5 border-primary shadow-md cursor-pointer"
                          : hasDisbursal
                          ? "bg-card hover:bg-muted/40 border-emerald-500/40 hover:border-emerald-500 shadow-sm cursor-pointer"
                          : "bg-card/40 border-border/40 hover:bg-muted/20"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <span className={`text-xs font-bold ${hasDisbursal ? "text-primary" : "text-muted-foreground"}`}>
                          {dayNum}
                        </span>
                        {hasDisbursal && (
                          <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                        )}
                      </div>

                      {hasDisbursal ? (
                        <div className="space-y-1">
                          <span className="block px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 truncate">
                            🟢 {daySlips.length} Staff Paid
                          </span>
                          <span className="block text-[10px] font-extrabold text-foreground truncate">
                            {currency.symbol}{dayNetTotal.toLocaleString()}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/40 text-center">—</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Day Disbursal Detail Drawer / Card */}
            {selectedCalDay && (
              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                className="glass-panel p-6 rounded-2xl border-2 border-primary/40 space-y-4 shadow-xl">
                <div className="flex justify-between items-center pb-3 border-b border-border/50">
                  <div>
                    <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                      <CalendarCheck className="size-5 text-emerald-500" />
                      Day {selectedCalDay} {monthNames[calMonth - 1]} {calYear} — Salary Disbursal Breakdown
                    </h3>
                    <p className="text-xs text-muted-foreground">Individual employee compensation statements and digital receipts for this release milestone.</p>
                  </div>
                  <button
                    onClick={() => setSelectedCalDay(null)}
                    className="text-xs font-bold text-muted-foreground hover:text-foreground px-3 py-1 rounded-md border"
                  >
                    Close Day Detail
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {monthPayslips.map((ps) => (
                    <div key={ps.id} className="p-4 bg-background/80 rounded-xl border border-border/70 space-y-3 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-foreground text-sm leading-tight">{ps.employee_name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{ps.employee_code}</p>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500">
                          {ps.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs bg-muted/40 p-2.5 rounded-lg">
                        <div>
                          <p className="text-[9px] text-muted-foreground uppercase font-bold">Gross</p>
                          <p className="font-semibold text-foreground">{currency.symbol}{ps.gross_salary.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-emerald-600 dark:text-emerald-400 uppercase font-bold">Take-Home</p>
                          <p className="font-bold text-emerald-500">{currency.symbol}{ps.net_salary.toLocaleString()}</p>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        className="w-full h-8 text-xs font-bold gradient-brand text-white border-0 shadow-sm"
                        onClick={() => handlePrintPayslip(ps)}
                      >
                        <Printer className="size-3.5 mr-1" /> Print / View Slip
                      </Button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // 1. LOANS TAB
  // -------------------------------------------------------------------------
  if (tab === "loans") {
    const totalPrincipal = loansList.reduce((acc, l) => acc + (parseFloat(l.principal_amount) || 0), 0);
    const totalRepaid = loansList.reduce((acc, l) => acc + (parseFloat(l.amount_repaid) || 0), 0);
    const totalRemaining = loansList.reduce((acc, l) => acc + (parseFloat(l.remaining_balance) || 0), 0);
    const activeLoans = loansList.filter(l => l.status === "Approved" || l.status === "Active");

    const loanP = parseFloat(loanPrincipal) || 0;
    const loanR = ((parseFloat(loanInterest) || 0) / 100) / 12;
    const loanN = parseInt(loanTenure) || 12;
    const previewEmi = loanP > 0 && loanN > 0
      ? (loanR > 0 ? Math.round((loanP * loanR * ((1 + loanR) ** loanN)) / (((1 + loanR) ** loanN) - 1)) : Math.round(loanP / loanN))
      : 0;

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              Employee Loans & EMIs <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 font-semibold flex items-center gap-1"><Shield className="size-3" /> Auto Payroll Deduction</span>
            </h2>
            <p className="text-xs text-muted-foreground">Manage corporate staff loans, interest schedules, EMI recovery, and ledger tracking.</p>
          </div>
          <button
            onClick={() => {
              if (employees.length > 0 && !loanEmpId) setLoanEmpId(employees[0].id);
              setLoanDialogOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 h-8.5 gradient-brand text-white rounded-lg text-xs font-semibold shadow-elegant hover:opacity-90 transition-opacity"
          >
            <Plus className="size-3.5" /> Apply / Disburse Loan
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="glass-panel p-4 rounded-xl border border-border/50">
            <div className="flex items-center justify-between text-muted-foreground text-xs mb-1 font-semibold uppercase">
              <span>Active Loans</span>
              <Wallet className="size-4 text-primary" />
            </div>
            <p className="text-2xl font-black text-foreground">{activeLoans.length}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Across all departments</p>
          </div>
          <div className="glass-panel p-4 rounded-xl border border-border/50">
            <div className="flex items-center justify-between text-muted-foreground text-xs mb-1 font-semibold uppercase">
              <span>Total Disbursed</span>
              <Banknote className="size-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-black text-foreground">{currency.symbol}{totalPrincipal.toLocaleString()}</p>
            <p className="text-[10px] text-emerald-500 font-medium mt-1">Sanctioned capital</p>
          </div>
          <div className="glass-panel p-4 rounded-xl border border-border/50">
            <div className="flex items-center justify-between text-muted-foreground text-xs mb-1 font-semibold uppercase">
              <span>Total Repaid</span>
              <CheckCircle2 className="size-4 text-cyan-500" />
            </div>
            <p className="text-2xl font-black text-foreground">{currency.symbol}{totalRepaid.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Recovered via payroll</p>
          </div>
          <div className="glass-panel p-4 rounded-xl border border-border/50">
            <div className="flex items-center justify-between text-muted-foreground text-xs mb-1 font-semibold uppercase">
              <span>Outstanding Balance</span>
              <Coins className="size-4 text-amber-500" />
            </div>
            <p className="text-2xl font-black text-amber-500">{currency.symbol}{totalRemaining.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Future EMI receivables</p>
          </div>
        </div>

        {/* Loans Table */}
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            {loading && <div className="flex justify-center py-6"><Loader2 className="size-6 animate-spin text-primary" /></div>}
            {!loading && (
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-slate-900/50 border-b text-muted-foreground text-xs uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-4 font-medium">Employee</th>
                    <th className="px-6 py-4 font-medium">Loan Type</th>
                    <th className="px-6 py-4 text-right font-medium">Principal</th>
                    <th className="px-6 py-4 text-center font-medium">Tenure</th>
                    <th className="px-6 py-4 text-right font-medium text-indigo-500">Monthly EMI</th>
                    <th className="px-6 py-4 text-right font-medium">Repaid</th>
                    <th className="px-6 py-4 text-right font-medium text-amber-500">Balance</th>
                    <th className="px-6 py-4 text-center font-medium">Status</th>
                    <th className="px-6 py-4 text-center font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loansList.length === 0 ? (
                    <tr><td colSpan={9} className="px-6 py-8 text-center text-muted-foreground">No employee loans registered yet. Click Apply / Disburse Loan to issue a new loan.</td></tr>
                  ) : loansList.map((loan, i) => (
                    <motion.tr key={loan.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                      className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-foreground leading-tight">{loan.employee_name}</p>
                        <p className="text-[10px] text-muted-foreground">{loan.employee_code} • {loan.department}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-primary/10 text-primary">{loan.loan_type}</span>
                        {loan.reason && <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[150px]">{loan.reason}</p>}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-foreground">{currency.symbol}{loan.principal_amount.toLocaleString()}</td>
                      <td className="px-6 py-4 text-center text-xs text-muted-foreground">{loan.tenure_months} mos {loan.interest_rate > 0 ? `(${loan.interest_rate}%)` : "(0%)"}</td>
                      <td className="px-6 py-4 text-right font-bold text-indigo-500">{currency.symbol}{loan.monthly_emi.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right font-medium text-emerald-500">{currency.symbol}{loan.amount_repaid.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right font-bold text-amber-500">{currency.symbol}{loan.remaining_balance.toLocaleString()}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${payslipStatusStyle(loan.status)}`}>{loan.status}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {loan.status === "Pending" ? (
                          <button
                            onClick={() => handleUpdateLoanStatus(loan.id, "Approved")}
                            className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 rounded text-xs font-bold transition-colors"
                          >
                            Approve
                          </button>
                        ) : loan.status === "Approved" ? (
                          <button
                            onClick={() => handleUpdateLoanStatus(loan.id, "Completed")}
                            className="px-2.5 py-1 bg-muted hover:bg-muted/80 text-muted-foreground rounded text-xs font-medium transition-colors"
                          >
                            Mark Paid
                          </button>
                        ) : (
                          <span className="text-[11px] text-muted-foreground font-semibold">Settled</span>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Loan Dialog */}
        {loanDialogOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-2xl bg-card border p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                    <Wallet className="size-5 text-primary" /> Apply & Disburse Employee Loan
                  </h3>
                  <p className="text-xs text-muted-foreground">Sets up monthly payroll EMI deduction schedule automatically.</p>
                </div>
              </div>

              <form onSubmit={handleCreateLoan} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Choose Employee *</label>
                  <select
                    value={loanEmpId}
                    onChange={e => setLoanEmpId(e.target.value)}
                    className="w-full h-10 px-3 text-sm rounded-md border bg-background"
                    required
                  >
                    <option value="">-- Choose Employee --</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.full_name} ({e.employee_code})</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Loan Category</label>
                    <select
                      value={loanType}
                      onChange={e => setLoanType(e.target.value)}
                      className="w-full h-10 px-3 text-sm rounded-md border bg-background"
                    >
                      <option value="Personal">Personal Loan</option>
                      <option value="Emergency">Medical / Emergency</option>
                      <option value="Vehicle">Vehicle Purchase</option>
                      <option value="Home">Home Improvement</option>
                      <option value="Education">Education Assistance</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Principal Amount *</label>
                    <input
                      type="number"
                      value={loanPrincipal}
                      onChange={e => setLoanPrincipal(e.target.value)}
                      placeholder="e.g. 50000"
                      className="w-full h-10 px-3 text-sm rounded-md border bg-background font-semibold"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Interest Rate (% p.a.)</label>
                    <input
                      type="number"
                      value={loanInterest}
                      onChange={e => setLoanInterest(e.target.value)}
                      placeholder="0 for interest-free"
                      className="w-full h-10 px-3 text-sm rounded-md border bg-background"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Tenure (Months) *</label>
                    <input
                      type="number"
                      value={loanTenure}
                      onChange={e => setLoanTenure(e.target.value)}
                      placeholder="12"
                      className="w-full h-10 px-3 text-sm rounded-md border bg-background"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Reason / Purpose</label>
                  <input
                    type="text"
                    value={loanReason}
                    onChange={e => setLoanReason(e.target.value)}
                    placeholder="e.g. Relocation deposit assistance"
                    className="w-full h-10 px-3 text-sm rounded-md border bg-background"
                  />
                </div>

                {/* Live EMI Preview */}
                {loanP > 0 && (
                  <div className="p-3 bg-muted/40 rounded-xl border border-border/50 flex justify-between items-center">
                    <div>
                      <p className="text-xs font-bold text-foreground">Calculated Monthly EMI</p>
                      <p className="text-[10px] text-muted-foreground">Will be auto-deducted in each monthly payslip cycle</p>
                    </div>
                    <span className="text-lg font-black text-indigo-500">{currency.symbol}{previewEmi.toLocaleString()} / mo</span>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setLoanDialogOpen(false)} className="px-4 py-2 border rounded-md text-sm">Cancel</button>
                  <button type="submit" className="px-4 py-2 gradient-brand text-white rounded-md text-sm font-semibold shadow-elegant hover:opacity-90">
                    Sanction & Disburse Loan
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // 2. ADVANCES TAB
  // -------------------------------------------------------------------------
  if (tab === "advances") {
    const totalAdvanceAmount = advancesList.reduce((acc, a) => acc + (parseFloat(a.amount) || 0), 0);
    const recoveredCount = advancesList.filter(a => a.status === "Recovered").length;
    const pendingRecovery = advancesList.filter(a => a.status === "Approved" || a.status === "Pending");

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              Salary Advances <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-500 font-semibold flex items-center gap-1"><CalendarClock className="size-3" /> Short-term Recovery</span>
            </h2>
            <p className="text-xs text-muted-foreground">Emergency mid-month salary advance disbursements and automatic payroll settlement.</p>
          </div>
          <button
            onClick={() => {
              if (employees.length > 0 && !advanceEmpId) setAdvanceEmpId(employees[0].id);
              setAdvanceDialogOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 h-8.5 gradient-brand text-white rounded-lg text-xs font-semibold shadow-elegant hover:opacity-90 transition-opacity"
          >
            <Plus className="size-3.5" /> Request / Issue Salary Advance
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-panel p-4 rounded-xl border border-border/50">
            <div className="flex items-center justify-between text-muted-foreground text-xs mb-1 font-semibold uppercase">
              <span>Total Advances Disbursed</span>
              <Coins className="size-4 text-primary" />
            </div>
            <p className="text-2xl font-black text-foreground">{currency.symbol}{totalAdvanceAmount.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{advancesList.length} total requests registered</p>
          </div>
          <div className="glass-panel p-4 rounded-xl border border-border/50">
            <div className="flex items-center justify-between text-muted-foreground text-xs mb-1 font-semibold uppercase">
              <span>Pending Recovery</span>
              <Clock className="size-4 text-amber-500" />
            </div>
            <p className="text-2xl font-black text-amber-500">{pendingRecovery.length} Profiles</p>
            <p className="text-[10px] text-muted-foreground mt-1">To be recovered in next payroll run</p>
          </div>
          <div className="glass-panel p-4 rounded-xl border border-border/50">
            <div className="flex items-center justify-between text-muted-foreground text-xs mb-1 font-semibold uppercase">
              <span>Successfully Settled</span>
              <CheckCheck className="size-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-black text-emerald-500">{recoveredCount} Settled</p>
            <p className="text-[10px] text-emerald-500 font-medium mt-1">100% payroll reconciliation</p>
          </div>
        </div>

        {/* Advances Table */}
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            {loading && <div className="flex justify-center py-6"><Loader2 className="size-6 animate-spin text-primary" /></div>}
            {!loading && (
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-slate-900/50 border-b text-muted-foreground text-xs uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-4 font-medium">Employee</th>
                    <th className="px-6 py-4 font-medium">Reason</th>
                    <th className="px-6 py-4 text-right font-medium">Advance Amount</th>
                    <th className="px-6 py-4 text-center font-medium">Disbursal Date</th>
                    <th className="px-6 py-4 text-center font-medium">Recovery Month</th>
                    <th className="px-6 py-4 text-center font-medium">Status</th>
                    <th className="px-6 py-4 text-center font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {advancesList.length === 0 ? (
                    <tr><td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">No salary advances requested. Click above to record a new advance.</td></tr>
                  ) : advancesList.map((adv, i) => (
                    <motion.tr key={adv.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                      className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-foreground leading-tight">{adv.employee_name}</p>
                        <p className="text-[10px] text-muted-foreground">{adv.employee_code} • {adv.department}</p>
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-foreground">{adv.reason}</td>
                      <td className="px-6 py-4 text-right font-bold text-foreground">{currency.symbol}{adv.amount.toLocaleString()}</td>
                      <td className="px-6 py-4 text-center text-xs text-muted-foreground">{adv.request_date || "Today"}</td>
                      <td className="px-6 py-4 text-center text-xs font-semibold text-primary">{adv.recovery_year}-{adv.recovery_month?.toString().padStart(2, '0')}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${payslipStatusStyle(adv.status)}`}>{adv.status}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {adv.status === "Approved" ? (
                          <button
                            onClick={() => handleUpdateAdvanceStatus(adv.id, "Recovered")}
                            className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 rounded text-xs font-bold transition-colors"
                          >
                            Mark Recovered
                          </button>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">Recovered</span>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Advance Dialog */}
        {advanceDialogOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl bg-card border p-6 space-y-4 shadow-2xl">
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                <CalendarClock className="size-5 text-primary" /> Request Salary Advance
              </h3>

              <form onSubmit={handleCreateAdvance} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Choose Employee *</label>
                  <select
                    value={advanceEmpId}
                    onChange={e => setAdvanceEmpId(e.target.value)}
                    className="w-full h-10 px-3 text-sm rounded-md border bg-background"
                    required
                  >
                    <option value="">-- Choose Employee --</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.full_name} ({e.employee_code})</option>)}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Advance Amount *</label>
                  <input
                    type="number"
                    value={advanceAmount}
                    onChange={e => setAdvanceAmount(e.target.value)}
                    placeholder="e.g. 15000"
                    className="w-full h-10 px-3 text-sm rounded-md border bg-background font-semibold"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Emergency Reason / Justification *</label>
                  <input
                    type="text"
                    value={advanceReason}
                    onChange={e => setAdvanceReason(e.target.value)}
                    placeholder="e.g. Urgent family medical emergency"
                    className="w-full h-10 px-3 text-sm rounded-md border bg-background"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Recovery Month</label>
                    <select value={advanceMonth} onChange={e => setAdvanceMonth(e.target.value)} className="w-full h-10 px-3 text-sm rounded-md border bg-background">
                      <option value="1">January</option>
                      <option value="2">February</option>
                      <option value="3">March</option>
                      <option value="4">April</option>
                      <option value="5">May</option>
                      <option value="6">June</option>
                      <option value="7">July</option>
                      <option value="8">August</option>
                      <option value="9">September</option>
                      <option value="10">October</option>
                      <option value="11">November</option>
                      <option value="12">December</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Recovery Year</label>
                    <select value={advanceYear} onChange={e => setAdvanceYear(e.target.value)} className="w-full h-10 px-3 text-sm rounded-md border bg-background">
                      <option value="2025">2025</option>
                      <option value="2026">2026</option>
                      <option value="2027">2027</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setAdvanceDialogOpen(false)} className="px-4 py-2 border rounded-md text-sm">Cancel</button>
                  <button type="submit" className="px-4 py-2 gradient-brand text-white rounded-md text-sm font-semibold shadow-elegant hover:opacity-90">
                    Approve & Disburse Advance
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // 3. BONUSES TAB
  // -------------------------------------------------------------------------
  if (tab === "bonuses") {
    const totalBonusAmount = bonusesList.reduce((acc, b) => acc + (parseFloat(b.amount) || 0), 0);
    const festiveBonuses = bonusesList.filter(b => b.bonus_type === "Festive").length;
    const performanceBonuses = bonusesList.filter(b => b.bonus_type === "Performance").length;

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              Bonuses & Incentives <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-semibold flex items-center gap-1"><Award className="size-3" /> Festive & Performance Rewards</span>
            </h2>
            <p className="text-xs text-muted-foreground">Declare festive bonuses, spot awards, retention incentives, and company-wide pools.</p>
          </div>
          <button
            onClick={() => setBonusDialogOpen(true)}
            className="flex items-center gap-1.5 px-3.5 h-8.5 gradient-brand text-white rounded-lg text-xs font-semibold shadow-elegant hover:opacity-90 transition-opacity"
          >
            <Plus className="size-3.5" /> Declare Employee Bonus
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-panel p-4 rounded-xl border border-border/50">
            <div className="flex items-center justify-between text-muted-foreground text-xs mb-1 font-semibold uppercase">
              <span>Total Bonus Disbursed</span>
              <Award className="size-4 text-amber-500" />
            </div>
            <p className="text-2xl font-black text-foreground">{currency.symbol}{totalBonusAmount.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Across all declared schemes</p>
          </div>
          <div className="glass-panel p-4 rounded-xl border border-border/50">
            <div className="flex items-center justify-between text-muted-foreground text-xs mb-1 font-semibold uppercase">
              <span>Festive Declarations</span>
              <Sparkles className="size-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-black text-emerald-500">{festiveBonuses} Cycles</p>
            <p className="text-[10px] text-emerald-500 font-medium mt-1">Diwali / New Year pools</p>
          </div>
          <div className="glass-panel p-4 rounded-xl border border-border/50">
            <div className="flex items-center justify-between text-muted-foreground text-xs mb-1 font-semibold uppercase">
              <span>Performance Rewards</span>
              <TrendingUp className="size-4 text-primary" />
            </div>
            <p className="text-2xl font-black text-primary">{performanceBonuses} Awards</p>
            <p className="text-[10px] text-muted-foreground mt-1">Top performer spot recognition</p>
          </div>
        </div>

        {/* Bonuses Table */}
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            {loading && <div className="flex justify-center py-6"><Loader2 className="size-6 animate-spin text-primary" /></div>}
            {!loading && (
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-slate-900/50 border-b text-muted-foreground text-xs uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-4 font-medium">Bonus Title</th>
                    <th className="px-6 py-4 font-medium">Category</th>
                    <th className="px-6 py-4 font-medium">Beneficiary</th>
                    <th className="px-6 py-4 text-right font-medium">Amount</th>
                    <th className="px-6 py-4 text-center font-medium">Disbursal Period</th>
                    <th className="px-6 py-4 text-center font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bonusesList.length === 0 ? (
                    <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">No bonuses declared yet. Click Declare Employee Bonus to reward your team.</td></tr>
                  ) : bonusesList.map((b, i) => (
                    <motion.tr key={b.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                      className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-foreground leading-tight">{b.bonus_title}</p>
                        {b.remarks && <p className="text-[10px] text-muted-foreground mt-0.5">{b.remarks}</p>}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-500/10 text-amber-500">{b.bonus_type}</span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-foreground text-xs">{b.employee_name}</p>
                        <p className="text-[10px] text-muted-foreground">{b.employee_code}</p>
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-emerald-500">{currency.symbol}{b.amount.toLocaleString()}</td>
                      <td className="px-6 py-4 text-center text-xs font-medium text-muted-foreground">{b.distribution_year}-{b.distribution_month?.toString().padStart(2, '0')}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${payslipStatusStyle(b.status)}`}>{b.status}</span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Bonus Dialog */}
        {bonusDialogOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl bg-card border p-6 space-y-4 shadow-2xl">
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                <Award className="size-5 text-amber-500" /> Declare Employee Bonus
              </h3>

              <form onSubmit={handleCreateBonus} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Bonus Title *</label>
                  <input
                    type="text"
                    value={bonusTitle}
                    onChange={e => setBonusTitle(e.target.value)}
                    placeholder="e.g. Diwali Festive Bonus 2026"
                    className="w-full h-10 px-3 text-sm rounded-md border bg-background"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Category</label>
                    <select
                      value={bonusType}
                      onChange={e => setBonusType(e.target.value)}
                      className="w-full h-10 px-3 text-sm rounded-md border bg-background"
                    >
                      <option value="Festive">Festive Bonus</option>
                      <option value="Performance">Annual Performance</option>
                      <option value="Milestone">Milestone / Achievement</option>
                      <option value="Spot">Spot Recognition</option>
                      <option value="Retention">Retention Incentive</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Amount *</label>
                    <input
                      type="number"
                      value={bonusAmount}
                      onChange={e => setBonusAmount(e.target.value)}
                      placeholder="e.g. 10000"
                      className="w-full h-10 px-3 text-sm rounded-md border bg-background font-semibold"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Target Recipient</label>
                  <select
                    value={bonusEmpId}
                    onChange={e => setBonusEmpId(e.target.value)}
                    className="w-full h-10 px-3 text-sm rounded-md border bg-background"
                  >
                    <option value="">🌟 All Active Employees (Company-Wide Pool)</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.full_name} ({e.employee_code})</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Disbursal Month</label>
                    <select value={bonusMonth} onChange={e => setBonusMonth(e.target.value)} className="w-full h-10 px-3 text-sm rounded-md border bg-background">
                      <option value="1">January</option>
                      <option value="2">February</option>
                      <option value="3">March</option>
                      <option value="4">April</option>
                      <option value="5">May</option>
                      <option value="6">June</option>
                      <option value="7">July</option>
                      <option value="8">August</option>
                      <option value="9">September</option>
                      <option value="10">October</option>
                      <option value="11">November</option>
                      <option value="12">December</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Disbursal Year</label>
                    <select value={bonusYear} onChange={e => setBonusYear(e.target.value)} className="w-full h-10 px-3 text-sm rounded-md border bg-background">
                      <option value="2025">2025</option>
                      <option value="2026">2026</option>
                      <option value="2027">2027</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Remarks</label>
                  <input
                    type="text"
                    value={bonusRemarks}
                    onChange={e => setBonusRemarks(e.target.value)}
                    placeholder="e.g. Excellent H1 team deliverables"
                    className="w-full h-10 px-3 text-sm rounded-md border bg-background"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setBonusDialogOpen(false)} className="px-4 py-2 border rounded-md text-sm">Cancel</button>
                  <button type="submit" className="px-4 py-2 gradient-brand text-white rounded-md text-sm font-semibold shadow-elegant hover:opacity-90">
                    Declare & Disburse Bonus
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // 4. COMMISSIONS TAB (DYNAMIC SLAB-WISE & PROGRESSIVE PERFORMANCE INCENTIVES)
  // -------------------------------------------------------------------------
  if (tab === "commissions") {
    const totalCommissions = commissionsList.reduce((acc, c) => acc + (parseFloat(c.commission_amount) || 0), 0);
    const totalSalesAchieved = commissionsList.reduce((acc, c) => acc + (parseFloat(c.achieved_amount) || 0), 0);

    const commAch = parseFloat(commAchieved) || 0;
    const commTgt = parseFloat(commTarget) || 0;
    const commRt = parseFloat(commRate) || 5;

    // Helper to sanitize dynamic slabs for computation
    const parsedSlabs = configuredSlabs.map((s, idx) => {
      const sMin = parseFloat(s.min) || 0;
      const sMaxVal = (s.max !== null && s.max !== undefined && String(s.max).trim() !== "" && String(s.max).toLowerCase() !== "infinity" && String(s.max).toLowerCase() !== "null") ? parseFloat(s.max) : Infinity;
      return {
        tier: s.tier || `Slab ${idx + 1}`,
        min: sMin,
        max: sMaxVal,
        rate: parseFloat(s.rate) || 5.0,
        color: s.color || "text-primary bg-primary/10 border-primary/20",
      };
    }).sort((a, b) => a.min - b.min);

    // Compute live slab preview dynamically
    const computeLiveBreakdown = () => {
      if (commCalcMode === "flat") {
        const payout = Math.round((commAch * commRt) / 100);
        return {
          tier: `Flat (${commRt}%)`,
          totalPayout: payout,
          bonus: 0,
          brackets: [
            { tier: `Flat Custom (${commRt}%)`, range: "Total Volume", applicable: commAch, rate: commRt, payout },
          ],
        };
      }
      if (commCalcMode === "tier") {
        let highest = parsedSlabs[0] || { tier: "Base Tier", min: 0, max: Infinity, rate: 5 };
        for (const s of parsedSlabs) {
          if (commAch > s.min) highest = s;
        }
        const payout = Math.round((commAch * highest.rate) / 100);
        const bonus = milestoneBonusActive && commTgt > 0 && commAch >= commTgt ? milestoneBonusAmt : 0;
        return {
          tier: highest.tier,
          totalPayout: payout + bonus,
          bonus,
          brackets: [
            { tier: highest.tier, range: highest.max === Infinity ? `> ${currency.symbol}${highest.min.toLocaleString()}` : `${currency.symbol}${highest.min.toLocaleString()} - ${currency.symbol}${highest.max.toLocaleString()}`, applicable: commAch, rate: highest.rate, payout },
          ],
        };
      }

      // Progressive Marginal Slabs
      let remaining = commAch;
      let total = 0;
      let activeTier = parsedSlabs[0]?.tier || "Base Tier";
      const brackets: any[] = [];

      for (const s of parsedSlabs) {
        if (remaining <= 0) break;
        const capacity = s.max - s.min;
        const taxable = Math.min(remaining, capacity);
        const payout = Math.round((taxable * s.rate) / 100);
        total += payout;
        brackets.push({
          tier: s.tier,
          range: s.max === Infinity ? `> ${currency.symbol}${s.min.toLocaleString()}` : `${currency.symbol}${s.min.toLocaleString()} - ${currency.symbol}${s.max.toLocaleString()}`,
          applicable: taxable,
          rate: s.rate,
          payout,
          color: s.color,
        });
        activeTier = s.tier;
        remaining -= taxable;
      }

      const bonus = milestoneBonusActive && commTgt > 0 && commAch >= commTgt ? milestoneBonusAmt : 0;
      total += bonus;

      return {
        tier: activeTier,
        totalPayout: total,
        bonus,
        brackets,
      };
    };

    const liveBreakdown = computeLiveBreakdown();

    const handleUpdateSlabField = (index: number, field: string, value: any) => {
      const updated = [...configuredSlabs];
      updated[index] = { ...updated[index], [field]: value };
      setConfiguredSlabs(updated);
    };

    const handleAddSlabBracket = () => {
      const lastSlab = configuredSlabs[configuredSlabs.length - 1];
      const newMin = lastSlab ? (parseFloat(lastSlab.max) || (parseFloat(lastSlab.min) + 50000)) : 0;
      const colors = [
        "text-blue-500 bg-blue-500/10 border-blue-500/20",
        "text-indigo-500 bg-indigo-500/10 border-indigo-500/20",
        "text-amber-500 bg-amber-500/10 border-amber-500/20",
        "text-purple-500 bg-purple-500/10 border-purple-500/20",
        "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
        "text-rose-500 bg-rose-500/10 border-rose-500/20",
      ];
      setConfiguredSlabs([
        ...configuredSlabs,
        {
          tier: `Slab ${configuredSlabs.length + 1} (Tier)`,
          min: newMin,
          max: null,
          rate: (parseFloat(lastSlab?.rate) || 5) + 3.0,
          color: colors[configuredSlabs.length % colors.length],
        },
      ]);
    };

    const handleRemoveSlabBracket = (index: number) => {
      if (configuredSlabs.length <= 1) {
        alert("At least one slab bracket is required.");
        return;
      }
      setConfiguredSlabs(configuredSlabs.filter((_, i) => i !== index));
    };

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              Slab-Wise Sales Commissions & Incentives{" "}
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-semibold flex items-center gap-1 border border-emerald-500/20">
                <Sparkles className="size-3" /> Dynamic Slabs Active
              </span>
            </h2>
            <p className="text-xs text-muted-foreground">
              Dynamic multi-tier marginal commission calculation, sales quota tracking, milestone bonuses, and payroll integration.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSlabConfigModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 h-8.5 bg-muted hover:bg-muted/80 text-foreground border border-border/60 rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              <Sliders className="size-3.5 text-primary" /> Configure Slab Matrix ({configuredSlabs.length} Slabs)
            </button>
            <button
              onClick={() => {
                if (employees.length > 0 && !commEmpId) setCommEmpId(employees[0].id);
                setCommDialogOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 h-8.5 gradient-brand text-white rounded-lg text-xs font-semibold shadow-elegant hover:opacity-90 transition-opacity"
            >
              <Plus className="size-3.5" /> Calculate & Record Commission
            </button>
          </div>
        </div>

        {/* Dynamic Slab Tier Matrix Visual Banner */}
        <div className="glass-panel p-4 rounded-xl border border-border/50 bg-slate-900/5 dark:bg-slate-900/40">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="size-3.5 text-primary" /> Active Dynamic Slab Matrix ({configuredSlabs.length} Configured Brackets)
            </span>
            <div className="flex items-center gap-2">
              {milestoneBonusActive && (
                <span className="text-[11px] font-semibold text-emerald-500 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                  🎯 +{currency.symbol}{milestoneBonusAmt.toLocaleString()} Quota Milestone Bonus
                </span>
              )}
              <button
                onClick={() => setSlabConfigModalOpen(true)}
                className="text-[11px] font-semibold text-primary hover:underline"
              >
                Edit Slabs →
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            {configuredSlabs.map((slab, idx) => (
              <div key={idx} className="p-3 rounded-lg border border-border/60 bg-background/60 flex flex-col justify-between group hover:border-primary/40 transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${slab.color || 'text-primary bg-primary/10 border-primary/20'}`}>
                    {slab.tier}
                  </span>
                  <span className="text-xs font-black text-foreground">{slab.rate}% Rate</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1.5">
                  Volume: <span className="font-semibold text-foreground">
                    {slab.max === null || slab.max === undefined || String(slab.max).trim() === "" || String(slab.max).toLowerCase() === "infinity"
                      ? `> ${currency.symbol}${(parseFloat(slab.min) || 0).toLocaleString()}`
                      : `${currency.symbol}${(parseFloat(slab.min) || 0).toLocaleString()} - ${currency.symbol}${(parseFloat(slab.max) || 0).toLocaleString()}`}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-border/40 text-[10px] text-muted-foreground">
                  <span>Bracket #{idx + 1}</span>
                  <button onClick={() => setSlabConfigModalOpen(true)} className="text-primary opacity-0 group-hover:opacity-100 transition-opacity font-semibold">
                    Customize
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-panel p-4 rounded-xl border border-border/50">
            <div className="flex items-center justify-between text-muted-foreground text-xs mb-1 font-semibold uppercase">
              <span>Total Commission Pool</span>
              <Percent className="size-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-black text-emerald-500">{currency.symbol}{totalCommissions.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Disbursed performance incentives</p>
          </div>
          <div className="glass-panel p-4 rounded-xl border border-border/50">
            <div className="flex items-center justify-between text-muted-foreground text-xs mb-1 font-semibold uppercase">
              <span>Sales Volume Generated</span>
              <TrendingUp className="size-4 text-primary" />
            </div>
            <p className="text-2xl font-black text-foreground">{currency.symbol}{totalSalesAchieved.toLocaleString()}</p>
            <p className="text-[10px] text-primary font-medium mt-1">Revenue realized across slabs</p>
          </div>
          <div className="glass-panel p-4 rounded-xl border border-border/50">
            <div className="flex items-center justify-between text-muted-foreground text-xs mb-1 font-semibold uppercase">
              <span>Active Reps on Plan</span>
              <Shield className="size-4 text-indigo-500" />
            </div>
            <p className="text-2xl font-black text-indigo-500">{commissionsList.length} Reps</p>
            <p className="text-[10px] text-muted-foreground mt-1">Dynamic graduated tier plans</p>
          </div>
          <div className="glass-panel p-4 rounded-xl border border-border/50">
            <div className="flex items-center justify-between text-muted-foreground text-xs mb-1 font-semibold uppercase">
              <span>Avg Commission Yield</span>
              <Sparkles className="size-4 text-amber-500" />
            </div>
            <p className="text-2xl font-black text-amber-500">
              {totalSalesAchieved > 0 ? ((totalCommissions / totalSalesAchieved) * 100).toFixed(1) : "5.0"}%
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">Blended marginal payout rate</p>
          </div>
        </div>

        {/* Commissions Table */}
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            {loading && <div className="flex justify-center py-6"><Loader2 className="size-6 animate-spin text-primary" /></div>}
            {!loading && (
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-slate-900/50 border-b text-muted-foreground text-xs uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-4 font-medium">Sales Rep</th>
                    <th className="px-6 py-4 text-right font-medium">Target Quota</th>
                    <th className="px-6 py-4 text-right font-medium">Achieved Revenue</th>
                    <th className="px-6 py-4 text-center font-medium">Quota Progress</th>
                    <th className="px-6 py-4 text-center font-medium">Slab Tier & Mode</th>
                    <th className="px-6 py-4 text-right font-medium text-emerald-500">Commission Payout</th>
                    <th className="px-6 py-4 text-center font-medium">Breakdown</th>
                    <th className="px-6 py-4 text-center font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {commissionsList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">
                        No commissions recorded for this cycle. Click Calculate & Record Commission above.
                      </td>
                    </tr>
                  ) : commissionsList.map((comm, i) => {
                    const pct = comm.target_amount > 0 ? Math.round((comm.achieved_amount / comm.target_amount) * 100) : 100;
                    const modeLabel = comm.calculation_mode === "tier" ? "Top-Tier" : comm.calculation_mode === "flat" ? "Flat %" : "Progressive";
                    return (
                      <motion.tr key={comm.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                        className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-semibold text-foreground leading-tight">{comm.employee_name}</p>
                          <p className="text-[10px] text-muted-foreground">{comm.employee_code} • {comm.department}</p>
                        </td>
                        <td className="px-6 py-4 text-right text-muted-foreground font-medium">
                          {currency.symbol}{comm.target_amount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-foreground">
                          {currency.symbol}{comm.achieved_amount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${pct >= 100 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                              {pct}% {pct >= 100 && "🎯"}
                            </span>
                            <div className="w-16 bg-muted/60 h-1.5 rounded-full overflow-hidden">
                              <div className={`h-full ${pct >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-primary/10 text-primary border border-primary/20">
                              {comm.slab_tier || "Base Tier"}
                            </span>
                            <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                              {modeLabel}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-black text-emerald-500 text-base">
                          {currency.symbol}{comm.commission_amount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => setSelectedCommissionDetail(comm)}
                            className="px-2.5 py-1 text-xs font-semibold rounded-md bg-muted hover:bg-muted/80 text-foreground border border-border/50 transition-colors"
                          >
                            View Slabs
                          </button>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${payslipStatusStyle(comm.status)}`}>
                            {comm.status}
                          </span>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Dynamic Slab Matrix Configurator Modal */}
        {slabConfigModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl rounded-2xl bg-card border p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                    <Sliders className="size-5 text-primary" /> Dynamic Commission Slab Rules Matrix
                  </h3>
                  <p className="text-xs text-muted-foreground">Add, edit, or remove progressive sales tiers, rate percentages, and milestone bonuses.</p>
                </div>
                <button onClick={() => setSlabConfigModalOpen(false)} className="text-muted-foreground hover:text-foreground">✕</button>
              </div>

              <div className="space-y-4">
                {/* Slabs List */}
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-2 text-[11px] font-bold text-muted-foreground uppercase px-1">
                    <div className="col-span-4">Tier Name</div>
                    <div className="col-span-3">Min Volume ({currency.symbol})</div>
                    <div className="col-span-3">Max Volume ({currency.symbol})</div>
                    <div className="col-span-1 text-center">Rate %</div>
                    <div className="col-span-1 text-right">Action</div>
                  </div>

                  {configuredSlabs.map((slab, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center p-2 rounded-lg bg-background/80 border border-border/60">
                      <div className="col-span-4">
                        <input
                          type="text"
                          value={slab.tier}
                          onChange={e => handleUpdateSlabField(idx, "tier", e.target.value)}
                          placeholder="Tier Name"
                          className="w-full h-8.5 px-2.5 text-xs rounded-md border bg-card font-semibold text-foreground"
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          type="number"
                          value={slab.min}
                          onChange={e => handleUpdateSlabField(idx, "min", e.target.value)}
                          placeholder="0"
                          className="w-full h-8.5 px-2 text-xs rounded-md border bg-card"
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          type="text"
                          value={slab.max === null || slab.max === undefined ? "" : slab.max}
                          onChange={e => handleUpdateSlabField(idx, "max", e.target.value === "" ? null : e.target.value)}
                          placeholder="Leave empty for ∞"
                          className="w-full h-8.5 px-2 text-xs rounded-md border bg-card"
                        />
                      </div>
                      <div className="col-span-1">
                        <input
                          type="number"
                          step="0.5"
                          value={slab.rate}
                          onChange={e => handleUpdateSlabField(idx, "rate", e.target.value)}
                          placeholder="5"
                          className="w-full h-8.5 px-1 text-xs rounded-md border bg-card text-center font-bold text-primary"
                        />
                      </div>
                      <div className="col-span-1 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveSlabBracket(idx)}
                          className="p-1.5 text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                          title="Remove Slab"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={handleAddSlabBracket}
                    className="w-full py-2 border border-dashed rounded-lg text-xs font-bold text-primary hover:bg-primary/5 flex items-center justify-center gap-1.5 transition-colors mt-2"
                  >
                    <Plus className="size-3.5" /> + Add Dynamic Slab Bracket
                  </button>
                </div>

                {/* Milestone Bonus Setting */}
                <div className="p-3.5 bg-muted/40 rounded-xl border border-border/50 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-foreground flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={milestoneBonusActive}
                        onChange={e => setMilestoneBonusActive(e.target.checked)}
                        className="rounded border-border text-primary size-4"
                      />
                      Enable Target Quota Overachievement Milestone Bonus
                    </label>
                    {milestoneBonusActive && (
                      <span className="text-[11px] font-bold text-emerald-500">Active</span>
                    )}
                  </div>
                  {milestoneBonusActive && (
                    <div className="flex items-center gap-3 pt-1">
                      <span className="text-xs text-muted-foreground">Milestone Bonus Fixed Payout:</span>
                      <div className="relative w-40">
                        <span className="absolute left-3 top-2 text-xs text-muted-foreground font-bold">{currency.symbol}</span>
                        <input
                          type="number"
                          value={milestoneBonusAmt}
                          onChange={e => setMilestoneBonusAmt(parseFloat(e.target.value) || 0)}
                          className="w-full h-8 pl-7 pr-2 text-xs rounded-md border bg-background font-bold text-emerald-500"
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground">Awarded whenever achieved volume &ge; 100% target quota</span>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button type="button" onClick={() => setSlabConfigModalOpen(false)} className="px-4 py-2 border rounded-md text-sm hover:bg-muted">Cancel</button>
                  <button
                    type="button"
                    onClick={handleSaveSlabPlan}
                    disabled={savingSlabPlan}
                    className="px-4 py-2 gradient-brand text-white rounded-md text-sm font-semibold shadow-elegant hover:opacity-90 flex items-center gap-1.5"
                  >
                    {savingSlabPlan ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    Save Dynamic Slab Plan
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Commission Calculator & Record Dialog */}
        {commDialogOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-2xl bg-card border p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                    <Percent className="size-5 text-emerald-500" /> Slab-Wise Commission Calculator
                  </h3>
                  <p className="text-xs text-muted-foreground">Calculates multi-tier marginal commission with dynamic customizable entries.</p>
                </div>
                <button onClick={() => setCommDialogOpen(false)} className="text-muted-foreground hover:text-foreground">✕</button>
              </div>

              <form onSubmit={handleCreateCommission} className="space-y-4">
                {/* Employee Selection */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Sales Rep *</label>
                  <select
                    value={commEmpId}
                    onChange={e => setCommEmpId(e.target.value)}
                    className="w-full h-10 px-3 text-sm rounded-md border bg-background"
                    required
                  >
                    <option value="">-- Choose Sales Representative --</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.full_name} ({e.employee_code}) - {e.department?.name || 'Sales'}</option>)}
                  </select>
                </div>

                {/* Calculation Mode Tabs */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Commission Calculation Engine</label>
                    <button
                      type="button"
                      onClick={() => setInlineCustomizeSlabs(!inlineCustomizeSlabs)}
                      className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
                    >
                      <Sliders className="size-3" /> {inlineCustomizeSlabs ? "Hide Custom Slabs" : "⚡ Customize Slabs for this Entry"}
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-muted/50 rounded-lg border border-border/50 text-xs">
                    <button
                      type="button"
                      onClick={() => setCommCalcMode("progressive")}
                      className={`py-1.5 font-semibold rounded-md transition-all ${commCalcMode === "progressive" ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      Progressive Slabs
                    </button>
                    <button
                      type="button"
                      onClick={() => setCommCalcMode("tier")}
                      className={`py-1.5 font-semibold rounded-md transition-all ${commCalcMode === "tier" ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      Top-Tier Rate
                    </button>
                    <button
                      type="button"
                      onClick={() => setCommCalcMode("flat")}
                      className={`py-1.5 font-semibold rounded-md transition-all ${commCalcMode === "flat" ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      Custom Flat %
                    </button>
                  </div>
                </div>

                {/* Inline Dynamic Slab Customizer if toggled */}
                {inlineCustomizeSlabs && commCalcMode !== "flat" && (
                  <div className="p-3 bg-muted/30 rounded-xl border border-border/60 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground">Dynamic Slab Entries (Live Editable)</span>
                      <button
                        type="button"
                        onClick={handleAddSlabBracket}
                        className="text-[10px] font-bold text-primary hover:underline"
                      >
                        + Add Slab Bracket
                      </button>
                    </div>
                    {configuredSlabs.map((s, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={s.tier}
                          onChange={e => handleUpdateSlabField(idx, "tier", e.target.value)}
                          className="w-1/3 h-7 px-2 text-[11px] rounded border bg-background font-semibold"
                        />
                        <input
                          type="number"
                          value={s.min}
                          onChange={e => handleUpdateSlabField(idx, "min", e.target.value)}
                          placeholder="Min"
                          className="w-1/4 h-7 px-1.5 text-[11px] rounded border bg-background"
                        />
                        <input
                          type="text"
                          value={s.max === null || s.max === undefined ? "" : s.max}
                          onChange={e => handleUpdateSlabField(idx, "max", e.target.value === "" ? null : e.target.value)}
                          placeholder="∞"
                          className="w-1/4 h-7 px-1.5 text-[11px] rounded border bg-background"
                        />
                        <div className="flex items-center gap-0.5 w-1/5">
                          <input
                            type="number"
                            step="0.5"
                            value={s.rate}
                            onChange={e => handleUpdateSlabField(idx, "rate", e.target.value)}
                            className="w-full h-7 px-1 text-[11px] rounded border bg-background text-center font-bold text-primary"
                          />
                          <span className="text-[10px]">%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Quota and Achieved Sales Inputs */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Target Sales Quota</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-bold">{currency.symbol}</span>
                      <input
                        type="number"
                        value={commTarget}
                        onChange={e => setCommTarget(e.target.value)}
                        placeholder="500000"
                        className="w-full h-10 pl-7 pr-3 text-sm rounded-md border bg-background"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Achieved Sales Volume *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-bold">{currency.symbol}</span>
                      <input
                        type="number"
                        value={commAchieved}
                        onChange={e => setCommAchieved(e.target.value)}
                        placeholder="650000"
                        className="w-full h-10 pl-7 pr-3 text-sm rounded-md border bg-background font-bold text-emerald-500"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Flat rate input or period */}
                <div className="grid grid-cols-2 gap-3">
                  {commCalcMode === "flat" ? (
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-muted-foreground uppercase">Custom Rate (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={commRate}
                        onChange={e => setCommRate(e.target.value)}
                        placeholder="5"
                        className="w-full h-10 px-3 text-sm rounded-md border bg-background"
                      />
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-muted-foreground uppercase">Achieved Slab Tier</label>
                      <div className="w-full h-10 px-3 flex items-center bg-muted/40 rounded-md border text-xs font-bold text-primary">
                        {liveBreakdown.tier}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Payroll Period</label>
                    <div className="flex gap-1.5">
                      <select value={commMonth} onChange={e => setCommMonth(e.target.value)} className="w-1/2 h-10 px-2 text-xs rounded-md border bg-background">
                        <option value="5">May</option>
                        <option value="6">June</option>
                        <option value="7">July</option>
                        <option value="8">August</option>
                        <option value="9">September</option>
                        <option value="10">October</option>
                        <option value="11">November</option>
                        <option value="12">December</option>
                      </select>
                      <select value={commYear} onChange={e => setCommYear(e.target.value)} className="w-1/2 h-10 px-2 text-xs rounded-md border bg-background">
                        <option value="2026">2026</option>
                        <option value="2027">2027</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Dynamic Slab Breakdown Live Calculation Box */}
                {commAch > 0 && (
                  <div className="p-3.5 bg-slate-900/5 dark:bg-slate-900/50 rounded-xl border border-border/70 space-y-2.5">
                    <div className="flex justify-between items-center text-xs font-bold text-foreground">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="size-3.5 text-emerald-500" /> Dynamic Tiered Breakdown ({liveBreakdown.brackets.length} Slabs Applied)
                      </span>
                      <span className="text-emerald-500 text-sm font-black">
                        Total: {currency.symbol}{liveBreakdown.totalPayout.toLocaleString()}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs">
                      {liveBreakdown.brackets.map((b, idx) => (
                        <div key={idx} className="flex justify-between items-center p-2 rounded-md bg-background/80 border border-border/40">
                          <div>
                            <span className="font-semibold text-foreground">{b.tier}</span>
                            <span className="text-[10px] text-muted-foreground ml-1.5">({currency.symbol}{b.applicable.toLocaleString()} @ {b.rate}%)</span>
                          </div>
                          <span className="font-bold text-foreground">+{currency.symbol}{b.payout.toLocaleString()}</span>
                        </div>
                      ))}
                      {liveBreakdown.bonus > 0 && (
                        <div className="flex justify-between items-center p-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                          <span className="font-bold flex items-center gap-1">🎯 100%+ Quota Milestone Bonus</span>
                          <span className="font-black">+{currency.symbol}{liveBreakdown.bonus.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button type="button" onClick={() => setCommDialogOpen(false)} className="px-4 py-2 border rounded-md text-sm hover:bg-muted">Cancel</button>
                  <button type="submit" className="px-4 py-2 gradient-brand text-white rounded-md text-sm font-semibold shadow-elegant hover:opacity-90">
                    Record Commission
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* View Slab Breakdown Detail Modal */}
        {selectedCommissionDetail && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl bg-card border p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                    <TrendingUp className="size-5 text-emerald-500" /> Slab Commission Details
                  </h3>
                  <p className="text-xs text-muted-foreground">{selectedCommissionDetail.employee_name} ({selectedCommissionDetail.employee_code})</p>
                </div>
                <button onClick={() => setSelectedCommissionDetail(null)} className="text-muted-foreground hover:text-foreground">✕</button>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 p-3 bg-muted/40 rounded-xl text-xs">
                  <div>
                    <span className="text-muted-foreground font-semibold">Target Quota:</span>
                    <p className="text-sm font-bold text-foreground">{currency.symbol}{selectedCommissionDetail.target_amount?.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-semibold">Achieved Volume:</span>
                    <p className="text-sm font-bold text-emerald-500">{currency.symbol}{selectedCommissionDetail.achieved_amount?.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-semibold">Calculation Mode:</span>
                    <p className="text-sm font-bold text-primary capitalize">{selectedCommissionDetail.calculation_mode || "Progressive"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-semibold">Max Slab Reached:</span>
                    <p className="text-sm font-bold text-foreground">{selectedCommissionDetail.slab_tier || "Base Tier"}</p>
                  </div>
                </div>

                {/* Breakdown items */}
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase">Marginal Tier Audit Trail</h4>
                  {selectedCommissionDetail.slab_breakdown?.brackets ? (
                    selectedCommissionDetail.slab_breakdown.brackets.map((b: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center p-2.5 rounded-lg bg-background border text-xs">
                        <div>
                          <p className="font-semibold text-foreground">{b.tier}</p>
                          <p className="text-[10px] text-muted-foreground">Range: {b.min !== undefined ? `${currency.symbol}${b.min} - ${b.max}` : b.range || "Applicable"}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-foreground">+{currency.symbol}{b.payout?.toLocaleString()}</p>
                          <p className="text-[10px] text-muted-foreground">{b.rate}% on {currency.symbol}{b.applicable_amount?.toLocaleString() || b.applicable?.toLocaleString()}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 bg-background border rounded-lg text-xs text-muted-foreground text-center">
                      Direct {selectedCommissionDetail.commission_rate}% on {currency.symbol}{selectedCommissionDetail.achieved_amount?.toLocaleString()} = {currency.symbol}{selectedCommissionDetail.commission_amount?.toLocaleString()}
                    </div>
                  )}

                  {selectedCommissionDetail.slab_breakdown?.bonus_amount > 0 && (
                    <div className="flex justify-between items-center p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs">
                      <span className="font-bold flex items-center gap-1">🎯 100%+ Quota Milestone Bonus</span>
                      <span className="font-black">+{currency.symbol}{selectedCommissionDetail.slab_breakdown.bonus_amount.toLocaleString()}</span>
                    </div>
                  )}
                </div>

                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex justify-between items-center">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Total Net Commission Payout</span>
                  <span className="text-xl font-black text-emerald-500">{currency.symbol}{selectedCommissionDetail.commission_amount?.toLocaleString()}</span>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedCommissionDetail(null)}
                  className="px-4 py-2 border rounded-md text-sm hover:bg-muted"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Default: salary_structure
  // Default: salary_structure
  const currentBasicNum = parseFloat(basicSalary) || 0;
  const currentHraNum = parseFloat(hra) || 0;
  const currentOtherAllowNum = parseFloat(otherAllow) || 0;
  const currentPfNum = parseFloat(pf) || 0;
  const currentEsiNum = parseFloat(esi) || 0;
  const currentTdsNum = parseFloat(tds) || 0;
  const currentOtherDedNum = parseFloat(otherDed) || 0;

  const liveGross = currentBasicNum + currentHraNum + currentOtherAllowNum;
  const liveTotalDeductions = currentPfNum + currentEsiNum + currentTdsNum + currentOtherDedNum;
  const liveNetSalary = liveGross - liveTotalDeductions;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Salary Structure <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold flex items-center gap-1"><Sparkles className="size-3" /> Auto-Statutory</span>
          </h2>
          <p className="text-xs text-muted-foreground">Automated salary components, statutory EPFO/ESIC rules, and take-home mapping.</p>
        </div>
        <button
          onClick={() => {
            if (employees.length > 0) {
              handleSelectEmployeeForStructure(employees[0].id);
            }
            setStructDialogOpen(true);
          }}
          className="flex items-center gap-1.5 px-3.5 h-8.5 gradient-brand text-white rounded-lg text-xs font-semibold shadow-elegant hover:opacity-90 transition-opacity"
        >
          <Plus className="size-3.5" /> Map Employee Salary
        </button>
      </div>

      <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          {loading && <div className="flex justify-center py-6"><Loader2 className="size-6 animate-spin text-primary" /></div>}
          {!loading && (
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 dark:bg-slate-900/50 border-b text-muted-foreground text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-4 font-medium">Employee</th>
                  <th className="px-6 py-4 font-medium">Role</th>
                  <th className="px-6 py-4 text-right font-medium">Basic Salary</th>
                  <th className="px-6 py-4 text-right font-medium">HRA (40%)</th>
                  <th className="px-6 py-4 text-right font-medium">Allowances</th>
                  <th className="px-6 py-4 text-right font-medium text-red-500">Statutory Ded.</th>
                  <th className="px-6 py-4 text-right font-medium text-emerald-500">Net Take-Home</th>
                  <th className="px-4 py-4 text-center font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {structures.length === 0 ? (
                  <tr><td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">No salary configurations mapped yet. Choose an employee above to auto-configure.</td></tr>
                ) : structures.map((emp, i) => (
                  <motion.tr key={emp.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.06 }}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 font-semibold text-foreground">{emp.employee_name}</td>
                    <td className="px-6 py-4"><p className="font-semibold text-foreground text-xs">{emp.designation}</p><p className="text-[10px] text-muted-foreground">{emp.department}</p></td>
                    <td className="px-6 py-4 text-right font-medium">{currency.symbol}{emp.basic_salary.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-muted-foreground">{currency.symbol}{emp.hra.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-muted-foreground">{currency.symbol}{emp.other_allowances.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-red-500 font-medium">-{currency.symbol}{(emp.pf_deduction + emp.esi_deduction + emp.tds_deduction + emp.other_deductions).toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-bold text-emerald-500">{currency.symbol}{((emp.basic_salary + emp.hra + emp.other_allowances) - (emp.pf_deduction + emp.esi_deduction + emp.tds_deduction + emp.other_deductions)).toLocaleString()}</td>
                    <td className="px-4 py-4 text-center">
                      <button
                        onClick={() => {
                          handleSelectEmployeeForStructure(emp.employee_id);
                          setStructDialogOpen(true);
                        }}
                        className="p-1.5 hover:bg-primary/10 text-primary rounded-md transition-colors"
                        title="Edit Salary Structure"
                      >
                        <Edit3 className="size-3.5" />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Salary Structure Dialog with Instant Statutory Auto-Calculation */}
      {structDialogOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-card border p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                  Map Employee Salary Structure
                </h3>
                <p className="text-xs text-muted-foreground">Enter Basic Salary — all statutory allowances and deductions auto-calculate instantaneously.</p>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 flex items-center gap-1">
                <Sparkles className="size-2.5" /> Auto-Formula
              </span>
            </div>

            <form onSubmit={handleCreateStructure} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Choose Employee *</label>
                <select
                  value={selectedEmpId}
                  onChange={e => handleSelectEmployeeForStructure(e.target.value)}
                  className="w-full h-10 px-3 text-sm rounded-md border bg-background"
                  required
                >
                  <option value="">-- Choose Employee --</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.full_name} ({e.employee_code})</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-primary uppercase flex items-center gap-1">
                    Basic Salary * <span className="text-[10px] font-normal text-muted-foreground">(Master Entry)</span>
                  </label>
                  <input
                    type="number"
                    value={basicSalary}
                    onChange={e => applyBasicSalaryAutoFill(e.target.value)}
                    placeholder="e.g. 45000"
                    className="w-full h-10 px-3 text-sm font-semibold rounded-md border-2 border-primary/40 focus:border-primary bg-background"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">HRA Allowance (40%)</label>
                  <input
                    type="number"
                    value={hra}
                    onChange={e => setHra(e.target.value)}
                    placeholder="e.g. 18000"
                    className="w-full h-10 px-3 text-sm rounded-md border bg-background"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Other Allowances (10%)</label>
                  <input
                    type="number"
                    value={otherAllow}
                    onChange={e => setOtherAllow(e.target.value)}
                    placeholder="e.g. 4500"
                    className="w-full h-10 px-3 text-sm rounded-md border bg-background"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">PF Deduction (12% EPFO)</label>
                  <input
                    type="number"
                    value={pf}
                    onChange={e => setPf(e.target.value)}
                    placeholder="e.g. 1800"
                    className="w-full h-10 px-3 text-sm rounded-md border bg-background"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">ESI (0.75%)</label>
                  <input
                    type="number"
                    value={esi}
                    onChange={e => setEsi(e.target.value)}
                    placeholder="0"
                    className="w-full h-10 px-2 text-xs rounded-md border bg-background"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">TDS Tax</label>
                  <input
                    type="number"
                    value={tds}
                    onChange={e => setTds(e.target.value)}
                    placeholder="0"
                    className="w-full h-10 px-2 text-xs rounded-md border bg-background"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Other Ded.</label>
                  <input
                    type="number"
                    value={otherDed}
                    onChange={e => setOtherDed(e.target.value)}
                    placeholder="0"
                    className="w-full h-10 px-2 text-xs rounded-md border bg-background"
                  />
                </div>
              </div>

              {/* Real-time Calculation Summary Card */}
              {currentBasicNum > 0 && (
                <div className="p-3.5 bg-muted/40 rounded-xl border border-border/60 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-foreground">Live Compensation Breakdown</span>
                    <span className="text-[10px] text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Check className="size-2.5" /> Fully Synchronized
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 bg-background/80 rounded border">
                      <p className="text-[9px] text-muted-foreground uppercase font-bold">Gross Earnings</p>
                      <p className="font-bold text-foreground text-sm">{currency.symbol}{liveGross.toLocaleString()}</p>
                    </div>
                    <div className="p-2 bg-background/80 rounded border">
                      <p className="text-[9px] text-muted-foreground uppercase font-bold">Total Deductions</p>
                      <p className="font-bold text-red-500 text-sm">-{currency.symbol}{liveTotalDeductions.toLocaleString()}</p>
                    </div>
                    <div className="p-2 bg-emerald-500/10 rounded border border-emerald-500/20">
                      <p className="text-[9px] text-emerald-600 dark:text-emerald-400 uppercase font-extrabold">Net Take-Home</p>
                      <p className="font-extrabold text-emerald-500 text-sm">{currency.symbol}{liveNetSalary.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setStructDialogOpen(false)} className="px-4 py-2 border rounded-md text-sm">Cancel</button>
                <button type="submit" className="px-4 py-2 gradient-brand text-white rounded-md text-sm font-semibold shadow-elegant hover:opacity-90">
                  Save Configuration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
