import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  ArrowLeft,
  ScanBarcode,
  Plus,
  Trash2,
  FileText,
  Save,
  Building,
  User,
  Calendar,
  Package,
  CheckCircle,
  Clock,
  AlertTriangle,
  Info,
  Layers,
  Network,
  Send,
  Award,
  CheckSquare,
  Square,
  Search,
  Upload,
  Sparkles,
  Printer,
  ShoppingBag,
  Percent,
  MessageCircle,
  Phone,
  Mail,
  MapPin,
  X
} from "lucide-react";
import { inventoryApi, crmQuotationsApi, crmApi, fetchSalesEmployees, whatsappAutomationApi } from "@/lib/api-client";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";
import { useTenant } from "@/contexts/tenant-context";
import { getActiveBillingGst } from "@/lib/receipt-template-store";

interface QuotationItem {
  id: string;
  product_id?: string;
  product_name: string;
  sku?: string;
  hsn_code?: string;
  quantity: number;
  unit_of_measure: string;
  unit_price: number;
  discount_percent: number;
  tax_percent: number;
  line_total: number;
  search_query?: string;
  is_search_open?: boolean;
}

interface CustomerQuotationFormProps {
  onClose: () => void;
  onSaved?: () => void;
  initialData?: any;
}

export function CustomerQuotationForm({ onClose, onSaved, initialData }: CustomerQuotationFormProps) {
  const { currency, formatCurrency } = useCurrency();
  const { tenant } = useTenant();

  // Data Sources
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState<boolean>(false);

  // Batch Multi-Product Selection Modal State
  const [isMultiModalOpen, setIsMultiModalOpen] = useState(false);
  const [multiSearch, setMultiSearch] = useState("");
  const [multiCategory, setMultiCategory] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());

  // Form Fields
  const [quoteNumber, setQuoteNumber] = useState<string>("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [customerEmail, setCustomerEmail] = useState<string>("");
  const [customerAddress, setCustomerAddress] = useState<string>("");
  const [customerGstin, setCustomerGstin] = useState<string>("");

  const [quoteDate, setQuoteDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [validUntilDate, setValidUntilDate] = useState<string>(
    new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 10)
  );
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [paymentTerms, setPaymentTerms] = useState<string>("Net 30 Days");
  const [deliveryTerms, setDeliveryTerms] = useState<string>("Delivery within 3-5 business days");
  const [notes, setNotes] = useState<string>("Prices valid for 30 days. Taxes extra as applicable.");

  // Line items
  const [items, setItems] = useState<QuotationItem[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [prodsRes, custsRes, leadsRes, emps] = await Promise.all([
          inventoryApi.getProducts({ page_size: 500 }).catch(() => ({ items: [] })),
          crmApi.getCustomers(1, 200).catch(() => ({ items: [] })),
          crmApi.getLeads(1, 200).catch(() => ({ items: [] })),
          fetchSalesEmployees().catch(() => [])
        ]);

        const prodItems = Array.isArray(prodsRes) ? prodsRes : (prodsRes?.items || []);
        setProducts(prodItems);

        const custList = Array.isArray(custsRes) ? custsRes : (custsRes?.items || []);
        setCustomers(custList);

        const leadList = Array.isArray(leadsRes) ? leadsRes : (leadsRes?.items || []);
        setLeads(leadList);

        setEmployees(emps || []);
        if (emps && emps.length > 0) setSelectedAgentId(emps[0].id);

        if (initialData) {
          setQuoteNumber(initialData.quote_number || `QT-2026-${Math.floor(1000 + Math.random() * 9000)}`);
          setSelectedCustomerId(initialData.customer_id || "");
          setSelectedCustomerName(initialData.customer_name || "");
          
          const rawItems = initialData.items?.items || initialData.items || [];
          if (Array.isArray(rawItems) && rawItems.length > 0) {
            setItems(rawItems.map((it: any, idx: number) => ({
              id: it.id || String(idx + 1),
              product_id: it.product_id,
              product_name: it.product_name || it.name || "Commercial Product",
              sku: it.sku || "",
              hsn_code: it.hsn_code || "",
              quantity: Number(it.quantity || it.qty || 1),
              unit_of_measure: it.uom || it.unit_of_measure || "Pcs",
              unit_price: Number(it.unit_price || it.price || 0),
              discount_percent: Number(it.discount_percent || 0),
              tax_percent: Number(it.tax_percent || 18),
              line_total: Number(it.line_total || ((it.quantity || 1) * (it.unit_price || 0))),
              search_query: it.product_name || it.name || "",
              is_search_open: false
            })));
          }
        } else {
          // Default empty row with 1 item
          const randomSeq = Math.floor(1000 + Math.random() * 9000);
          setQuoteNumber(`QT-2026-${randomSeq}`);

          if (prodItems.length > 0) {
            const firstP = prodItems[0];
            const pPrice = Number(firstP.selling_price || firstP.mrp || 1500);
            const pTax = Number(firstP.tax_percent || 18);
            const lTotal = pPrice * (1 + pTax / 100);

            setItems([
              {
                id: Math.random().toString(36).substring(2, 9),
                product_id: firstP.id,
                product_name: firstP.name,
                sku: firstP.sku || "",
                hsn_code: firstP.hsn_code || "",
                quantity: 1,
                unit_of_measure: firstP.uom_name || "Pcs",
                unit_price: pPrice,
                discount_percent: 0,
                tax_percent: pTax,
                line_total: lTotal,
                search_query: firstP.name,
                is_search_open: false,
              }
            ]);
          } else {
            setItems([
              {
                id: Math.random().toString(36).substring(2, 9),
                product_name: "Standard Enterprise Service",
                quantity: 1,
                unit_of_measure: "Pcs",
                unit_price: 5000,
                discount_percent: 0,
                tax_percent: 18,
                line_total: 5900,
                search_query: "Standard Enterprise Service",
                is_search_open: false,
              }
            ]);
          }

          if (custList.length > 0) {
            const firstC = custList[0];
            setSelectedCustomerId(firstC.id);
            setSelectedCustomerName(firstC.name);
            setCustomerPhone(firstC.phone || "");
            setCustomerEmail(firstC.email || "");
            setCustomerAddress(`${firstC.city || ""} ${firstC.state || ""}`.trim());
            setCustomerGstin(firstC.tax_id || firstC.gstin || "");
          }
        }
      } catch (err) {
        console.error("Error initializing Quotation form data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [initialData]);

  // Handle Customer Selection
  const handleSelectCustomer = (idOrName: string) => {
    setSelectedCustomerId(idOrName);
    const matchedCust = customers.find(c => c.id === idOrName);
    if (matchedCust) {
      setSelectedCustomerName(matchedCust.name);
      setCustomerPhone(matchedCust.phone || "");
      setCustomerEmail(matchedCust.email || "");
      setCustomerAddress(`${matchedCust.address || ""} ${matchedCust.city || ""} ${matchedCust.state || ""}`.trim());
      setCustomerGstin(matchedCust.tax_id || matchedCust.gstin || "");
      toast.success(`Loaded customer profile: ${matchedCust.name}`);
      return;
    }

    const matchedLead = leads.find(l => l.id === idOrName);
    if (matchedLead) {
      setSelectedCustomerName(matchedLead.name);
      setCustomerPhone(matchedLead.phone || "");
      setCustomerEmail(matchedLead.email || "");
      setCustomerAddress(matchedLead.company_name || "");
      toast.success(`Loaded lead profile: ${matchedLead.name}`);
    }
  };

  // Recalculate Line Total
  const calculateLineTotal = (qty: number, price: number, discountPct: number, taxPct: number) => {
    const discountedPrice = price * (1 - (discountPct || 0) / 100);
    const sub = qty * discountedPrice;
    const withTax = sub * (1 + (taxPct || 0) / 100);
    return Math.round(withTax * 100) / 100;
  };

  const updateItemField = (id: string, field: keyof QuotationItem, value: any) => {
    setItems(prev =>
      prev.map(it => {
        if (it.id === id) {
          const updated = { ...it, [field]: value };
          updated.line_total = calculateLineTotal(
            Number(updated.quantity) || 0,
            Number(updated.unit_price) || 0,
            Number(updated.discount_percent) || 0,
            Number(updated.tax_percent) || 0
          );
          return updated;
        }
        return it;
      })
    );
  };

  const selectCatalogProduct = (itemId: string, product: any) => {
    setItems(prev =>
      prev.map(it => {
        if (it.id === itemId) {
          const pPrice = Number(product.selling_price || product.mrp || 0);
          const pTax = Number(product.tax_percent || 18);
          return {
            ...it,
            product_id: product.id,
            product_name: product.name,
            sku: product.sku || "",
            hsn_code: product.hsn_code || "",
            unit_of_measure: product.uom_name || product.uom || "Pcs",
            unit_price: pPrice,
            tax_percent: pTax,
            line_total: calculateLineTotal(it.quantity || 1, pPrice, it.discount_percent || 0, pTax),
            search_query: product.name,
            is_search_open: false,
          };
        }
        return it;
      })
    );
  };

  const handleAddCustomRow = () => {
    setItems(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        product_name: "",
        quantity: 1,
        unit_of_measure: "Pcs",
        unit_price: 1000,
        discount_percent: 0,
        tax_percent: 18,
        line_total: 1180,
        search_query: "",
        is_search_open: false,
      }
    ]);
  };

  const handleRemoveRow = (id: string) => {
    if (items.length <= 1) return toast.error("Quotation must have at least one line item.");
    setItems(prev => prev.filter(it => it.id !== id));
  };

  // Filtered Products for Batch Selector
  const distinctCategories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => { if (p.category) set.add(p.category); });
    return Array.from(set);
  }, [products]);

  const filteredMultiProducts = useMemo(() => {
    const q = multiSearch.trim().toLowerCase();
    return products.filter(p => {
      const matchCat = !multiCategory || p.category === multiCategory;
      const matchQuery = !q || p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q)) || (p.barcode && p.barcode.includes(q));
      return matchCat && matchQuery;
    });
  }, [products, multiSearch, multiCategory]);

  const toggleSelectProduct = (id: string) => {
    setSelectedProductIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedProductIds(new Set(filteredMultiProducts.map(p => p.id)));
  };

  const clearSelection = () => {
    setSelectedProductIds(new Set());
  };

  const handleAddSelectedProducts = () => {
    const prodsToAdd = products.filter(p => selectedProductIds.has(p.id));
    const newItems: QuotationItem[] = prodsToAdd.map(p => {
      const price = Number(p.selling_price || p.mrp || 100);
      const tax = Number(p.tax_percent || 18);
      return {
        id: Math.random().toString(36).substring(2, 9),
        product_id: p.id,
        product_name: p.name,
        sku: p.sku || "",
        hsn_code: p.hsn_code || "",
        quantity: 1,
        unit_of_measure: p.uom_name || p.uom || "Pcs",
        unit_price: price,
        discount_percent: 0,
        tax_percent: tax,
        line_total: calculateLineTotal(1, price, 0, tax),
        search_query: p.name,
        is_search_open: false,
      };
    });

    setItems(prev => {
      const existingIds = new Set(prev.map(it => it.product_id).filter(Boolean));
      const nonDuplicates = newItems.filter(it => !existingIds.has(it.product_id));
      return [...prev, ...nonDuplicates];
    });

    toast.success(`Added ${prodsToAdd.length} products to customer quotation!`);
    setIsMultiModalOpen(false);
    setSelectedProductIds(new Set());
  };

  // Financial Calculations
  const totals = useMemo(() => {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    let grandTotal = 0;

    items.forEach(it => {
      const qty = Number(it.quantity) || 0;
      const price = Number(it.unit_price) || 0;
      const discPct = Number(it.discount_percent) || 0;
      const taxPct = Number(it.tax_percent) || 0;

      const baseAmount = qty * price;
      const discAmount = baseAmount * (discPct / 100);
      const taxable = baseAmount - discAmount;
      const taxAmount = taxable * (taxPct / 100);

      subtotal += baseAmount;
      totalDiscount += discAmount;
      totalTax += taxAmount;
      grandTotal += (taxable + taxAmount);
    });

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      totalDiscount: Math.round(totalDiscount * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      grandTotal: Math.round(grandTotal * 100) / 100,
    };
  }, [items]);

  // Save Quotation
  const handleSaveQuotation = async (statusOverride = "Draft") => {
    if (items.length === 0) return toast.error("Add at least one line item");
    if (!selectedCustomerName.trim()) return toast.error("Please select or enter customer name");

    setIsSaving(true);
    try {
      const payload = {
        quote_number: quoteNumber,
        customer_id: selectedCustomerId || undefined,
        customer_name: selectedCustomerName,
        subtotal: totals.subtotal,
        tax: totals.totalTax,
        total: totals.grandTotal,
        status: statusOverride,
        items: {
          customer_name: selectedCustomerName,
          customer_phone: customerPhone,
          customer_email: customerEmail,
          customer_address: customerAddress,
          customer_gstin: customerGstin,
          sales_agent_id: selectedAgentId,
          quote_date: quoteDate,
          valid_until: validUntilDate,
          payment_terms: paymentTerms,
          delivery_terms: deliveryTerms,
          notes: notes,
          items: items.map(it => ({
            product_id: it.product_id,
            name: it.product_name,
            product_name: it.product_name,
            sku: it.sku,
            hsn_code: it.hsn_code,
            quantity: Number(it.quantity),
            unit_of_measure: it.unit_of_measure,
            price: Number(it.unit_price),
            unit_price: Number(it.unit_price),
            discount_percent: Number(it.discount_percent),
            tax_percent: Number(it.tax_percent),
            line_total: Number(it.line_total)
          }))
        }
      };

      if (initialData?.id) {
        await crmQuotationsApi.create({ ...payload, id: initialData.id });
        toast.success(`Quotation ${quoteNumber} updated successfully!`);
      } else {
        await crmQuotationsApi.create(payload);
        toast.success(`Quotation ${quoteNumber} created and saved successfully!`);
      }

      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save quotation");
    } finally {
      setIsSaving(false);
    }
  };

  // Convert to Sales Order
  const handleConvertToOrder = async () => {
    await handleSaveQuotation("Accepted");
  };

  // Print GST Quotation A4 PDF
  const handlePrintPDF = () => {
    const printWin = window.open("", "_blank", "width=850,height=1100");
    if (!printWin) {
      toast.error("Please allow popups to preview and print the Quotation PDF.");
      return;
    }

    const activeBillingGst = getActiveBillingGst(tenant?.id);
    const orgName = activeBillingGst?.trade_name || activeBillingGst?.legal_name || tenant?.name || "BusinessOS AI Global";
    const orgLogo = activeBillingGst?.logo_url || tenant?.logo_url || "";
    const orgAddress = activeBillingGst?.address || "KK Street, Proddatur, YSR Cuddapah, Andhra Pradesh - 516360";
    const orgPhone = activeBillingGst?.phone || "+91 98493 44919";
    const orgEmail = activeBillingGst?.email || "sales@businessos.ai";
    const orgGstin = activeBillingGst?.gstin || "37AABCCH694G1Z4";

    const agentObj = employees.find(e => e.id === selectedAgentId);
    const agentName = agentObj?.full_name || "Sales Executive";

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Quotation - ${quoteNumber} - ${selectedCustomerName}</title>
          <style>
            @page { size: A4 portrait; margin: 12mm 15mm; }
            * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
            body { background: #ffffff; color: #0f172a; padding: 16px; font-size: 9.5pt; line-height: 1.5; }
            .container { max-width: 740px; margin: 0 auto; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #00a884; padding-bottom: 14px; margin-bottom: 18px; }
            .org-box { display: flex; align-items: center; gap: 12px; }
            .org-box h1 { font-size: 16pt; font-weight: 900; color: #0f172a; }
            .org-box p { font-size: 8.5pt; color: #64748b; }
            .quote-badge { text-align: right; }
            .quote-tag { display: inline-block; background: #00a884; color: #ffffff; font-size: 8pt; font-weight: 800; padding: 4px 12px; border-radius: 6px; text-transform: uppercase; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; background: #f8fafc; padding: 12px 16px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 18px; font-size: 8.5pt; }
            .info-grid h4 { font-size: 8pt; text-transform: uppercase; color: #94a3b8; font-weight: 800; margin-bottom: 4px; }
            .info-grid p { font-size: 9pt; font-weight: 600; color: #0f172a; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 18px; font-size: 8.5pt; }
            th { background: #f1f5f9; padding: 7px 10px; border: 1px solid #cbd5e1; text-align: left; font-weight: 800; color: #1e293b; }
            td { padding: 7px 10px; border: 1px solid #e2e8f0; }
            .total-box { display: flex; justify-content: space-between; gap: 20px; margin-bottom: 20px; }
            .terms-box { flex: 1; background: #f8fafc; border-left: 3px solid #00a884; padding: 10px 14px; font-size: 8pt; color: #475569; }
            .total-card { width: 280px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 16px; }
            .total-row { display: flex; justify-content: space-between; font-size: 8.5pt; font-weight: 600; margin-bottom: 4px; }
            .grand-total { border-top: 1.5px solid #0f172a; padding-top: 6px; margin-top: 6px; font-size: 11pt; font-weight: 900; color: #00a884; }
            .signature-box { display: flex; justify-content: space-between; margin-top: 30px; padding-top: 10px; border-top: 1px dashed #cbd5e1; font-size: 8pt; color: #64748b; }
            .footer { text-align: center; font-size: 7.5pt; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; margin-top: 20px; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="org-box">
                ${orgLogo ? `<img src="${orgLogo}" alt="${orgName}" style="max-height: 48px; max-width: 140px; object-fit: contain;" />` : `<div style="width: 42px; height: 42px; border-radius: 8px; background: #00a884; color: white; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 13pt;">${orgName.slice(0, 2).toUpperCase()}</div>`}
                <div>
                  <h1>${orgName}</h1>
                  <p>${orgAddress}</p>
                  <p>Ph: ${orgPhone} • Email: ${orgEmail}${orgGstin ? ` • GSTIN: ${orgGstin}` : ""}</p>
                </div>
              </div>
              <div class="quote-badge">
                <span class="quote-tag">Commercial Sales Quote</span>
                <p style="font-size: 9pt; font-weight: bold; margin-top: 4px; color: #0f172a;">Quote #: ${quoteNumber}</p>
                <p style="font-size: 7.5pt; color: #64748b;">Date: ${quoteDate} • Valid Until: ${validUntilDate}</p>
              </div>
            </div>

            <div class="info-grid">
              <div>
                <h4>Prepared For (Client)</h4>
                <p>${selectedCustomerName || "Valued Client"}</p>
                ${customerPhone ? `<p style="font-size: 8pt; color: #64748b;">Phone: +${customerPhone}</p>` : ""}
                ${customerEmail ? `<p style="font-size: 8pt; color: #64748b;">Email: ${customerEmail}</p>` : ""}
                ${customerGstin ? `<p style="font-size: 8pt; color: #64748b;">GSTIN: ${customerGstin}</p>` : ""}
              </div>
              <div>
                <h4>Sales Representative & Terms</h4>
                <p>Account Executive: <strong>${agentName}</strong></p>
                <p style="font-size: 8pt; color: #64748b;">Payment Terms: <strong>${paymentTerms}</strong></p>
                <p style="font-size: 8pt; color: #64748b;">Delivery Terms: <strong>${deliveryTerms}</strong></p>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 35px; text-align: center;">#</th>
                  <th>Item & Description</th>
                  <th style="text-align: center; width: 60px;">Qty</th>
                  <th style="text-align: center; width: 50px;">Unit</th>
                  <th style="text-align: right; width: 90px;">Rate (${currency.symbol})</th>
                  <th style="text-align: center; width: 55px;">Disc %</th>
                  <th style="text-align: center; width: 55px;">GST %</th>
                  <th style="text-align: right; width: 100px;">Amount (${currency.symbol})</th>
                </tr>
              </thead>
              <tbody>
                ${items.map((item, idx) => `
                  <tr>
                    <td style="text-align: center; font-weight: bold; color: #64748b;">${idx + 1}</td>
                    <td>
                      <div style="font-weight: 700; color: #0f172a;">${item.product_name || "Commercial Product"}</div>
                      ${item.sku ? `<div style="font-size: 7pt; color: #94a3b8; font-family: monospace;">SKU: ${item.sku}${item.hsn_code ? ` • HSN: ${item.hsn_code}` : ""}</div>` : ""}
                    </td>
                    <td style="text-align: center; font-weight: 600;">${item.quantity}</td>
                    <td style="text-align: center; color: #64748b;">${item.unit_of_measure}</td>
                    <td style="text-align: right;">${currency.symbol}${Number(item.unit_price).toLocaleString()}</td>
                    <td style="text-align: center; color: #dc2626;">${item.discount_percent > 0 ? `${item.discount_percent}%` : "-"}</td>
                    <td style="text-align: center; color: #64748b;">${item.tax_percent}%</td>
                    <td style="text-align: right; font-weight: 800; color: #0f172a;">${currency.symbol}${Number(item.line_total).toLocaleString()}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>

            <div class="total-box">
              <div class="terms-box">
                <h4 style="font-size: 8pt; text-transform: uppercase; font-weight: 800; color: #0f172a; margin-bottom: 4px;">Terms & Conditions</h4>
                <p>${notes}</p>
                <p style="margin-top: 4px; font-size: 7.5pt; color: #64748b;">• Goods once sold can be returned as per company refund policy.<br>• Please quote Ref No. <strong>${quoteNumber}</strong> for all purchase order linkages.</p>
              </div>

              <div class="total-card">
                <div class="total-row">
                  <span style="color: #64748b;">Subtotal (Base):</span>
                  <span>${currency.symbol}${totals.subtotal.toLocaleString()}</span>
                </div>
                ${totals.totalDiscount > 0 ? `
                  <div class="total-row" style="color: #dc2626;">
                    <span>Trade Discount:</span>
                    <span>-${currency.symbol}${totals.totalDiscount.toLocaleString()}</span>
                  </div>
                ` : ""}
                <div class="total-row">
                  <span style="color: #64748b;">Applicable GST (CGST+SGST):</span>
                  <span>+${currency.symbol}${totals.totalTax.toLocaleString()}</span>
                </div>
                <div class="total-row grand-total">
                  <span>Grand Total:</span>
                  <span>${currency.symbol}${totals.grandTotal.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div class="signature-box">
              <div>
                <p>Client Acceptance Signature: _______________________</p>
                <p style="font-size: 7pt; margin-top: 2px;">Name & Date</p>
              </div>
              <div style="text-align: right;">
                <p>For <strong>${orgName}</strong></p>
                <p style="margin-top: 15px; font-weight: bold; color: #0f172a;">Authorized Signatory</p>
              </div>
            </div>

            <div class="footer">
              <p>Generated by ${orgName} BusinessOS AI ERP • System Generated Electronic Quotation</p>
            </div>
          </div>
        </body>
      </html>
    `;

    printWin.document.write(html);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      printWin.print();
    }, 400);
  };

  // Send WhatsApp Quote directly to customer
  const handleSendWhatsApp = async () => {
    if (!customerPhone) {
      toast.error("Customer has no phone number attached. Please enter phone number.");
      return;
    }

    const cleanPhone = customerPhone.replace(/\D/g, "");
    setIsSendingWhatsApp(true);
    try {
      const activeSessions = await whatsappAutomationApi.getSessions();
      const sessionIds = Object.keys(activeSessions || {});
      const activeSessionId = sessionIds.find(id => activeSessions[id].status === "CONNECTED") || sessionIds[0];

      if (!activeSessionId) {
        // Fallback to whatsapp direct web link
        const text = encodeURIComponent(
          `Hello ${selectedCustomerName},\n\nHere is your official quotation *#${quoteNumber}* from *${tenant?.name || "BusinessOS AI"}* for amount *${currency.symbol}${totals.grandTotal.toLocaleString()}*.\n\nValidity: ${validUntilDate}\nPayment Terms: ${paymentTerms}\n\nPlease let us know if you would like us to process this order!`
        );
        window.open(`https://wa.me/${cleanPhone}?text=${text}`, "_blank");
        toast.success("Opened WhatsApp Web with quotation details!");
        return;
      }

      const msg = `Hello ${selectedCustomerName},\n\nHere is your official quotation *#${quoteNumber}* from *${tenant?.name || "BusinessOS AI"}* for a total of *${currency.symbol}${totals.grandTotal.toLocaleString()}*.\n\nValidity: ${validUntilDate}\nPayment Terms: ${paymentTerms}\n\nPlease reply with *APPROVE* to confirm your order.`;

      await whatsappAutomationApi.sendMessage(activeSessionId, cleanPhone, msg);
      toast.success(`Quotation #${quoteNumber} sent directly to +${cleanPhone} via WhatsApp!`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to dispatch WhatsApp message");
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  // Send Email Quote directly to customer
  const handleSendEmail = () => {
    if (!customerEmail) {
      toast.error("Customer has no email address attached. Please enter an email.");
      return;
    }
    const subject = encodeURIComponent(`Official Commercial Quotation #${quoteNumber} - ${tenant?.name || "BusinessOS AI"}`);
    const body = encodeURIComponent(
      `Dear ${selectedCustomerName},\n\nThank you for reaching out. Please find below our official price quotation #${quoteNumber}:\n\n` +
      `Total Quotation Value: ${currency.symbol}${totals.grandTotal.toLocaleString()}\n` +
      `Quote Date: ${quoteDate}\n` +
      `Validity: ${validUntilDate}\n` +
      `Payment Terms: ${paymentTerms}\n\n` +
      `Items Included (${items.length}):\n` +
      items.map((it, idx) => `${idx + 1}. ${it.product_name} - Qty: ${it.quantity} ${it.unit_of_measure} @ ${currency.symbol}${it.unit_price}`).join("\n") +
      `\n\nPlease let us know if you approve this proposal so we can issue your invoice/sales order.\n\n` +
      `Best regards,\n${tenant?.name || "Sales Department"}`
    );
    window.open(`mailto:${customerEmail}?subject=${subject}&body=${body}`, "_blank");
    toast.success(`Opened email client to send Quotation #${quoteNumber} to ${customerEmail}!`);
  };

  return (
    <div className="bg-slate-50/50 min-h-screen p-4 md:p-6 text-slate-800 space-y-6 max-w-[1600px] mx-auto pb-24">
      {/* ── TOP HEADER BAR ── */}
      <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all font-bold text-xs flex items-center gap-1 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Quotations
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider border ${
                initialData ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-emerald-50 text-emerald-800 border-emerald-200"
              }`}>
                {initialData ? "Editing Customer Quote" : "Sales & Commercial Quotation"}
              </span>
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                {initialData ? `Edit Quotation ${quoteNumber}` : "Create Customer Sales Quotation"}
              </h1>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              Issue itemized sales proposals, pricing estimates & commercial quotes with auto-tax breakdown, WhatsApp sharing & PDF generation.
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <button
            disabled={isSaving}
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-300 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handlePrintPDF}
            className="px-3.5 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            Print PDF
          </button>
          <button
            onClick={handleSendEmail}
            className="px-3.5 py-2.5 text-xs font-bold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-300 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Mail className="w-4 h-4 text-blue-600" />
            Email Quote
          </button>
          <button
            disabled={isSendingWhatsApp}
            onClick={handleSendWhatsApp}
            className="px-3.5 py-2.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <MessageCircle className="w-4 h-4 text-emerald-600" />
            {isSendingWhatsApp ? "Sending..." : "WhatsApp Quote"}
          </button>
          <button
            disabled={isSaving}
            onClick={() => handleSaveQuotation("Draft")}
            className="px-4 py-2.5 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4 text-slate-600" />
            {isSaving ? "Saving..." : "Save Draft"}
          </button>
          <button
            disabled={isSaving || items.length === 0}
            onClick={handleConvertToOrder}
            className="px-5 py-2.5 text-xs font-black text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl shadow-md shadow-emerald-600/20 flex items-center gap-1.5 uppercase tracking-wider disabled:opacity-50 transition-all cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4" />
            {isSaving ? "Processing..." : "Convert to Sales Order"}
          </button>
        </div>
      </div>

      {/* ── TOP 2 CARDS: LINKAGE & REFERENCE ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card 1: Customer & Sales Linkage */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2 flex items-center gap-2">
            <User className="w-4 h-4 text-emerald-600" /> Customer & Sales Linkage
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                Select Customer / Lead *
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => handleSelectCustomer(e.target.value)}
                className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">-- Select Customer or Lead --</option>
                <optgroup label="Registered Customers">
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(+${c.phone})` : ""}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="CRM Inquired Leads">
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} {l.phone ? `(+${l.phone})` : ""} [{l.status || "Lead"}]
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                Sales Representative / Officer *
              </label>
              <select
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {employees.length > 0 ? (
                  employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.employee_code || "Sales Agent"})
                    </option>
                  ))
                ) : (
                  <option value="">Abhilash (Sales Manager)</option>
                )}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                Customer Phone / WhatsApp
              </label>
              <input
                type="text"
                placeholder="e.g. 919849344919"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                Customer Email Address
              </label>
              <input
                type="email"
                placeholder="client@company.com"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Card 2: Quotation Deadlines & Reference */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2 flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-600" /> Quotation Reference & Validity
          </h2>

          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                Quotation Reference No
              </label>
              <input
                type="text"
                value={quoteNumber}
                onChange={(e) => setQuoteNumber(e.target.value)}
                className="w-full h-9 bg-slate-100 border border-slate-200 rounded-xl px-3 text-xs font-bold text-slate-800"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" /> Quote Date
                </label>
                <input
                  type="date"
                  value={quoteDate}
                  onChange={(e) => setQuoteDate(e.target.value)}
                  className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-2.5 text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" /> Valid Until
                </label>
                <input
                  type="date"
                  value={validUntilDate}
                  onChange={(e) => setValidUntilDate(e.target.value)}
                  className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-2.5 text-xs font-bold text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                Payment Terms
              </label>
              <select
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="Immediate / COD">Immediate / COD</option>
                <option value="Net 15 Days">Net 15 Days</option>
                <option value="Net 30 Days">Net 30 Days</option>
                <option value="50% Advance & 50% on Delivery">50% Advance & 50% on Delivery</option>
                <option value="100% Advance Payment">100% Advance Payment</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ── MIDDLE SECTION: INQUIRED MATERIAL ITEMS & SPECIFICATIONS ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-emerald-600" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Quotation Line Items & Specifications ({items.length})
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMultiModalOpen(true)}
              className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" /> + Batch Select Products
            </button>
            <button
              onClick={handleAddCustomRow}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-300 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> + Add Line Item
            </button>
          </div>
        </div>

        {/* Table of Line Items */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-y border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                <th className="p-3 w-10 text-center">#</th>
                <th className="p-3 min-w-[280px]">Catalog Item Autocomplete Search</th>
                <th className="p-3 w-24 text-center">Inquired Qty</th>
                <th className="p-3 w-20 text-center">Unit</th>
                <th className="p-3 w-32 text-right">Unit Rate ({currency.symbol})</th>
                <th className="p-3 w-24 text-center">Disc (%)</th>
                <th className="p-3 w-24 text-center">GST (%)</th>
                <th className="p-3 w-36 text-right">Line Total ({currency.symbol})</th>
                <th className="p-3 w-12 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, index) => {
                const searchResults = products
                  .filter(p => !item.search_query || p.name.toLowerCase().includes((item.search_query || "").toLowerCase()) || (p.sku && p.sku.toLowerCase().includes((item.search_query || "").toLowerCase())))
                  .slice(0, 8);

                return (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3 text-center font-bold text-slate-400">{index + 1}</td>
                    
                    {/* Catalog Autocomplete Search Input */}
                    <td className="p-3 relative">
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Type product name, SKU, or barcode..."
                          value={item.search_query !== undefined ? item.search_query : item.product_name}
                          onChange={(e) => {
                            updateItemField(item.id, "search_query", e.target.value);
                            updateItemField(item.id, "product_name", e.target.value);
                            updateItemField(item.id, "is_search_open", true);
                          }}
                          onFocus={() => updateItemField(item.id, "is_search_open", true)}
                          className="w-full h-8 px-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                        {item.sku && (
                          <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                            SKU: {item.sku} {item.hsn_code ? `• HSN: ${item.hsn_code}` : ""}
                          </span>
                        )}
                      </div>

                      {/* Dropdown Popup */}
                      {item.is_search_open && searchResults.length > 0 && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => updateItemField(item.id, "is_search_open", false)}
                          />
                          <div className="absolute left-3 right-3 top-12 z-20 bg-white border border-slate-200 rounded-xl shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100">
                            {searchResults.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => selectCatalogProduct(item.id, p)}
                                className="w-full text-left p-2.5 hover:bg-emerald-50 transition-colors flex items-center justify-between group cursor-pointer"
                              >
                                <div>
                                  <p className="font-bold text-xs text-slate-800 group-hover:text-emerald-700">{p.name}</p>
                                  <p className="text-[10px] text-slate-400 font-mono">SKU: {p.sku || "N/A"} • Cat: {p.category || "General"}</p>
                                </div>
                                <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                                  {currency.symbol}{Number(p.selling_price || p.mrp || 0).toLocaleString()}
                                </span>
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </td>

                    {/* Qty */}
                    <td className="p-3">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItemField(item.id, "quantity", Number(e.target.value))}
                        className="w-full h-8 text-center bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                      />
                    </td>

                    {/* Unit */}
                    <td className="p-3 text-center">
                      <input
                        type="text"
                        value={item.unit_of_measure}
                        onChange={(e) => updateItemField(item.id, "unit_of_measure", e.target.value)}
                        className="w-full h-8 text-center bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700"
                      />
                    </td>

                    {/* Unit Price */}
                    <td className="p-3">
                      <input
                        type="number"
                        step="0.01"
                        value={item.unit_price}
                        onChange={(e) => updateItemField(item.id, "unit_price", Number(e.target.value))}
                        className="w-full h-8 text-right bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                      />
                    </td>

                    {/* Discount % */}
                    <td className="p-3">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={item.discount_percent}
                        onChange={(e) => updateItemField(item.id, "discount_percent", Number(e.target.value))}
                        className="w-full h-8 text-center bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-rose-600"
                      />
                    </td>

                    {/* Tax / GST % */}
                    <td className="p-3">
                      <select
                        value={item.tax_percent}
                        onChange={(e) => updateItemField(item.id, "tax_percent", Number(e.target.value))}
                        className="w-full h-8 text-center bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700"
                      >
                        <option value="0">0%</option>
                        <option value="5">5%</option>
                        <option value="12">12%</option>
                        <option value="18">18%</option>
                        <option value="28">28%</option>
                      </select>
                    </td>

                    {/* Line Total */}
                    <td className="p-3 text-right font-black text-slate-900 text-sm">
                      {currency.symbol}{Number(item.line_total).toLocaleString()}
                    </td>

                    {/* Delete */}
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(item.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── BOTTOM SECTION: COMMERCIAL TERMS & FINANCIAL TOTALS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Terms and Customer Notes */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2 flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-600" /> Commercial Terms & Delivery Instructions
          </h2>

          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                Delivery / Scope Details
              </label>
              <input
                type="text"
                value={deliveryTerms}
                onChange={(e) => setDeliveryTerms(e.target.value)}
                placeholder="e.g. Free delivery within city limits, freight extra for outstation"
                className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs font-semibold text-slate-800"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                Quotation Notes & Terms Conditions
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter quote terms, bank details, or warranty instructions..."
                className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Right Col: Financial Breakdown Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4 flex flex-col justify-between">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-emerald-600" /> Quotation Financial Summary
            </h2>

            <div className="space-y-2.5 pt-3 text-xs">
              <div className="flex justify-between items-center text-slate-600">
                <span>Items Subtotal:</span>
                <span className="font-bold text-slate-800">{currency.symbol}{totals.subtotal.toLocaleString()}</span>
              </div>

              {totals.totalDiscount > 0 && (
                <div className="flex justify-between items-center text-rose-600">
                  <span>Trade Discount:</span>
                  <span className="font-bold">-{currency.symbol}{totals.totalDiscount.toLocaleString()}</span>
                </div>
              )}

              <div className="flex justify-between items-center text-slate-600">
                <span>Applicable GST (CGST+SGST):</span>
                <span className="font-bold text-slate-800">+{currency.symbol}{totals.totalTax.toLocaleString()}</span>
              </div>

              <div className="border-t-2 border-slate-100 pt-3 flex justify-between items-center">
                <div>
                  <span className="text-sm font-black text-slate-900 block">Grand Total</span>
                  <span className="text-[10px] text-slate-400 font-medium">Inclusive of all taxes</span>
                </div>
                <span className="text-xl font-black text-emerald-600">
                  {currency.symbol}{totals.grandTotal.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 flex gap-2">
            <button
              onClick={handlePrintPDF}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" /> Print PDF
            </button>
            <button
              disabled={isSaving}
              onClick={() => handleSaveQuotation("Sent")}
              className="flex-1 py-2.5 bg-[#00a884] hover:bg-[#008f72] text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Send className="w-4 h-4" /> Save & Issue
            </button>
          </div>
        </div>
      </div>

      {/* ── BATCH MULTI-PRODUCT SELECTION MODAL ── */}
      {isMultiModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-sm text-slate-900">Batch Select Catalog Products</h3>
              </div>
              <button
                onClick={() => setIsMultiModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Filter Search */}
            <div className="p-3 border-b border-slate-100 flex gap-2 bg-white">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search products by name, SKU..."
                  value={multiSearch}
                  onChange={(e) => setMultiSearch(e.target.value)}
                  className="w-full h-8 pl-8 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {distinctCategories.length > 0 && (
                <select
                  value={multiCategory}
                  onChange={(e) => setMultiCategory(e.target.value)}
                  className="h-8 px-2 text-xs bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-700"
                >
                  <option value="">All Categories</option>
                  {distinctCategories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Select All / Clear */}
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-500">
                {selectedProductIds.size} of {filteredMultiProducts.length} items selected
              </span>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={selectAllFiltered}
                  className="text-emerald-600 font-bold hover:underline"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="text-rose-600 font-bold hover:underline"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2">
              {filteredMultiProducts.length > 0 ? (
                filteredMultiProducts.map((p) => {
                  const isChecked = selectedProductIds.has(p.id);
                  return (
                    <div
                      key={p.id}
                      onClick={() => toggleSelectProduct(p.id)}
                      className={`p-3 flex items-center justify-between rounded-xl cursor-pointer transition-colors ${
                        isChecked ? "bg-emerald-50/70 border border-emerald-200" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`size-4 rounded border flex items-center justify-center ${
                          isChecked ? "bg-emerald-600 border-emerald-600 text-white" : "border-slate-300 bg-white"
                        }`}>
                          {isChecked && <CheckSquare className="w-3.5 h-3.5" />}
                        </div>
                        <div>
                          <p className="font-bold text-xs text-slate-900">{p.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            SKU: {p.sku || "N/A"} • Stock: {p.on_hand_stock || 0} {p.uom_name || "Pcs"}
                          </p>
                        </div>
                      </div>

                      <span className="text-xs font-bold text-slate-800">
                        {currency.symbol}{Number(p.selling_price || p.mrp || 0).toLocaleString()}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs">No products match your search.</div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsMultiModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={selectedProductIds.size === 0}
                onClick={handleAddSelectedProducts}
                className="px-5 py-2 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-md disabled:opacity-50 cursor-pointer"
              >
                Add {selectedProductIds.size} Products to Quote
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
