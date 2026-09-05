import asyncio
import hashlib
import logging
import time
from typing import Any, Dict, Optional
import httpx

logger = logging.getLogger(__name__)


class PineLabsService:
    """
    Pine Labs Handheld POS / EDC Card Machine Service.
    Supports Plutus Cloud API and Local IP Bridge for EMV Chip Card Swipes,
    Contactless NFC Tap, Dynamic BharatQR on EDC Screen, RRN Tracking, and Batch Settlements.
    Enforces strict real-time hardware communication without mock simulations.
    """

    def __init__(
        self,
        merchant_id: str = "MID-PINELABS-01",
        security_token: str = "",
        base_url: str = "https://plutus.pinelabs.com/api",
        terminal_id: str = "TID-882194",
        ip_address: Optional[str] = None,
        port: int = 8082,
        is_test_mode: bool = False,
    ):
        self.merchant_id = (merchant_id or "").strip()
        self.security_token = (security_token or "").strip()
        self.base_url = (base_url or "https://plutus.pinelabs.com/api").rstrip("/")
        self.terminal_id = (terminal_id or "").strip()
        self.ip_address = (ip_address or "").strip()
        self.port = port
        self.is_test_mode = is_test_mode

    async def test_connection(self) -> Dict[str, Any]:
        """
        Validates Pine Labs Terminal connectivity via real-time network handshake.
        Probes the configured LAN IP bridge or Plutus Cloud endpoint.
        """
        if not self.ip_address and not self.security_token:
            return {
                "success": False,
                "message": f"Pine Labs configuration incomplete: Please provide either the EDC Local IP Address (e.g., 192.168.1.150) or Plutus Cloud Security Token for Terminal {self.terminal_id or 'TID'}.",
                "terminal_id": self.terminal_id,
                "mode": "live",
            }

        target_url = (
            f"http://{self.ip_address}:{self.port}/api/v1/ping"
            if self.ip_address
            else f"{self.base_url}/terminal/{self.terminal_id}/health"
        )

        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                res = await client.get(
                    target_url,
                    headers={
                        "X-Merchant-Id": self.merchant_id,
                        "X-Security-Token": self.security_token,
                        "X-Terminal-Id": self.terminal_id,
                    },
                )
                if res.status_code in (200, 204):
                    return {
                        "success": True,
                        "message": f"Connected to Pine Labs Handheld EDC Terminal ({self.terminal_id}) at {self.ip_address or self.base_url}:{self.port}. Ready for live transactions.",
                        "terminal_id": self.terminal_id,
                        "mode": "live",
                    }
                else:
                    return {
                        "success": False,
                        "message": f"Pine Labs EDC responded with HTTP {res.status_code}: {res.text[:200]}",
                        "terminal_id": self.terminal_id,
                        "mode": "live",
                    }
        except httpx.ConnectError:
            return {
                "success": False,
                "message": f"Connection refused: Unable to connect to Pine Labs EDC at {self.ip_address}:{self.port}. Ensure the machine is powered on, connected to the same Wi-Fi/LAN, and the EDC Bridge service is running.",
                "terminal_id": self.terminal_id,
                "mode": "live",
            }
        except httpx.TimeoutException:
            return {
                "success": False,
                "message": f"Connection timed out after 6 seconds while reaching Pine Labs EDC at {self.ip_address}:{self.port}. Please check network routing or IP address.",
                "terminal_id": self.terminal_id,
                "mode": "live",
            }
        except Exception as exc:
            logger.error("Pine Labs live test_connection error: %s", exc)
            return {
                "success": False,
                "message": f"Failed to connect to Pine Labs EDC ({self.terminal_id}): {str(exc)}",
                "terminal_id": self.terminal_id,
                "mode": "live",
            }

    async def initiate_transaction(
        self,
        amount: float,
        bill_number: str,
        customer_mobile: Optional[str] = None,
        payment_mode: str = "CARD",  # CARD | UPI_QR | TAP_NFC
    ) -> Dict[str, Any]:
        """
        Pushes a live real-time charge request directly to the Pine Labs Handheld EDC Terminal screen.
        Amount in INR.
        """
        amount_paise = int(round(amount * 100))
        sequence_no = int(time.time() * 1000) % 100000000
        txn_id = f"PLTXN_{int(time.time())}_{sequence_no % 10000}"

        payload = {
            "MerchantId": self.merchant_id,
            "SecurityToken": self.security_token,
            "TerminalId": self.terminal_id,
            "TransactionType": 4001,  # 4001 = Standard Sale / Card Charge
            "Amount": amount_paise,
            "BillingRefNo": bill_number,
            "SequenceNumber": sequence_no,
            "PaymentMode": payment_mode,
            "CustomerMobile": customer_mobile or "",
            "TxnId": txn_id,
        }

        target_url = (
            f"http://{self.ip_address}:{self.port}/api/v1/charge"
            if self.ip_address
            else f"{self.base_url}/transactions/charge"
        )

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                res = await client.post(
                    target_url,
                    json=payload,
                    headers={
                        "X-Merchant-Id": self.merchant_id,
                        "X-Security-Token": self.security_token,
                        "X-Terminal-Id": self.terminal_id,
                    },
                )
                if res.status_code in (200, 201):
                    data = res.json()
                    is_approved = str(data.get("ResponseCode", "")).strip() in ("00", "0", "APPROVED")
                    return {
                        "status": "APPROVED" if is_approved else "DECLINED",
                        "success": is_approved,
                        "transaction_id": data.get("TxnId", txn_id),
                        "terminal_id": self.terminal_id,
                        "amount": amount,
                        "bill_number": bill_number,
                        "rrn": data.get("RRN", ""),
                        "auth_code": data.get("AuthCode", ""),
                        "card_brand": data.get("CardBrand", "Card"),
                        "card_last4": data.get("CardLast4", ""),
                        "card_type": data.get("CardType", "EMV"),
                        "batch_number": data.get("BatchNo", "B01"),
                        "message": data.get("ResponseMessage", "Transaction completed on EDC"),
                        "response_code": data.get("ResponseCode", "00" if is_approved else "99"),
                    }
                else:
                    return {
                        "status": "FAILED",
                        "success": False,
                        "message": f"Pine Labs EDC responded with HTTP {res.status_code}: {res.text[:200]}",
                    }
        except httpx.ConnectError:
            return {
                "status": "FAILED",
                "success": False,
                "message": f"Connection refused: Unable to connect to Pine Labs EDC at {self.ip_address}:{self.port}. Ensure the machine is powered on and connected to the same network.",
            }
        except httpx.TimeoutException:
            return {
                "status": "FAILED",
                "success": False,
                "message": f"Transaction timed out waiting for Pine Labs EDC terminal at {self.ip_address}:{self.port}.",
            }
        except Exception as exc:
            logger.error("Pine Labs live charge failed: %s", exc)
            return {
                "status": "FAILED",
                "success": False,
                "message": f"Failed to communicate with Handheld EDC Terminal ({self.terminal_id}): {str(exc)}",
            }

    async def cancel_transaction(self, transaction_id: str) -> Dict[str, Any]:
        """Cancels an ongoing waiting prompt on the Pine Labs Handheld terminal."""
        target_url = (
            f"http://{self.ip_address}:{self.port}/api/v1/cancel"
            if self.ip_address
            else f"{self.base_url}/transactions/cancel"
        )
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(
                    target_url,
                    json={"TransactionId": transaction_id, "TerminalId": self.terminal_id},
                    headers={"X-Merchant-Id": self.merchant_id, "X-Security-Token": self.security_token},
                )
                return {
                    "success": res.status_code in (200, 204),
                    "transaction_id": transaction_id,
                    "terminal_id": self.terminal_id,
                    "message": f"Cancel request dispatched to EDC Terminal ({self.terminal_id}).",
                }
        except Exception as exc:
            return {
                "success": False,
                "transaction_id": transaction_id,
                "terminal_id": self.terminal_id,
                "message": f"Failed to cancel EDC transaction: {str(exc)}",
            }

    async def void_transaction(self, rrn: str, amount: float) -> Dict[str, Any]:
        """Voids a previous EDC charge by RRN."""
        target_url = (
            f"http://{self.ip_address}:{self.port}/api/v1/void"
            if self.ip_address
            else f"{self.base_url}/transactions/void"
        )
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(
                    target_url,
                    json={"RRN": rrn, "Amount": int(round(amount * 100)), "TerminalId": self.terminal_id},
                    headers={"X-Merchant-Id": self.merchant_id, "X-Security-Token": self.security_token},
                )
                return {
                    "success": res.status_code in (200, 204),
                    "rrn": rrn,
                    "amount": amount,
                    "terminal_id": self.terminal_id,
                    "message": f"Void command processed on Pine Labs EDC for RRN {rrn}.",
                }
        except Exception as exc:
            return {
                "success": False,
                "rrn": rrn,
                "amount": amount,
                "terminal_id": self.terminal_id,
                "message": f"Void failed on EDC: {str(exc)}",
            }

    async def settle_batch(self) -> Dict[str, Any]:
        """Performs daily batch settlement / day-end closure on the handheld EDC."""
        target_url = (
            f"http://{self.ip_address}:{self.port}/api/v1/settle"
            if self.ip_address
            else f"{self.base_url}/transactions/settle"
        )
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(
                    target_url,
                    json={"TerminalId": self.terminal_id, "MerchantId": self.merchant_id},
                    headers={"X-Merchant-Id": self.merchant_id, "X-Security-Token": self.security_token},
                )
                return {
                    "success": res.status_code in (200, 204),
                    "terminal_id": self.terminal_id,
                    "merchant_id": self.merchant_id,
                    "settled_at": time.strftime("%Y-%m-%d %H:%M:%S"),
                    "message": f"Day-End Batch Settlement executed for Terminal {self.terminal_id}.",
                }
        except Exception as exc:
            return {
                "success": False,
                "terminal_id": self.terminal_id,
                "merchant_id": self.merchant_id,
                "message": f"Batch settlement failed: {str(exc)}",
            }
