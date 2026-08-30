import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Download, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { crmCustomersApi } from "@/lib/api-client";
import { parseCustomersFile, downloadCustomersTemplateExcel, type ParsedCustomerRow } from "@/lib/crm-excel-utils";

interface BulkImportCustomersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BulkImportCustomersModal({
  isOpen,
  onClose,
  onSuccess,
}: BulkImportCustomersModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsedCustomers, setParsedCustomers] = useState<ParsedCustomerRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const selected = files[0];
    setFile(selected);
    setParsing(true);
    try {
      const result = await parseCustomersFile(selected);
      setParsedCustomers(result.customers);
      setErrors(result.errors);
      if (result.customers.length > 0) {
        toast.success(`Parsed ${result.customers.length} customers successfully.`);
      }
      if (result.errors.length > 0) {
        toast.warning(`${result.errors.length} rows had formatting issues.`);
      }
    } catch (err: any) {
      toast.error("Failed to parse file: " + (err?.message || "Unknown error"));
      setParsedCustomers([]);
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (parsedCustomers.length === 0) {
      toast.error("No valid customers to import.");
      return;
    }

    setImporting(true);
    try {
      const res = await crmCustomersApi.bulkImport({
        customers: parsedCustomers,
      });

      toast.success(res.message || `Imported ${res.imported_count} customers successfully.`);
      onSuccess();
      handleClose();
    } catch (err: any) {
      toast.error(err?.detail || err?.message || "Failed to import customers.");
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setParsedCustomers([]);
    setErrors([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-card border border-border rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-5 border-b border-border flex justify-between items-center bg-muted/20">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <FileSpreadsheet className="size-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-foreground">Import Customers from Excel / CSV</h3>
                <p className="text-xs text-muted-foreground">
                  Bulk upload customer master data with contact & GST details
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-5 overflow-y-auto flex-1">
            {/* Step 1: Template Download */}
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-dashed border-primary/30 bg-primary/5">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="size-5 text-primary" />
                <div>
                  <p className="text-xs font-bold text-foreground">Download Sample Customers Excel Template</p>
                  <p className="text-[11px] text-muted-foreground">Pre-filled with name, company, GSTIN, phone, address</p>
                </div>
              </div>
              <button
                type="button"
                onClick={downloadCustomersTemplateExcel}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-xs"
              >
                <Download className="size-3.5" />
                Download .xlsx
              </button>
            </div>

            {/* Step 2: Upload Area */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileSelect}
              className="hidden"
            />

            {!file ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border rounded-2xl p-8 text-center cursor-pointer hover:border-primary hover:bg-muted/30 transition-all flex flex-col items-center justify-center gap-2"
              >
                <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <Upload className="size-6" />
                </div>
                <p className="text-sm font-bold text-foreground">Click to upload or drag & drop Excel / CSV</p>
                <p className="text-xs text-muted-foreground">Supports .xlsx, .xls, and .csv files</p>
              </div>
            ) : (
              <div className="p-4 rounded-xl border bg-card flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                    XLSX
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">{file.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB · {parsedCustomers.length} valid rows
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setParsedCustomers([]);
                    setErrors([]);
                  }}
                  className="text-xs text-red-500 hover:underline"
                >
                  Remove & Re-upload
                </button>
              </div>
            )}

            {/* Step 3: Preview Table */}
            {parsing && (
              <div className="py-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="size-4 animate-spin text-primary" />
                Validating and parsing customer rows...
              </div>
            )}

            {parsedCustomers.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-foreground">
                    Data Preview (First 5 of {parsedCustomers.length} customers)
                  </p>
                  <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="size-3" /> Ready to Import
                  </span>
                </div>
                <div className="rounded-xl border border-border overflow-x-auto max-h-48">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border text-[11px] text-muted-foreground">
                        <th className="p-2 font-semibold">Customer Name</th>
                        <th className="p-2 font-semibold">Company</th>
                        <th className="p-2 font-semibold">Phone</th>
                        <th className="p-2 font-semibold">Email</th>
                        <th className="p-2 font-semibold">Type</th>
                        <th className="p-2 font-semibold">GSTIN</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {parsedCustomers.slice(0, 5).map((c, i) => (
                        <tr key={i} className="hover:bg-muted/30">
                          <td className="p-2 font-medium text-foreground">{c.name}</td>
                          <td className="p-2 text-muted-foreground">{c.company_name || "—"}</td>
                          <td className="p-2 text-muted-foreground">{c.phone || "—"}</td>
                          <td className="p-2 text-muted-foreground">{c.email || "—"}</td>
                          <td className="p-2">
                            <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-bold">
                              {c.customer_type || "Retail"}
                            </span>
                          </td>
                          <td className="p-2 font-mono text-[11px] text-muted-foreground">{c.gst_number || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Error alerts */}
            {errors.length > 0 && (
              <div className="p-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 text-xs text-amber-800 dark:text-amber-300 space-y-1 max-h-32 overflow-y-auto">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="size-4 text-amber-600" />
                  {errors.length} Row(s) Skipped:
                </p>
                <ul className="list-disc pl-5 text-[11px] space-y-0.5">
                  {errors.slice(0, 10).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-5 border-t border-border flex items-center justify-between bg-muted/10">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={importing || parsedCustomers.length === 0}
              onClick={handleImport}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-md"
            >
              {importing ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Importing Customers...
                </>
              ) : (
                <>
                  <ArrowRight className="size-3.5" />
                  Commit & Import ({parsedCustomers.length} Customers)
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
