# WhatsApp Invoice Auto-Send + Template Integration — Implementation Plan

## What's Already Working
- Auto-send triggers on: `create_invoice` (paid), `approve_invoice`, `add_payment`
- Background tasks handle the actual sending (no blocking)
- PDF generation works via `render_invoice_pdf()` in `invoice_pdf.py`
- WhatsApp gateway dispatch works via `send_invoice_whatsapp()` in `whatsapp_invoice_sender.py`
- Import error (`Lead`/`LeadActivity` from wrong module) is fixed

## What's Missing
The PDF currently renders with a **hardcoded style** — it ignores the organization's selected print template from `DocumentTemplate`. The user wants the PDF sent via WhatsApp to match the active template they configured in Print Templates.

---

## Changes Required (3 files)

### 1. `backend/src/services/invoice_pdf.py` — Make renderer template-aware

**Current**: `render_invoice_pdf(invoice)` — hardcoded colors, fonts, layout
**Change**: Add optional `template` parameter:

```python
def render_invoice_pdf(invoice, template=None) -> bytes:
    """Render invoice PDF. Uses template styling if provided, else fallback."""
    # If template has themeName, apply its colors/fonts/fields
    # If template has template_content (HTML), render via fpdf2 text rendering
    # Otherwise keep current hardcoded style
```

Also add helper:
```python
async def get_active_invoice_template(db, tenant_id) -> DocumentTemplate | None:
    """Query the DB for the tenant's default invoice template."""
    result = await db.execute(
        select(DocumentTemplate).where(
            DocumentTemplate.tenant_id == tenant_id,
            DocumentTemplate.document_type == "invoice",
            DocumentTemplate.is_default == True,
        )
    )
    return result.scalar_one_or_none()
```

**Template → PDF mapping**:
| Template field | PDF effect |
|---------------|-----------|
| `primaryColor` | Header bar color |
| `fontFamily` | Font family (map to closest fpdf font) |
| `headerTitle` | "TAX INVOICE" text |
| `storeName` | Company name in header |
| `storeAddress` | Address block |
| `storePhone` | Phone in header |
| `gstin` | GSTIN display |
| `footerText` | Footer text |
| `termsText` | Terms & conditions |
| `bankDetails` | Bank details block |
| `fields.showLogo` | Show/hide logo placeholder |
| `fields.showHSN` | Show/hide HSN column |
| `fields.showTaxSplit` | Show/hide CGST/SGST/IGST breakdown |
| `fields.showBankDetails` | Show/hide bank details |
| `fields.showSignature` | Show/hide signature line |
| `fields.showCustomerDetails` | Show/hide bill-to block |
| `fields.showTime` | Show/hide timestamp |
| `themeName` | Theme preset (stylish, luxury, tally, etc.) |

### 2. `backend/src/services/whatsapp_invoice_sender.py` — Use template when sending

In `send_invoice_whatsapp()`, before generating PDF:

```python
# Get tenant's active invoice template
from src.services.invoice_pdf import get_active_invoice_template
template = await get_active_invoice_template(db, invoice.tenant_id)

# Generate PDF with template styling
pdf_b64 = render_invoice_pdf_b64(invoice, template=template)
```

### 3. `backend/src/api/v1/erp/workflow.py` — Expose active template endpoint

Add a new endpoint so frontend can also fetch the active template:

```
GET /erp/workflows/document-templates/active/invoice
```
Returns the default `DocumentTemplate` for `document_type=invoice` for the current tenant.

---

## What This Does NOT Change
- PrintTemplates.tsx frontend component (stays as-is for now)
- Existing API endpoints
- The 3 auto-trigger points (create, approve, payment)
- The BackgroundTasks pattern

## Risk Assessment
- **Low risk**: The template parameter is optional — if no template exists, current hardcoded style is used (no breaking change)
- **Medium effort**: Need to map template fields to fpdf2 drawing calls (~150 lines of new code)
- **Testing**: Create an invoice with a custom template set → verify PDF reflects it
