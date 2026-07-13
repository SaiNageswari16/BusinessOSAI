import os

target = os.path.join("frontend", "src", "components", "hrms", "PayrollManagement.tsx")
with open(target, "r", encoding="utf-8") as f:
    content = f.read()

line_ending = "\r\n" if "\r\n" in content else "\n"

# Remove duplicate loads inside loadPayrollData
old_loads = """      const gradesRes = await payrollApi.listPayGrades();
      setPayGrades(gradesRes || []);

      const desigsRes = await designationsApi.list(1, 100);
      setDesignations(desigsRes.items || []);

      const gradesRes = await payrollApi.listPayGrades();
      setPayGrades(gradesRes || []);

      const desigsRes = await designationsApi.list(1, 100);
      setDesignations(desigsRes.items || []);"""

new_loads = """      const gradesRes = await payrollApi.listPayGrades();
      setPayGrades(gradesRes || []);

      const desigsRes = await designationsApi.list(1, 100);
      setDesignations(desigsRes.items || []);"""

content = content.replace(old_loads.replace("\n", line_ending), new_loads.replace("\n", line_ending))

# Remove duplicate handleCreatePayGrade function
old_function_duplicate = """  const handleCreatePayGrade = async (e: React.FormEvent) => {
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
  };"""

new_function_duplicate = """  const handleCreatePayGrade = async (e: React.FormEvent) => {
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
  };"""

content = content.replace(old_function_duplicate.replace("\n", line_ending), new_function_duplicate.replace("\n", line_ending))

with open(target, "w", encoding="utf-8", newline=line_ending) as f:
    f.write(content)

print("Cleaned up duplicate loaders and functions in PayrollManagement.tsx")
