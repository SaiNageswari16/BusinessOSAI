import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  Building2,
  FileText,
  Save,
  User,
  Phone,
  Mail,
  CreditCard,
  Building,
  ShieldCheck,
  Star,
  MapPin,
  Layers,
  Info,
  CheckCircle,
  Briefcase,
  AlertCircle,
  Globe,
  Award
} from "lucide-react";
import { inventoryApi } from "@/lib/api-client";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";
import { INDIAN_STATES } from "@/data/indian-states";
import { usePincodeLookup } from "@/hooks/use-pincode-lookup";

interface SupplierFormProps {
  supplierId?: string | null;
  onClose: () => void;
  onSaved?: () => void;
}

export function SupplierForm({ supplierId, onClose, onSaved }: SupplierFormProps) {
    const { currency, formatCurrency } = useCurrency();
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Form Fields
  const [name, setName] = useState<string>("");
  const [companyName, setCompanyName] = useState<string>("");
  const [code, setCode] = useState<string>("");
  const [type, setType] = useState<string>("Manufacturer");
  const [categoryId, setCategoryId] = useState<string>("");
  const [creditLimit, setCreditLimit] = useState<number>(500000);
  const [rating, setRating] = useState<number>(5.0);
  const [statusVal, setStatusVal] = useState<string>("Active");

  // Contact details
  const [contactName, setContactName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [phone, setPhone] = useState<string>("");

  // Financial & Tax Details
  const [gstin, setGstin] = useState<string>("27AAAAA0000A1Z5");
  const [pan, setPan] = useState<string>("AAAAA0000A");
  const [paymentTerms, setPaymentTerms] = useState<string>("Net 30 Days");

  // Bank Account
  const [bankName, setBankName] = useState<string>("HDFC Bank");
  const [accountNumber, setAccountNumber] = useState<string>("5010023490182");
  const [ifscCode, setIfscCode] = useState<string>("HDFC0001234");

  // Operating & Registered Address Details
  const [address, setAddress] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [state, setState] = useState<string>("");
  const [pincode, setPincode] = useState<string>("");
  const [website, setWebsite] = useState<string>("");
  const [msmeNumber, setMsmeNumber] = useState<string>("");
  const { lookup: lookupPincode } = usePincodeLookup();

  const handlePincodeChange = async (val: string) => {
    setPincode(val);
    const clean = val.replace(/\D/g, "").slice(0, 6);
    if (clean.length === 6) {
      const res = await lookupPincode(clean, { silent: false });
      if (res) {
        if (res.city && !city) setCity(res.city);
        if (res.state) {
          const matched = INDIAN_STATES.find(
            (s) => s.name.toLowerCase() === res.state.toLowerCase() || res.state.toLowerCase().includes(s.name.toLowerCase())
          );
          setState(matched?.name || res.state);
        }
      }
    }
  };

  // Supplied Goods Description
  const [productsDesc, setProductsDesc] = useState<string>(
    "Primary supplier for raw materials, packaging boxes, and store consumables."
  );

  // GST Verification & Existing Vendor Detection State
  const [isVerifyingGst, setIsVerifyingGst] = useState<boolean>(false);
  const [gstDetails, setGstDetails] = useState<any>(null);
  const [existingVendorMatch, setExistingVendorMatch] = useState<any>(null);

  const handleVerifyGstin = async (gstOverride?: string) => {
    const cleanGst = (gstOverride || gstin || "").trim().toUpperCase();
    if (!cleanGst || cleanGst.length !== 15) {
      if (!gstOverride) toast.error("Please enter a valid 15-character GSTIN Number.");
      return;
    }
    setIsVerifyingGst(true);
    try {
      // 1. Check if vendor with this GSTIN or PAN is ALREADY in the directory!
      let existingMatch: any = null;
      try {
        const allSupps = await inventoryApi.getSuppliers();
        if (Array.isArray(allSupps)) {
          existingMatch = allSupps.find((s: any) => {
            if (supplierId && s.id === supplierId) return false;
            const sGst = String(s.gst_number || s.tax_id || s.gstin || s.products_desc || "").trim().toUpperCase();
            return sGst && sGst.includes(cleanGst);
          });
        }
      } catch (checkErr) {
        console.warn("Could not check existing vendors:", checkErr);
      }

      if (existingMatch) {
        setExistingVendorMatch(existingMatch);
        if (existingMatch.name) setName(existingMatch.name);
        if (existingMatch.company_name) setCompanyName(existingMatch.company_name);
        if (existingMatch.code) setCode(existingMatch.code);
        if (existingMatch.type) setType(existingMatch.type);
        if (existingMatch.category_id) setCategoryId(existingMatch.category_id);
        if (existingMatch.credit_limit) setCreditLimit(Number(existingMatch.credit_limit));
        if (existingMatch.rating) setRating(Number(existingMatch.rating));
        if (existingMatch.status) setStatusVal(existingMatch.status);
        if (existingMatch.phone) setPhone(existingMatch.phone);
        if (existingMatch.email) setEmail(existingMatch.email);
        if (existingMatch.address) setAddress(existingMatch.address);
        if (existingMatch.city) setCity(existingMatch.city);
        if (existingMatch.state) setState(existingMatch.state);
        if (existingMatch.pincode) setPincode(existingMatch.pincode);
        if (existingMatch.products_desc) setProductsDesc(existingMatch.products_desc);
        setPan(cleanGst.slice(2, 12));
        setGstin(cleanGst);
      }

      // 2. Query GST portal verification to enrich details (for new vendors or to fill missing fields on existing)
      const res = await inventoryApi.verifyGstin(cleanGst);
      if (res && res.valid) {
        setGstDetails(res);
        if (res.pan) setPan(res.pan);
        if (res.gstin) setGstin(res.gstin);

        const resolvedTradeName = res.trade_name || res.legal_name || `Taxpayer Entity (${res.pan || cleanGst.slice(2, 12)})`;
        const resolvedLegalName = res.legal_name || res.trade_name || resolvedTradeName;

        // Auto-fill names if not already provided or if placeholder
        setName((prev) => (!prev || prev.startsWith("Vendor ") ? resolvedTradeName : prev));
        setCompanyName((prev) => (!prev || prev.startsWith("Vendor ") ? resolvedLegalName : prev));
        setContactName((prev) => prev || res.contact_person || (resolvedTradeName.split(" ")[0] + " (Primary Contact)"));
        setEmail((prev) => prev || res.email || `contact@${resolvedTradeName.toLowerCase().replace(/[^a-z0-9]/g, "") || "vendor"}.in`);
        setPhone((prev) => prev || res.phone || "+91 98765 43210");
        if (res.bank_name) setBankName((prev) => prev || res.bank_name);
        if (res.account_number) setAccountNumber((prev) => prev || res.account_number);
        if (res.ifsc_code) setIfscCode((prev) => prev || res.ifsc_code);

        // Auto-fill Address, City, State, PIN
        const resolvedAddress = res.principal_address || res.address || "";
        if (resolvedAddress) {
          setAddress((prev) => prev || resolvedAddress);
        }
        if (res.city) {
          setCity((prev) => prev || res.city);
        }
        if (res.state) {
          const matched = INDIAN_STATES.find(
            (s) => s.name.toLowerCase() === res.state.toLowerCase() || res.state.toLowerCase().includes(s.name.toLowerCase())
          );
          setState((prev) => prev || matched?.name || res.state);
        }
        if (res.pincode) {
          setPincode((prev) => prev || res.pincode);
        }

        // 3. Fallback Pincode Lookup to auto-resolve City and State if still empty
        const effectivePin = (res.pincode || existingMatch?.pincode || pincode || "").replace(/\D/g, "").slice(0, 6);
        if (effectivePin.length === 6) {
          try {
            const pinRes = await lookupPincode(effectivePin, { silent: true });
            if (pinRes) {
              setCity((prev) => prev || pinRes.city);
              if (pinRes.state) {
                const matchedSt = INDIAN_STATES.find(
                  (s) => s.name.toLowerCase() === pinRes.state.toLowerCase() || pinRes.state.toLowerCase().includes(s.name.toLowerCase())
                );
                setState((prev) => prev || matchedSt?.name || pinRes.state);
              }
              if (pinRes.area) {
                setAddress((prev) => prev || `${pinRes.area}, ${pinRes.city || ""}, ${pinRes.state} - ${effectivePin}`);
              }
            }
          } catch (pinErr) {
            console.debug("Pincode lookup fallback:", pinErr);
          }
        }

        if (res.business_nature) {
          setProductsDesc((prev) => prev || `[GST Nature: ${res.business_nature}] Primary supplier for raw materials, packaging, and store goods.`);
        } else if (resolvedAddress) {
          setProductsDesc((prev) => prev || `Registered Address: ${resolvedAddress} | State: ${res.state} (${res.state_code})`);
        }

        if (existingMatch) {
          toast.info(
            `Vendor already exists as "${existingMatch.name}" (${existingMatch.code}). Auto-loaded and enriched with GST Portal data!`,
            { duration: 5000 }
          );
        } else {
          toast.success(
            `GST Portal Verified! Auto-filled all details for "${resolvedTradeName}" (${res.state || "India"})`
          );
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch details from GST portal");
    } finally {
      setIsVerifyingGst(false);
    }
  };

  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      try {
        const cats = await inventoryApi.getSupplierCategories().catch(() => []);
        setCategories(cats || []);

        if (supplierId) {
          const supps = await inventoryApi.getSuppliers().catch(() => []);
          const existing = supps.find((s: any) => s.id === supplierId);
          if (existing) {
            setName(existing.name || "");
            setCompanyName(existing.company_name || existing.name || "");
            setCode(existing.code || "");
            setType(existing.type || "Manufacturer");
            setCategoryId(existing.category_id || "");
            setCreditLimit(existing.credit_limit || 500000);
            setRating(existing.rating || 5.0);
            setStatusVal(existing.status || "Active");
            setProductsDesc(existing.products_desc || "");
            const loadedGst = existing.gst_number || existing.gstin || "";
            setGstin(loadedGst);
            setPan(existing.pan || (loadedGst.length >= 12 ? loadedGst.slice(2, 12) : ""));
            setPhone(existing.phone || "");
            setEmail(existing.email || "");
            setAddress(existing.address || "");
            setCity(existing.city || "");
            setState(existing.state || "");
            const loadedPin = (existing.pincode || "").replace(/\D/g, "").slice(0, 6);
            setPincode(loadedPin);

            // Auto-enrich city and state if pincode is present but city/state were blank
            if (loadedPin.length === 6 && (!existing.city || !existing.state)) {
              lookupPincode(loadedPin, { silent: true }).then((pinRes) => {
                if (pinRes) {
                  if (!existing.city && pinRes.city) setCity(pinRes.city);
                  if (!existing.state && pinRes.state) {
                    const matchedSt = INDIAN_STATES.find(
                      (s) => s.name.toLowerCase() === pinRes.state.toLowerCase() || pinRes.state.toLowerCase().includes(s.name.toLowerCase())
                    );
                    setState(matchedSt?.name || pinRes.state);
                  }
                  if (!existing.address && pinRes.area) {
                    setAddress(`${pinRes.area}, ${pinRes.city || ""}, ${pinRes.state} - ${loadedPin}`);
                  }
                }
              }).catch(() => {});
            }

            // Auto-enrich address from GST if address is blank
            if (loadedGst && loadedGst.length === 15 && (!existing.address || !existing.state || !existing.city)) {
              inventoryApi.verifyGstin(loadedGst).then((gstRes) => {
                if (gstRes && gstRes.valid) {
                  if (!existing.address && (gstRes.principal_address || gstRes.address)) {
                    setAddress(gstRes.principal_address || gstRes.address);
                  }
                  if (!existing.city && gstRes.city) setCity(gstRes.city);
                  if (!existing.state && gstRes.state) {
                    const matched = INDIAN_STATES.find(
                      (s) => s.name.toLowerCase() === gstRes.state.toLowerCase() || gstRes.state.toLowerCase().includes(s.name.toLowerCase())
                    );
                    setState(matched?.name || gstRes.state);
                  }
                  if (!loadedPin && gstRes.pincode) setPincode(gstRes.pincode);
                }
              }).catch(() => {});
            }
          }
        } else {
          const seq = Math.floor(1000 + Math.random() * 9000);
          setCode(`VEN-2026-${seq}`);
          if (cats && cats.length > 0) setCategoryId(cats[0].id);
        }
      } catch (err) {
        console.error("Error loading supplier data:", err);
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, [supplierId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Supplier party name is required.");
    if (!code.trim()) return toast.error("Supplier code is required.");

    setIsSaving(true);
    try {
      let finalDesc = productsDesc;
      if (msmeNumber && !finalDesc.includes("MSME:")) {
        finalDesc = `${finalDesc} | MSME: ${msmeNumber}`;
      }
      if (website && !finalDesc.includes("Website:")) {
        finalDesc = `${finalDesc} | Website: ${website}`;
      }

      const taxPayload = {
        gst_number: gstin.trim().toUpperCase() || undefined,
        pan: pan.trim().toUpperCase() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        pincode: pincode.trim() || undefined,
      };
      const targetId = supplierId || (existingVendorMatch ? existingVendorMatch.id : null);
      if (targetId) {
        await inventoryApi.updateSupplier(targetId, {
          name,
          code,
          type,
          company_name: companyName || name,
          credit_limit: Number(creditLimit),
          rating: Number(rating),
          products_desc: finalDesc,
          category_id: categoryId || undefined,
          status: statusVal,
          ...taxPayload,
        });
        toast.success(`Supplier "${name}" profile updated successfully!`);
      } else {
        await inventoryApi.createSupplier({
          name,
          code,
          type,
          company_name: companyName || name,
          credit_limit: Number(creditLimit),
          rating: Number(rating),
          products_desc: finalDesc,
          category_id: categoryId || undefined,
          status: statusVal,
          ...taxPayload,
        });
        toast.success(`Supplier "${name}" onboarded successfully!`);
      }

      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save supplier profile");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-slate-50/50 min-h-screen p-4 md:p-6 text-slate-800 space-y-6 max-w-[1600px] mx-auto pb-24">
      {/* Top Header */}
      <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all font-bold text-xs flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Vendors List
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-teal-100 text-teal-800 border border-teal-200">
                Supplier Profile
              </span>
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                {supplierId ? "Edit Vendor / Supplier Profile" : "Onboard New Supplier Party"}
              </h1>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              Manage comprehensive vendor credentials, tax GSTIN, credit limits, bank account details, and catalog items.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            disabled={isSaving}
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-300"
          >
            Cancel
          </button>
          <button
            disabled={isSaving}
            onClick={handleSubmit}
            className="px-5 py-2.5 text-xs font-black text-white bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 rounded-xl shadow-md shadow-teal-600/20 flex items-center gap-1.5 uppercase tracking-wider disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? "Saving..." : "Save Supplier Profile"}
          </button>
        </div>
      </div>

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Business & Identity Details (2 Cols on lg) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Existing Vendor Detection Banner */}
          {existingVendorMatch && (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-start gap-3 text-amber-900 shadow-sm animate-in fade-in duration-200">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-bold text-sm text-amber-950 flex items-center gap-2">
                  <span>Vendor Already Exists in Directory</span>
                  <span className="font-mono bg-amber-200 text-amber-900 px-2 py-0.5 rounded text-[11px]">
                    {existingVendorMatch.code}
                  </span>
                </p>
                <p>
                  A registered supplier matching this GSTIN was found: <strong>{existingVendorMatch.name}</strong>.
                </p>
                <p className="text-amber-800">
                  All profiles and credentials have been auto-loaded. Saving this form will update this existing vendor rather than creating a duplicate.
                </p>
              </div>
            </div>
          )}

          {/* Section 1: Business Identity */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-teal-600" /> Business Identity & Category
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                  Supplier Display / Party Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Metro Wholesale Pvt Ltd"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                  Legal Registered Company Name
                </label>
                <input
                  type="text"
                  placeholder="Legal company entity name"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs font-semibold text-slate-800 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                  Business Type *
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="Manufacturer">Manufacturer</option>
                  <option value="Wholesaler">Wholesaler & Stockist</option>
                  <option value="Distributor">Authorized Distributor</option>
                  <option value="Importer">Importer & Exporter</option>
                  <option value="Service Provider">Service Provider</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                  Supplier Category
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">-- Select Category --</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                  Vendor Status
                </label>
                <select
                  value={statusVal}
                  onChange={(e) => setStatusVal(e.target.value)}
                  className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs font-bold text-slate-800 outline-none"
                >
                  <option value="Active">Active Supplier</option>
                  <option value="Inactive">Inactive / Suspended</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Contact Person & Communication */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2 flex items-center gap-2">
              <User className="w-4 h-4 text-emerald-600" /> Contact Person & Communication
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                  Contact Person Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rajesh Sharma"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs font-semibold text-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="vendor@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs font-semibold text-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                  Phone / Mobile Number
                </label>
                <input
                  type="text"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs font-semibold text-slate-800 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Registered Office & Operating Address */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-rose-600" /> Registered Office & Operating Address
            </h2>

            <div>
              <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                Street / Factory / Premises Address
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Plot No. 42, Industrial Area Phase II, Near Express Highway"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                  City / District
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mumbai"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                  State / UT
                </label>
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                >
                  <option value="">-- Select State --</option>
                  {INDIAN_STATES.map((st) => (
                    <option key={st.code} value={st.name}>
                      {st.name} ({st.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1 flex items-center justify-between">
                  <span>PIN / Postal Code</span>
                  <span className="text-[10px] text-teal-600 font-normal">Auto-detects City & State</span>
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="e.g. 400001"
                  value={pincode}
                  onChange={(e) => handlePincodeChange(e.target.value)}
                  className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs font-mono font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1 flex items-center gap-1">
                  <Award className="w-3.5 h-3.5 text-amber-600" /> MSME / Udyam Registration (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. UDYAM-MH-01-0012345"
                  value={msmeNumber}
                  onChange={(e) => setMsmeNumber(e.target.value.toUpperCase())}
                  className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs font-mono text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1 flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5 text-blue-600" /> Website / Vendor Portal URL (Optional)
                </label>
                <input
                  type="url"
                  placeholder="https://vendorwebsite.com"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Bank Account & Payment Settlement */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-600" /> Bank Settlement Account Details
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                  Bank Name
                </label>
                <input
                  type="text"
                  placeholder="HDFC Bank"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs font-semibold text-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                  Account Number
                </label>
                <input
                  type="text"
                  placeholder="5010023490182"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs font-mono font-bold text-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                  IFSC Code
                </label>
                <input
                  type="text"
                  placeholder="HDFC0001234"
                  value={ifscCode}
                  onChange={(e) => setIfscCode(e.target.value)}
                  className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs font-mono font-bold text-slate-800 outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Code, Rating, Tax & Credit Terms (1 Col on lg) */}
        <div className="space-y-6">
          {/* System Code & Credit Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-teal-600" /> Code & Credit Limits
            </h2>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                  Supplier Unique Code
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs font-mono font-bold text-teal-900 outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                  Credit Limit Amount ({currency.symbol})
                                                  </label>
                <input
                  type="number"
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(Number(e.target.value) || 0)}
                  className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                  Payment Terms Offered
                </label>
                <select
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs font-bold text-slate-800 outline-none"
                >
                  <option value="Net 15 Days">Net 15 Days</option>
                  <option value="Net 30 Days">Net 30 Days</option>
                  <option value="Net 60 Days">Net 60 Days</option>
                  <option value="Advance Payment">Advance Payment Required</option>
                  <option value="Cash on Delivery">Cash on Delivery (COD)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                  Vendor Rating Score (1.0 to 5.0)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="5"
                    value={rating}
                    onChange={(e) => setRating(Number(e.target.value) || 5)}
                    className="w-24 h-9 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs font-bold text-slate-900 outline-none"
                  />
                  <div className="flex items-center gap-1 text-amber-500 font-bold text-xs">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    <span>{rating.toFixed(1)} / 5.0</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tax & Regulatory Compliance Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" /> Tax & GST Portal Integration
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                GST Portal Active
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                  GSTIN / Tax Identification Number *
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    maxLength={15}
                    placeholder="e.g. 27AAPCU0975E1ZS"
                    value={gstin}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      setGstin(val);
                      if (val.length === 15) handleVerifyGstin(val);
                    }}
                    className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs font-mono font-bold text-slate-800 outline-none uppercase focus:ring-2 focus:ring-teal-500"
                  />
                  <button
                    type="button"
                    disabled={isVerifyingGst}
                    onClick={() => handleVerifyGstin()}
                    className="px-3.5 h-9 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-xs shrink-0 shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isVerifyingGst ? "Fetching..." : "Verify & Auto-Fill"}
                  </button>
                </div>
              </div>

              {gstDetails && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-1 text-emerald-900">
                  <div className="font-bold flex items-center gap-1.5 text-emerald-800">
                    <CheckCircle className="w-4 h-4 text-emerald-600" /> GSTIN Verified: {gstDetails.gstin}
                  </div>
                  <div className="text-[11px] text-emerald-800">
                    <span className="font-bold">Legal Name:</span> {gstDetails.legal_name}
                  </div>
                  <div className="text-[11px] text-emerald-800 flex justify-between">
                    <span><span className="font-bold">State:</span> {gstDetails.state} ({gstDetails.state_code})</span>
                    <span className="font-bold uppercase text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">{gstDetails.taxpayer_type}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                  PAN Card Number (Auto-extracted from GSTIN)
                </label>
                <input
                  type="text"
                  placeholder="AAAAA0000A"
                  value={pan}
                  onChange={(e) => setPan(e.target.value.toUpperCase())}
                  className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs font-mono font-bold text-slate-800 outline-none uppercase"
                />
              </div>
            </div>
          </div>

          {/* Products & Description Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-teal-600" /> Supplied Goods & Catalog Notes
            </h2>

            <textarea
              rows={4}
              value={productsDesc}
              onChange={(e) => setProductsDesc(e.target.value)}
              placeholder="List of products and materials supplied by this vendor..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
