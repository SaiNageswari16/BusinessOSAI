# Walkthrough of Accounting & Finance Interactive Features

## Completed Features 🚀

### 1. General Ledger & Chart of Accounts
- **Modal Account Creator**: Clicking **"+ Add Account"** now opens a fully interactive modal. 
  - Allows configuration of code, name, account type (Asset, Liability, Equity, Income, Expense), account sub-type, opening balances (in INR), and descriptions.
  - Submitting makes a POST request to `/accounting/accounts` to save the record in PostgreSQL.
- **Dynamic Ledger View**: All accounts are dynamically loaded and filtered from the live database.

### 2. Journal Entry Creator with Auto-balancing Checks
- **Modal Entry Creator**: Clicking **"+ New Entry"** opens a ledger posting dialog.
  - Users can enter dates, references, descriptions, and dynamically add/remove debit/credit lines.
  - **Live Auto-balancing Check**: Real-time validation checking if total debits match total credits (in INR). The submit button is locked unless the entry is fully balanced.
  - Submitting creates the journal entry draft in the database. Clicking **"Post"** confirms and registers the balances.

### 3. Bank Account Creator
- **Modal Bank Account Creator**: Clicking **"+ Add Bank Account"** launches a bank credentials modal.
  - Users can input account name, bank name, account number, IFSC code, branch, account type, and **link it directly to a live Chart of Accounts Asset ledger**.
- **Master-Detail Account List**: Clicking any bank card dynamically loads its real-time transaction history from the backend.

### 4. Receivables & Payments Received
- **Invoice Creator**: Clicking **"+ New Invoice"** launches a dynamic invoice builder.
  - Auto-calculates tax rates (CGST, SGST, IGST) per invoice item.
- **Record Payment Workflow**: Every unpaid or partially paid invoice displays a **"Record Pay"** button. This opens a modal where users can record customer receipt amounts, automatically updating the invoice outstanding balance.

### 5. Payables & Vendor Liabilities
- **Vendor Bill Builder**: Clicking **"+ Add Bill"** adds vendor bills to the ledger liability trackers.
- **Pay Bill Workflow**: Clicking **"Pay Bill"** on any outstanding record launches a checkout modal to settle vendor accounts.

### 6. Fixed Assets & Depreciation Schedule
- **Capital Asset Register**: Clicking **"+ Add Asset"** opens a modal to register company assets.
  - Allows choosing Straight Line Method (SLM) or Written Down Value (WDV) depreciation rules.
  - Dynamically calculates annual and monthly accumulated depreciation schedule tables.
