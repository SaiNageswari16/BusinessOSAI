import React, { useMemo } from "react";

/**
 * Shared Markdown formatter for LazyMonkeyAI responses.
 * Supports: headers, bullet/numbered lists, tables, inline bold/italic/code/links.
 * Used by both the floating agent widget and the Workspace Hub AI tab.
 */
export function MarkdownFormatter({ text, className = "" }: { text: string; className?: string }) {
  const html = useMemo(() => renderMarkdown(text), [text]);
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Convert raw markdown text to safe-ish HTML with styled classes. */
export function renderMarkdown(raw: string): string {
  if (!raw) return "";

  const lines = raw.split("\n");
  let out = "";
  let inTable = false;
  let tableRows: string[][] = [];

  const flushTable = () => {
    if (tableRows.length === 0) return;
    const [header, , ...rows] = tableRows;
    out += `
      <div class="my-2.5 overflow-x-auto rounded-xl border border-slate-200 shadow-xs">
        <table class="w-full text-[11px]">
          <thead class="bg-slate-50 border-b text-slate-500 text-[10px] uppercase font-semibold">
            <tr>${header.map((h, i) => `<th class="px-3 py-1.5 text-left font-bold">${inline(h)}</th>`).join("")}</tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${rows.map((r) => `<tr class="hover:bg-slate-50/50">${r.map((c) => `<td class="px-3 py-1.5">${inline(c)}</td>`).join("")}</tr>`).join("")}
          </tbody>
        </table>
      </div>`;
    tableRows = [];
    inTable = false;
  };

  for (const line of lines) {
    if (line.includes("|") && line.trim().startsWith("|")) {
      inTable = true;
      tableRows.push(line.split("|").slice(1, -1).map((c) => c.trim()));
      continue;
    }
    if (inTable) flushTable();

    if (line.startsWith("### ")) {
      out += `<h4 class="font-bold text-[13px] text-slate-900 mt-2.5 mb-1">${inline(line.slice(4))}</h4>`;
    } else if (line.startsWith("## ")) {
      out += `<h3 class="font-extrabold text-sm text-slate-900 mt-3 mb-1">${inline(line.slice(3))}</h3>`;
    } else if (line.startsWith("# ")) {
      out += `<h2 class="font-black text-base text-slate-900 mt-3 mb-1.5">${inline(line.slice(2))}</h2>`;
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      out += `<div class="ml-4 my-0.5 flex gap-2 text-[12px] leading-relaxed"><span class="text-purple-500 shrink-0">•</span><span class="flex-1">${inline(line.slice(2))}</span></div>`;
    } else if (/^\d+\.\s/.test(line)) {
      const num = line.match(/^\d+/)?.[0] || "";
      out += `<div class="ml-4 my-0.5 flex gap-2 text-[12px] leading-relaxed"><span class="text-purple-600 font-bold shrink-0 w-4 text-right">${num}.</span><span class="flex-1">${inline(line.replace(/^\d+\.\s/, ""))}</span></div>`;
    } else if (line.trim() === "") {
      out += `<div class="h-1.5"></div>`;
    } else {
      out += `<p class="my-1 text-[12px] leading-relaxed text-slate-800">${inline(line)}</p>`;
    }
  }
  if (inTable) flushTable();

  return out;
}

/** Inline formatting: bold, italic, code, links. Escape HTML first. */
function inline(s: string): string {
  const esc = s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return esc
    .replace(/\*\*(.+?)\*\*/g, "<strong class='font-bold text-slate-900'>$1</strong>")
    .replace(/`(.+?)`/g, '<code class="px-1 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[11px] font-mono text-indigo-700">$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer" class="text-indigo-600 font-semibold underline underline-offset-2 hover:opacity-80">$1</a>');
}
