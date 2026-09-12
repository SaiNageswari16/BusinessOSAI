import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  QrCode,
  Send,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Copy,
  Check,
  Zap,
  ExternalLink,
  CreditCard,
  RefreshCw,
  ShieldCheck,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { generateQRCodeSVG } from "@/lib/qr-generator";
import { cn } from "@/lib/utils";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";

interface RazorpaySubscriptionModalProps {
  isOpen: boolean;
  tenantId: string;
  tenantName: string;
  amount: number;
  currency?: string;
  taxRate?: number;
  tenureValue?: number;
  tenureUnit?: string;
  plan?: string;
  customerEmail?: string;
  customerName?: string;
  customerPhone?: string;
  invoiceNumber?: string;
  accessToken?: string | null;
  onClose: () => void;
  onSuccess: (verifiedSummary: any) => void;
}

export function RazorpaySubscriptionModal({
  isOpen,
  tenantId,
  tenantName,
  amount,
  currency = "INR",
  taxRate = 18,
  tenureValue = 12,
  tenureUnit = "months",
  plan = "enterprise",
  customerEmail = "",
  customerName = "Tenant Admin",
  customerPhone = "",
  invoiceNumber = "",
  accessToken,
  onClose,
  onSuccess,
}: RazorpaySubscriptionModalProps) {
  const [mobile, setMobile] = useState(customerPhone);
  const [loading, setLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [order, setOrder] = useState<any | null>(null);
  const [paymentLink, setPaymentLink] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [activeTab, setActiveTab] = useState<"qr" | "sms" | "card">("qr");
  const [pollCount, setPollCount] = useState(0);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const hasTriggeredSuccessRef = useRef(false);

  const totalPayable = amount * (1 + (taxRate || 18) / 100);
  const invNum = invoiceNumber || `INV-${new Date().getFullYear()}-${tenantId.slice(0, 6).toUpperCase()}`;

  const getAuthToken = () => {
    return accessToken || (typeof window !== "undefined" ? localStorage.getItem("access_token") : "") || "";
  };

  // Load Razorpay Checkout Script
  useEffect(() => {
    if (!window.Razorpay) {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      hasTriggeredSuccessRef.current = false;
      setMobile(customerPhone);
      setIsPaid(false);
      initiateOrderAndLink();
    } else {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      hasTriggeredSuccessRef.current = false;
      setOrder(null);
      setPaymentLink("");
      setIsPaid(false);
      setPollCount(0);
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [isOpen, tenantId, amount]);

  const initiateOrderAndLink = async () => {
    setLoading(true);
    const token = getAuthToken();
    try {
      // 1. Create Order
      const orderRes = await fetch(`${API_BASE_URL}/system/tenants/${tenantId}/subscription/razorpay/create-order`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          billing_amount: amount,
          currency,
          tax_rate: taxRate,
          tenure_value: tenureValue,
          tenure_unit: tenureUnit,
          plan,
        }),
      });

      if (orderRes.ok) {
        const ordData = await orderRes.json().catch(() => null);
        if (ordData) {
          setOrder(ordData);
        }
      }

      // 2. Generate Payment Link
      const linkRes = await fetch(`${API_BASE_URL}/system/tenants/${tenantId}/subscription/razorpay/payment-link`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: mobile || customerPhone,
          billing_amount: amount,
          currency,
          tax_rate: taxRate,
          tenure_value: tenureValue,
          tenure_unit: tenureUnit,
          plan,
          notify_email: false,
          notify_sms: false,
        }),
      });

      if (linkRes.ok) {
        const lnkData = await linkRes.json().catch(() => null);
        if (lnkData?.payment_link_url) {
          setPaymentLink(lnkData.payment_link_url);
        }
      }
    } catch (err: any) {
      console.warn("Could not initiate automatic pre-order:", err);
    } finally {
      setLoading(false);
    }
  };

  // Trigger Send SMS Payment Link
  const handleSendSMS = async () => {
    if (!mobile || mobile.length < 8) {
      toast.error("Please enter a valid customer phone number with country code.");
      return;
    }
    setLoading(true);
    const token = getAuthToken();
    try {
      const res = await fetch(`${API_BASE_URL}/system/tenants/${tenantId}/subscription/razorpay/payment-link`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: mobile,
          billing_amount: amount,
          currency,
          tax_rate: taxRate,
          tenure_value: tenureValue,
          tenure_unit: tenureUnit,
          plan,
          notify_email: true,
          notify_sms: true,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || `Server error (${res.status})`);

      setPaymentLink(data.payment_link_url);
      toast.success(`Payment link & SMS dispatched to ${mobile}!`);
    } catch (err: any) {
      toast.error(err.message || "Could not dispatch SMS link");
    } finally {
      setLoading(false);
    }
  };

  // Open Direct Razorpay Checkout Modal
  const handleOpenRazorpayCheckout = () => {
    if (!order) {
      toast.error("Order details are still loading. Please retry in a few seconds.");
      initiateOrderAndLink();
      return;
    }

    if (!window.Razorpay) {
      toast.error("Razorpay SDK is loading. Please try again.");
      return;
    }

    const options = {
      key: order.key_id,
      amount: order.amount_paise,
      currency: order.currency || "INR",
      name: "LazyMonkeyAI Cloud Platform",
      description: `Subscription: ${tenantName} (${tenureValue} ${tenureUnit.toUpperCase()}) - ${invNum}`,
      order_id: order.order_id,
      prefill: {
        name: customerName,
        email: customerEmail,
        contact: mobile || undefined,
      },
      theme: {
        color: "#9333ea",
      },
      modal: {
        ondismiss: function () {
          toast.info("Razorpay window closed.");
        },
      },
      handler: async function (response: any) {
        setIsVerifying(true);
        const token = getAuthToken();
        try {
          const verifyRes = await fetch(`${API_BASE_URL}/system/tenants/${tenantId}/subscription/razorpay/verify`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              tenure_value: tenureValue,
              tenure_unit: tenureUnit,
              billing_amount: amount,
              currency,
              tax_rate: taxRate,
              plan,
            }),
          });

          const verifiedData = await verifyRes.json().catch(() => ({}));
          if (!verifyRes.ok) throw new Error(verifiedData.detail || "Signature verification failed.");

          toast.success("Payment verified! Subscription active.");
          setIsPaid(true);
          onSuccess(verifiedData);
          onClose();
        } catch (vErr: any) {
          toast.error(vErr.message || "Payment verification failed.");
        } finally {
          setIsVerifying(false);
        }
      },
    };

    const rzpInstance = new window.Razorpay(options);
    rzpInstance.on("payment.failed", function (resp: any) {
      toast.error(`Payment failed: ${resp.error?.description || "Transaction declined"}`);
    });
    rzpInstance.open();
  };

  // WhatsApp Share Helper
  const handleShareWhatsApp = () => {
    const cleanPhone = (mobile || "").replace(/[^0-9]/g, "");
    const linkToShare = paymentLink || `https://rzp.io/i/sub_${tenantId.slice(0, 6)}`;
    const text = encodeURIComponent(
      `Hello ${customerName}! Your LazyMonkeyAI Cloud Workspace (${tenantName}) subscription invoice #${invNum} for INR ${totalPayable.toLocaleString(undefined, { minimumFractionDigits: 2 })} is ready.\n\nPay securely here: ${linkToShare}\n\nIncludes 24x7 SLA Guarantee, AI Copilot & All Enterprise Modules.`
    );
    window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${text}`, "_blank");
  };

  const copyPaymentLink = async () => {
    if (!paymentLink) return;
    try {
      await navigator.clipboard.writeText(paymentLink);
      setCopied(true);
      toast.success("Payment link copied to clipboard!");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  if (!isOpen) return null;

  // Generate UPI QR Code SVG
  const upiIntent = paymentLink || (order ? `upi://pay?pa=lazymonkey.pay@icici&pn=LazyMonkeyAI&am=${totalPayable.toFixed(2)}&cu=INR&tn=SUB-${tenantId.slice(0, 6)}` : "");
  const qrSvg = upiIntent ? generateQRCodeSVG(upiIntent, 230) : null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-lg rounded-2xl bg-card border border-purple-500/30 p-5 sm:p-6 shadow-2xl relative overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-md">
                <Zap className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-1.5">
                  Razorpay Multi-Channel Payment Suite
                </h3>
                <p className="text-xs text-muted-foreground">
                  Workspace: <strong className="text-foreground">{tenantName}</strong> ({tenureValue} {tenureUnit.toUpperCase()})
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Amount Badge */}
          <div className="my-3.5 p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider block">Total Payable (incl. {taxRate}% GST)</span>
              <span className="text-xl font-extrabold font-mono text-purple-700 dark:text-purple-300">
                {currency} {totalPayable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-purple-600 text-white shadow-xs">
              {invNum}
            </span>
          </div>

          {/* Mode Selector Tabs */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-muted/60 rounded-xl mb-4 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab("qr")}
              className={cn(
                "py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                activeTab === "qr" ? "bg-card text-purple-600 dark:text-purple-300 shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <QrCode className="w-4 h-4" /> Dynamic UPI QR
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("sms")}
              className={cn(
                "py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                activeTab === "sms" ? "bg-card text-purple-600 dark:text-purple-300 shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Smartphone className="w-4 h-4" /> SMS & WhatsApp
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("card")}
              className={cn(
                "py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                activeTab === "card" ? "bg-card text-purple-600 dark:text-purple-300 shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <CreditCard className="w-4 h-4" /> Card Checkout
            </button>
          </div>

          {/* TAB 1: DYNAMIC UPI QR */}
          {activeTab === "qr" && (
            <div className="space-y-3.5 text-center py-1">
              <div className="flex flex-col items-center justify-center">
                {loading ? (
                  <div className="size-52 rounded-xl bg-muted/40 border border-border flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-7 h-7 text-purple-600 animate-spin" />
                    <span className="text-xs text-muted-foreground font-medium">Generating Secure UPI QR…</span>
                  </div>
                ) : qrSvg ? (
                  <div className="p-3 bg-white rounded-2xl shadow-lg border border-purple-200 dark:border-purple-800">
                    <div
                      className="size-48 flex items-center justify-center"
                      dangerouslySetInnerHTML={{ __html: qrSvg }}
                    />
                  </div>
                ) : (
                  <div className="size-52 rounded-xl bg-muted/30 border border-border flex flex-col items-center justify-center p-3 text-xs text-muted-foreground">
                    <AlertCircle className="w-6 h-6 text-amber-500 mb-1" />
                    QR ready upon gateway connection. Use Card or SMS Link tab.
                  </div>
                )}
              </div>

              <div className="text-xs text-muted-foreground">
                Scan with any UPI App: <strong className="text-foreground">GPay, PhonePe, Paytm, BHIM, Cred</strong>
              </div>

              {paymentLink && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    readOnly
                    value={paymentLink}
                    className="flex-1 px-3 py-1.5 text-xs bg-muted/50 border border-border rounded-lg text-foreground font-mono truncate outline-none"
                  />
                  <Button size="sm" variant="outline" onClick={copyPaymentLink} className="h-8 text-xs shrink-0">
                    {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SMS & WHATSAPP LINK */}
          {activeTab === "sms" && (
            <div className="space-y-4 py-1 text-xs">
              <div className="space-y-1.5">
                <label className="block text-muted-foreground font-semibold">Client Mobile Number (with Country Code) *</label>
                <div className="flex items-center gap-2">
                  <input
                    type="tel"
                    placeholder="e.g. +91 9876543210"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-foreground font-mono text-sm focus:ring-2 focus:ring-purple-500/20 outline-none"
                  />
                  <Button
                    onClick={handleSendSMS}
                    disabled={loading}
                    className="bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs h-9.5 px-3.5 shrink-0 flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {loading ? "Sending..." : "Dispatch SMS"}
                  </Button>
                </div>
              </div>

              {paymentLink ? (
                <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 space-y-2">
                  <span className="text-[11px] font-bold text-purple-900 dark:text-purple-300 block">
                    ✓ Official Payment Link Live
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={paymentLink}
                      className="flex-1 px-2.5 py-1.5 bg-background border border-border rounded-lg text-foreground font-mono text-[11px] truncate outline-none"
                    />
                    <Button size="sm" variant="outline" onClick={copyPaymentLink} className="h-7 text-xs shrink-0">
                      {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={handleShareWhatsApp}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> Share on WhatsApp
                    </Button>
                    <a
                      href={paymentLink}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-lg border border-border bg-card text-foreground hover:bg-muted text-xs font-semibold flex items-center gap-1 shrink-0"
                    >
                      <ExternalLink className="w-3 h-3" /> Open Link
                    </a>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-muted/30 border border-border text-center text-muted-foreground">
                  Enter mobile number above and click <strong>Dispatch SMS</strong> to send instant Razorpay link.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CARD & ONLINE CHECKOUT */}
          {activeTab === "card" && (
            <div className="space-y-4 py-2 text-center text-xs">
              <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/30 space-y-2">
                <CreditCard className="w-8 h-8 text-purple-600 mx-auto" />
                <h4 className="font-bold text-foreground text-sm">Direct Online Razorpay Checkout</h4>
                <p className="text-muted-foreground">
                  Pay via Corporate Cards, NetBanking, EMI, or Wallets directly in this window.
                </p>
                <div className="pt-2">
                  <Button
                    onClick={handleOpenRazorpayCheckout}
                    disabled={loading || isVerifying}
                    className="w-full h-10 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md flex items-center justify-center gap-2"
                  >
                    {isVerifying ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Verifying Signature…
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 text-amber-300" /> Open Razorpay Checkout Modal
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-3.5 border-t border-border mt-3">
            <Button variant="ghost" onClick={onClose} className="text-muted-foreground text-xs">
              Close
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
