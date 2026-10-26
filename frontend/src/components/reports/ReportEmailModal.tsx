import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Send, X, Loader2, Paperclip, Info } from "lucide-react";
import { toast } from "sonner";
import { inventoryApi } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

export interface ReportEmailModalProps {
  open: boolean;
  onClose: () => void;
  reportTitle: string;
  /** Sheet / attachment name (no .xlsx extension needed) */
  sheetName?: string;
  attachmentFilename?: string;
  /** Table header row */
  headers?: string[];
  /** Table data rows (each row an array of cell values) */
  rows?: any[][];
  /** Human-readable summary lines shown in the modal + email body */
  summaryLines?: string[];
}

/**
 * Shared "Email Excel" modal. Sends the report to one or more recipients
 * (comma / space separated) through the backend, which uses the
 * organization's configured SMTP. The report data is attached as .xlsx.
 */
export function ReportEmailModal({
  open,
  onClose,
  reportTitle,
  sheetName,
  attachmentFilename,
  headers,
  rows,
  summaryLines,
}: ReportEmailModalProps) {
  const [emailAddress, setEmailAddress] = useState<string>("");
  const [sending, setSending] = useState<boolean>(false);

  const recordCount = Array.isArray(rows) ? rows.length : 0;
  const hasAttachment = Boolean((headers && headers.length) || (rows && rows.length));

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const recipients = emailAddress
      .split(/[\s,;]+/)
      .map((r) => r.trim())
      .filter((r) => r.length > 0 && r.includes("@"));

    if (recipients.length === 0) {
      toast.error("Please enter at least one valid recipient email address.");
      return;
    }

    setSending(true);
    try {
      const res = await inventoryApi.emailReport({
        report_title: reportTitle,
        recipient_emails: recipients,
        summary_lines: summaryLines || [],
        headers: headers || [],
        rows: rows || [],
        sheet_name: sheetName || "Report",
        attachment_filename: attachmentFilename,
      });
      toast.success(res?.message || `Report emailed to ${recipients.join(", ")}`);
      setEmailAddress("");
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to send the report email. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        >
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
          >
            {/* Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-slate-50 to-indigo-50/60 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                  <Mail className="size-4" />
                </div>
                <div>
                  <div className="font-bold text-sm text-slate-900">Email {reportTitle}</div>
                  <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                    <Info className="size-3" /> Sent via your organization's SMTP
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSend} className="p-5 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Recipient Email(s)</label>
                <input
                  type="email"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  placeholder="e.g. accountant@company.com"
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Send to multiple people by separating with commas.
                </p>
              </div>

              {/* Attachment details */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                  <Paperclip className="size-3.5 text-indigo-500" />
                  {hasAttachment ? "Attachment Details" : "Attachment"}
                </div>
                <ul className="space-y-1 text-[11px] text-slate-600">
                  <li>• Report: <span className="font-semibold text-slate-800">{reportTitle}</span></li>
                  {summaryLines?.length ? (
                    summaryLines.map((l, i) => <li key={i} className="pl-3">• {l}</li>)
                  ) : hasAttachment ? (
                    <li className="pl-3">• Format: Excel (.xlsx)</li>
                  ) : (
                    <li className="pl-3 text-amber-600">• No data to attach — a summary email will be sent.</li>
                  )}
                  {recordCount > 0 && <li>• Records: <span className="font-semibold text-slate-800">{recordCount}</span></li>}
                </ul>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-8 px-4 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={sending}
                  className="h-8 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {sending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                  {sending ? "Sending..." : "Send Email"}
                </Button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
