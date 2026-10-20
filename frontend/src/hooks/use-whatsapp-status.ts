import { useState, useEffect, useCallback, useRef } from "react";
import { whatsappAutomationApi, posApi } from "@/lib/api-client";
import { useTenant } from "@/contexts/tenant-context";

export type WhatsAppConnectionStatus = "online" | "connecting" | "qr_ready" | "offline" | "unlinked";

export interface WhatsAppSessionInfo {
  status: string;
  qr: string | null;
  info: any | null;
  owner_name: string;
}

export interface UseWhatsAppStatusResult {
  status: WhatsAppConnectionStatus;
  isOnline: boolean;
  sessionId: string | null;
  sessionInfo: WhatsAppSessionInfo | null;
  allSessions: Record<string, WhatsAppSessionInfo>;
  loading: boolean;
  lastChecked: Date | null;
  refresh: () => Promise<void>;
}

export function useWhatsAppStatus(pollIntervalMs?: number): UseWhatsAppStatusResult {
  const { tenant } = useTenant();
  const [status, setStatus] = useState<WhatsAppConnectionStatus>("offline");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionInfo, setSessionInfo] = useState<WhatsAppSessionInfo | null>(null);
  const [allSessions, setAllSessions] = useState<Record<string, WhatsAppSessionInfo>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const isMountedRef = useRef(true);

  const checkStatus = useCallback(async () => {
    if (!tenant?.id) return;
    try {
      setLoading(true);

      // 1. Try fetching detailed sessions from whatsapp-automation
      let sessionsMap: Record<string, WhatsAppSessionInfo> = {};
      try {
        const res = await whatsappAutomationApi.getSessions();
        if (res && typeof res === "object") {
          sessionsMap = res;
        }
      } catch (err) {
        // Fallback to POS status endpoint if whatsappAutomationApi fails
        try {
          const posRes = await posApi.getWhatsAppStatus();
          if (posRes?.available && posRes?.session_id) {
            if (!isMountedRef.current) return;
            setStatus("online");
            setSessionId(posRes.session_id);
            setSessionInfo({
              status: "CONNECTED",
              qr: null,
              info: null,
              owner_name: "Primary POS Gateway",
            });
            setLastChecked(new Date());
            setLoading(false);
            return;
          }
        } catch (_) {}
      }

      if (!isMountedRef.current) return;

      setAllSessions(sessionsMap);
      const sessionKeys = Object.keys(sessionsMap);

      if (sessionKeys.length === 0) {
        setStatus("unlinked");
        setSessionId(null);
        setSessionInfo(null);
      } else {
        // Find connected session first
        const connectedId = sessionKeys.find((id) => sessionsMap[id]?.status === "CONNECTED");
        const qrId = sessionKeys.find((id) => sessionsMap[id]?.status === "QR_READY");
        const initId = sessionKeys.find((id) => sessionsMap[id]?.status === "INITIALIZING");

        if (connectedId) {
          setStatus("online");
          setSessionId(connectedId);
          setSessionInfo(sessionsMap[connectedId]);
        } else if (qrId) {
          setStatus("qr_ready");
          setSessionId(qrId);
          setSessionInfo(sessionsMap[qrId]);
        } else if (initId) {
          setStatus("connecting");
          setSessionId(initId);
          setSessionInfo(sessionsMap[initId]);
        } else {
          setStatus("offline");
          const firstId = sessionKeys[0];
          setSessionId(firstId);
          setSessionInfo(sessionsMap[firstId]);
        }
      }

      setLastChecked(new Date());
    } catch (error) {
      if (!isMountedRef.current) return;
      console.warn("[useWhatsAppStatus] Error checking WhatsApp status:", error);
      setStatus("offline");
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [tenant?.id]);

  useEffect(() => {
    isMountedRef.current = true;
    void checkStatus();

    // Adaptive polling: faster if connecting or QR ready, standard 25s otherwise
    const intervalTime = pollIntervalMs ?? (status === "connecting" || status === "qr_ready" ? 5000 : 25000);
    const interval = setInterval(() => {
      void checkStatus();
    }, intervalTime);

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
    };
  }, [checkStatus, pollIntervalMs, status]);

  return {
    status,
    isOnline: status === "online",
    sessionId,
    sessionInfo,
    allSessions,
    loading,
    lastChecked,
    refresh: checkStatus,
  };
}
