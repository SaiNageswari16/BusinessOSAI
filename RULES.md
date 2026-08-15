# BusinessOSAI - Coding Rules & Guidelines

These rules ensure consistency across the codebase. All code should follow these conventions.

---

## Frontend Rules

### 1. Language & Type Safety
- All code must be **TypeScript** (no `.js` files in `src/`)
- Use strict TypeScript (`strict: true` in tsconfig)
- Define interfaces/types for all data structures
- Avoid `any` type — use `unknown` and narrow with type guards
- Use Zod schemas for form validation (matching backend Pydantic schemas)

### 2. Component Structure
```
- Filename: PascalCase (e.g., `WhatsappCampaigns.tsx`)
- Component: PascalCase export (e.g., `export function WhatsappCampaigns()`)
- Props: Use interfaces, prefix with the component name for clarity
- Sub-components: Define within the same file if < 200 lines
- Separate file for reusable sub-components > 100 lines

Example:
interface WhatsappCampaignsProps {
  tenantId: string;
  userId: string;
}

export function WhatsappCampaigns({ tenantId, userId }: WhatsappCampaignsProps) {
  // ...
}
```

### 3. API Calls
- **ALWAYS** use `lib/api-client.ts` — never direct `fetch()`
- Import from: `import { crmApi, whatsappAutomationApi, authApi } from "@/lib/api-client"`
- The api-client auto-injects auth tokens and handles error parsing
- For new endpoints, add to the api-client first, then use in components

### 4. State Management
- **Auth**: Use `AuthContext` (from `lib/auth-context.tsx`) — never manage auth state locally
- **Local UI state**: `useState` (loading, modals, selections)
- **Server state**: React Query is NOT used — re-fetch on mount/focus as needed
- **Complex state**: `useReducer` for multi-field forms
- **Form state**: React Hook Form (`useForm` + `zodResolver`)

### 5. Styling Rules
- Use **Tailwind CSS utility classes** — no CSS modules, no styled-components
- Use **Shadcn UI** components for: buttons, cards, dialogs, forms, tables, toasts
- Consistent color palette:
  - Primary brand: `#00a884` (WhatsApp green)
  - Success: `#22c55e`
  - Warning: `#f59e0b`
  - Error: `#ef4444`
  - Background: `bg-white`, `bg-slate-50`, `bg-slate-100`
  - Text: `text-slate-900`, `text-slate-600`, `text-slate-400`
- Spacing: Use Tailwind defaults (4px grid: p-1, p-2, p-3, p-4, p-6, p-8)
- Border radius: `rounded-lg` (8px) for cards, `rounded-xl` (12px) for inputs
- Shadows: `shadow-sm` for cards, `shadow-md` for elevated elements
- Responsive: Always include `md:` and `lg:` variants for layout

### 6. Form Patterns
```tsx
// Standard form pattern:
const form = useForm({
  resolver: zodResolver(schema),
  defaultValues: { ... }
});

// Submit:
const onSubmit = async (data: FormValues) => {
  setLoading(true);
  try {
    await crmApi.createLead(data);
    toast.success("Created successfully");
  } catch (e) {
    toast.error("Failed to create");
  } finally {
    setLoading(false);
  }
};

// Render:
<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)}>
    <FormField control={form.control} name="field" render={({ field }) => (
      <FormItem>
        <FormLabel>Label</FormLabel>
        <FormControl><Input {...field} /></FormControl>
        <FormMessage />
      </FormItem>
    )} />
    <Button type="submit" disabled={loading}>Submit</Button>
  </form>
</Form>
```

### 7. Conditional Rendering
- Use ternary for 2 states: `{condition ? <A /> : <B />}`
- Use `&&` for optional rendering: `{items.length > 0 && <List items={items} />}`
- Use early returns for loading/empty states:
```tsx
if (loading) return <LoadingSkeleton />;
if (error) return <ErrorMessage error={error} />;
if (!data) return <EmptyState />;
// Main render below
```

### 8. Animation Patterns
- Use Framer Motion (`motion.div`, `AnimatePresence`)
- Standard transitions: `initial={{ opacity: 0, y: 10 }}` → `animate={{ opacity: 1, y: 0 }}`
- Modals: `initial={{ opacity: 0, scale: 0.95 }}` → `animate={{ opacity: 1, scale: 1 }}`
- List items: Stagger with `transition={{ staggerChildren: 0.05 }}`
- Page transitions: Use `AnimatePresence` with `mode="wait"`

### 9. Icon Usage
- Always use **Lucide React** icons
- Import: `import { IconName } from "lucide-react"`
- Size: `size-4` (16px) default, `size-3` (12px) for compact, `size-5` (20px) for larger
- Color: Inherit text color or specify `text-{color}`

### 10. Error Handling
- API errors: Show toast notification with `toast.error(message)`
- Network errors: Show "Connection issue" message with retry button
- Validation errors: Display next to form fields via `FormMessage`
- Use error boundaries for page-level errors (where implemented)

---

## Backend Rules

### 1. Language & Style
- **Python 3.11+** with type hints on ALL function signatures
- Follow **PEP 8** (4-space indentation, max line length ~100)
- Use **async/await** for all I/O operations (database, HTTP, file)
- Use **Pydantic v2** for request/response validation
- Use **SQLAlchemy 2.x** async ORM

### 2. Router Pattern
```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/module-name", tags=["Module Name"])

@router.get("/items")
async def get_items(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:module"))],
    db: AsyncSession = Depends(get_db)
):
    # Implementation
    pass
```

### 3. Permission Pattern
- Every endpoint needs a permission check: `Depends(require_permission("action:resource"))`
- Standard permissions:
  - `view:crm_leads` — Read access
  - `manage:crm_leads` — Create/Update/Delete
  - `view:erp_invoices` — Read invoices
  - `manage:erp_invoices` — Manage invoices
  - `admin:*` — Full admin access (tenant_owner only)

### 4. Database Pattern
```python
# Query
stmt = select(Model).where(
    Model.tenant_id == ctx.tenant_id,
    Model.field == value
)
result = await db.execute(stmt)
items = result.scalars().all()

# Create
item = Model(tenant_id=ctx.tenant_id, field=value)
db.add(item)
await db.commit()
await db.refresh(item)

# Update
stmt = update(Model).where(Model.id == id).values(field=new_value)
await db.execute(stmt)
await db.commit()

# JSON field update (Tenant.settings)
settings = dict(tenant.settings or {})
settings["key"] = value
tenant.settings = settings
flag_modified(tenant, "settings")
await db.commit()
```

### 5. Error Handling
```python
# Not found
if not item:
    raise HTTPException(status_code=404, detail="Item not found")

# Validation
if not payload.field:
    raise HTTPException(status_code=400, detail="Field is required")

# Permission (automatic via decorator)
# External service
try:
    async with _gateway_client() as client:
        resp = await client.get(f"{URL}/endpoint", timeout=10.0)
        return resp.json()
except Exception as e:
    raise HTTPException(status_code=502, detail=f"Service error: {e}")
```

### 6. Tenant Isolation
- **ALWAYS** filter by `tenant_id = ctx.tenant_id`
- Never return data from other tenants
- Never allow cross-tenant operations
- File paths include tenant ID: `tenant/{tenant_id}/{filename}`

### 7. Logging
```python
logger.info(f"Action completed: {detail}")      # Normal operations
logger.warning(f"Unexpected condition: {detail}")  # Recoverable issues
logger.error(f"Failed: {detail}")               # Errors needing attention
```

### 8. Model Definition Pattern
```python
class ModelName(Base):
    __tablename__ = "table_name"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    # ... fields ...

    # Relationships
    tenant = relationship("Tenant", back_populates="models")
```

---

## WhatsApp Gateway Rules

### 1. Phone Number Handling
- **Always** clean phone numbers: `cleanDigits(id)` → strips non-digits
- Store as digits-only in DB (no `+`, no spaces)
- Compare with cleaned values only
- JID format: `{digits}@c.us` for regular, `{digits}@lid` for LID accounts

### 2. Session States
```
INITIALIZING → QR_READY → AUTHENTICATED → CONNECTED
                                    ↓
                              DISCONNECTED (on logout/error)
```

### 3. Media Handling (NEW)
- Supported: `image/*` (jpeg, png, gif, webp) and `application/pdf`
- Build: `new MessageMedia(mimeType, base64Data, fileName)`
- Send options: `{ caption: "optional caption" }` (WhatsApp caption support)
- Backend validates mimeType prefix before proxying to gateway
- No storage of media in DB — sent directly through WhatsApp

### 4. Webhook Pattern
- Gateway POSTs to FastAPI `/whatsapp-automation/webhook`
- FastAPI creates Lead (if new) + LeadActivity
- Frontend polls `/get-chat-messages` for display
- Consider WebSocket for real-time updates (future enhancement)

---

## Shared Rules

### 1. API Versioning
- All backend routes under `/api/v1/`
- Breaking changes → create `/api/v2/`
- Never change existing endpoint behavior

### 2. Naming Conventions
| Type | Frontend | Backend |
|------|----------|---------|
| Files | PascalCase (`.tsx`, `.ts`) | snake_case (`.py`) |
| Components | PascalCase | Classes: PascalCase |
| Functions | camelCase | snake_case |
| Variables | camelCase | snake_case |
| Constants | UPPER_SNAKE_CASE | UPPER_SNAKE_CASE |
| Types/Interfaces | PascalCase | Typed via annotations |
| DB Tables | — | snake_case (plural) |
| DB Columns | — | snake_case |

### 3. ID Format
- All IDs: UUID v4 (string representation)
- Never expose internal IDs in URLs without validation
- Frontend: store as string, pass as-is

### 4. Date/Time
- **Backend**: All timestamps in UTC, store as `datetime` in PostgreSQL
- **Frontend**: Display in user's local timezone
- Format: `formatDate(date)` → "Jan 15, 2025", `formatDateTime(date)` → "Jan 15, 2025 3:45 PM"
- Timestamps in API responses: Unix timestamp (seconds)

### 5. Currency
- All amounts: Decimal (Python `Decimal`, JS `number`)
- Currency: Always include currency code (USD, INR, EUR, etc.)
- Display: Use `formatCurrency(amount, currency)` utility
- Never hardcode currency symbols

### 6. Pagination
- Default page size: 20 items
- Max page size: 100 items
- Cursor-based for large datasets (Leads, Messages)
- Offset-based for smaller datasets (Tasks, Notes)

### 7. Security Rules
- Never log secrets, API keys, or tokens
- Always validate input with Pydantic (backend) / Zod (frontend)
- SQL injection: Use parameterized queries (SQLAlchemy handles this)
- XSS: React auto-escapes — never use `dangerouslySetInnerHTML`
- CORS: Backend allows frontend origin only
- Rate limiting: 100 req/min per user (Redis-based)

### 8. Testing Requirements
- Backend: pytest for new endpoints
- Frontend: No enforced testing (manual QA for now)
- Integration tests for critical flows (auth, payments)

---

## File Organization Rules

### Frontend
```
src/
├── app/                          # Pages (route = folder structure)
├── components/                   # Reusable components
│   ├── ui/                       # Shadcn components (never modify directly)
│   ├── {module}/                 # Module-specific components
│   └── layout/                   # Shell components (Sidebar, TopBar)
├── lib/                          # Utilities, API client, auth
├── hooks/                        # Custom React hooks
├── contexts/                     # React contexts
├── types/                        # TypeScript declarations
└── styles/                       # Global CSS (minimal)
```

### Backend
```
src/
├── api/v1/                       # Route handlers
│   ├── {module}.py               # Module router
│   ├── {module}_modules/         # Sub-modules
│   └── deps.py                   # Shared dependencies
├── models/                       # SQLAlchemy ORM models
├── schemas/                      # Pydantic schemas
├── services/                     # Business logic
├── database/                     # DB configuration
├── core/                         # Config, security, logging
├── main.py                       # App entry point
└── .env                          # Environment config (gitignored)
```

### When Adding a New Feature
1. **Backend first**: Create model → Pydantic schema → API route → test with curl
2. **API client**: Add method to `lib/api-client.ts` with proper types
3. **Frontend**: Create component → use api-client method → style with Tailwind
4. **Document**: Update SKILLS.md with the new feature

---

## Git Workflow

### Branch Naming
- `feature/description` — New features
- `fix/description` — Bug fixes
- `refactor/description` — Code refactoring
- `hotfix/description` — Urgent production fixes

### Commit Messages
```
type(scope): description

feat(crm): add lead scoring automation
fix(whatsapp): resolve LID phone number mapping
refactor(auth): migrate to Supabase Auth
docs(architecture): add WhatsApp media support section
```

### What Goes Where
- `main` → Production-ready code
- `Backend` → Backend development branch
- Feature branches → From `Backend` or `main`
