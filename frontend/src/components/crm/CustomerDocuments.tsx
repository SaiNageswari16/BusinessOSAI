import { toast } from "sonner";
import React from "react";
import { motion } from "framer-motion";
import { FileText, Upload, Search, Download, Trash2, Eye, Folder, File, Filter } from "lucide-react";

import { useCrmData } from "@/hooks/useCrmData";
import { useCurrency } from "@/hooks/use-currency";

interface Props {
  tab?: string;
}

export function CustomerDocuments({ tab = "all_documents" }: Props) {
    const { currency, formatCurrency } = useCurrency();
  const { mockCustomerDocuments } = useCrmData();
  const documents = mockCustomerDocuments;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Customer Documents</h1>
          <p className="text-sm text-muted-foreground">Securely manage NDAs, contracts, and compliance documents.</p>
        </div>
        <button onClick={() => toast.info('Feature coming soon!')} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity">
          <Upload className="size-4" /> Upload Document
        </button>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 glass-panel p-4 rounded-xl border border-border/50">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search documents by name, customer, or type..."
            className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => toast.info('Feature coming soon!')} className="flex items-center gap-2 px-4 py-2 bg-background/50 border border-border rounded-lg text-sm font-medium hover:bg-accent transition-colors">
            <Filter className="size-4" /> Filter
          </button>
          <button onClick={() => toast.info('Feature coming soon!')} className="flex items-center gap-2 px-4 py-2 bg-background/50 border border-border rounded-lg text-sm font-medium hover:bg-accent transition-colors">
            <Folder className="size-4" /> Manage Folders
          </button>
        </div>
      </div>

      <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground bg-muted/50 uppercase border-b border-border/50">
              <tr>
                <th className="px-6 py-3">Document Name</th>
                <th className="px-6 py-3">Customer</th>
                <th className="px-6 py-3">Size</th>
                <th className="px-6 py-3">Uploaded By</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {documents.map((doc, i) => (
                <motion.tr 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  key={doc.id} 
                  className="hover:bg-muted/50 transition-colors group"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        doc.type === 'PDF' ? 'bg-red-500/10 text-red-600' :
                        doc.type === 'Word' ? 'bg-blue-500/10 text-blue-600' :
                        'bg-amber-500/10 text-amber-600'
                      }`}>
                        {doc.type === 'PDF' ? <FileText className="size-4" /> : <File className="size-4" />}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">{doc.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-medium">{doc.customer}</td>
                  <td className="px-6 py-4 text-muted-foreground">{doc.size}</td>
                  <td className="px-6 py-4 text-muted-foreground">{doc.author}</td>
                  <td className="px-6 py-4 text-muted-foreground">{doc.date}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => toast.info('Feature coming soon!')} className="p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground rounded-md transition-colors">
                        <Eye className="size-4" />
                      </button>
                      <button onClick={() => toast.info('Feature coming soon!')} className="p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground rounded-md transition-colors">
                        <Download className="size-4" />
                      </button>
                      <button onClick={() => toast.info('Feature coming soon!')} className="p-1.5 text-muted-foreground hover:bg-accent hover:text-red-500 rounded-md transition-colors">
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
