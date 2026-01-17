# REDAN ORDER FORM - EXCEL TABLE STRUCTURE
## Phase-by-Phase Update Guide

---

## 📊 PHASE 1: HEADER SECTION (Copy this to your Excel)

### Location: Rows 1-6

| Row | Column D | Column E (Input) | Column F | Column G (Auto-fill) | Notes |
|-----|----------|------------------|----------|---------------------|-------|
| 1   | **REDAN PETROLEUM** | | | | Merged B1:H1, Bold, Size 18 |
| 2   | **REQUEST VOUCHER** | | | | Merged B2:H2, Bold, Size 14 |
| 3   | | | | | (blank row) |
| 4   | Voucher No: | [1001] | | | User enters or auto-increment |
| 5   | Date: | [=TODAY()] | | | Auto-fills current date |
| 6   | Category: | [DROPDOWN] | | | Dropdown: Uniforms, PPE, Stationery, Consumable, HSSE |

**Category Dropdown Formula:**
```
Data Validation: List
Source: Uniforms,PPE,Stationery,Consumable,HSSE
```

---

## 📊 PHASE 2: SITE INFORMATION (Maps to `sites` table)

### Location: Rows 8-13

| Row | Column D | Column E (Input) | Column F | Column G (Auto-fill) |
|-----|----------|------------------|----------|---------------------|
| 8   | **SITE DETAILS** | | | Merged B8:H8, Bold, Background Color |
| 9   | Site Name: | [DROPDOWN] ← USER SELECTS | Site Code: | [Auto-filled from lookup] |
| 10  | Address: | [Auto-filled] | City: | [Auto-filled] |
| 11  | Fulfillment: | [Auto-filled] | | COLLECTION or DISPATCH |
| 12  | Contact: | [Auto-filled] | Phone: | [Auto-filled] |
| 13  | TM Email: | [Auto-filled] | | |

**Database Mapping:**
```
sites table columns:
- code           → Cell G9
- name           → Cell E9 (dropdown source)
- address        → Cell E10
- city           → Cell G10
- fulfillment_zone → Cell E11 (shows "COLLECTION" or "DISPATCH via courier")
- contact_name   → Cell E12
- phone          → Cell G12
- tm_email       → Cell E13
```

**Site Dropdown Setup:**
1. Create a hidden sheet named "SiteData"
2. Column A: Site ID
3. Column B: Site Name (dropdown source)
4. Column C: Site Code
5. Column D: Address
6. Column E: City
7. Column F: Fulfillment Zone
8. Column G: Contact Name
9. Column H: Phone

**Auto-fill Formulas (when site is selected in E9):**
```excel
Cell G9  = VLOOKUP(E9,SiteData!B:C,2,FALSE)                    ' Site Code
Cell E10 = VLOOKUP(E9,SiteData!B:D,3,FALSE)                    ' Address
Cell G10 = VLOOKUP(E9,SiteData!B:E,4,FALSE)                    ' City
Cell E11 = IF(VLOOKUP(E9,SiteData!B:F,5,FALSE)="COLLECTION","COLLECTION from Head Office","DISPATCH via courier")
Cell E12 = VLOOKUP(E9,SiteData!B:G,6,FALSE)                    ' Contact
Cell G12 = VLOOKUP(E9,SiteData!B:H,7,FALSE)                    ' Phone
```

---

## 📊 PHASE 3: EMPLOYEE SECTION (Maps to `employees` table - ONLY for Uniforms)

### Location: Rows 15-16 (Hidden initially, shown when Category = "Uniforms")

| Row | Column D | Column E (Input) | Column F | Column G (Auto-fill) |
|-----|----------|------------------|----------|---------------------|
| 15  | Employee: | [DROPDOWN] | Employee Code: | [Auto-filled] |
| 16  | Role: | [Auto-filled] | Department: | [Auto-filled] |

**Database Mapping:**
```
employees table columns:
- employee_code  → Cell G15
- first_name + last_name → Cell E15 (dropdown shows "FirstName LastName")
- role           → Cell E16
- site_id        → Filtered by selected site
```

**Conditional Display:**
```excel
Show/Hide Rows 15-16:
IF(E6="Uniforms", SHOW, HIDE)
```

**Employee Dropdown Setup:**
1. In "EmployeeData" sheet:
   - Column A: Employee ID
   - Column B: Full Name (FirstName + " " + LastName)
   - Column C: Employee Code
   - Column D: Role
   - Column E: Site Code (for filtering)

**Dropdown Filter:**
```
Only show employees where Site Code = G9 (selected site)
```

---

## 📊 PHASE 4: ORDER ITEMS GRID (Maps to `order_items` + `items` tables)

### Location: Rows 17-36 (20 rows for items)

**Header Row 16:**
| A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| # | **Item** | **SKU** | **Qty** | **Unit** | **Cost** | **Total** | **Employee** |

**Data Rows 17-36:**
| A | B (Input) | C (Auto) | D (Input) | E (Auto) | F (Auto) | G (Formula) | H (Input-Uniforms) |
|---|-----------|----------|-----------|----------|----------|-------------|-------------------|
| 1 | [DROPDOWN Item] | [SKU] | [Qty] | [Unit] | [Cost] | =D17*F17 | [Employee Name] |
| 2 | [DROPDOWN Item] | [SKU] | [Qty] | [Unit] | [Cost] | =D18*F18 | [Employee Name] |
| ... | ... | ... | ... | ... | ... | ... | ... |
| 20 | [DROPDOWN Item] | [SKU] | [Qty] | [Unit] | [Cost] | =D36*F36 | [Employee Name] |

**Database Mapping:**
```
items table columns:
- product        → Column B (dropdown source)
- sku            → Column C (auto-filled)
- unit           → Column E (auto-filled)
- cost           → Column F (auto-filled)
- category       → (filtered by E6 Category selection)
- requires_employee → If TRUE, Column H is mandatory

order_items table columns:
- item_id        ← Looked up from SKU
- quantity_ordered ← Column D
- unit_cost      ← Column F
- notes          ← "Employee: [Column H]" if Uniforms
```

**Item Dropdown Setup:**
1. In "ItemData" sheet:
   - Column A: Item ID
   - Column B: Product Name (dropdown source)
   - Column C: SKU
   - Column D: Category
   - Column E: Unit
   - Column F: Cost
   - Column G: Requires Employee (TRUE/FALSE)

**Dropdown Filter:**
```
Only show items where Category = E6 (selected category)
```

**Auto-fill Formulas (when item is selected in column B):**
```excel
Column C = VLOOKUP(B17,ItemData!B:C,2,FALSE)  ' SKU
Column E = VLOOKUP(B17,ItemData!B:E,4,FALSE)  ' Unit
Column F = VLOOKUP(B17,ItemData!B:F,5,FALSE)  ' Cost
Column G = D17*F17                            ' Total
```

**Conditional Column H (Employee):**
```excel
Show/Hide Column H:
IF(E6="Uniforms", SHOW, HIDE)

Validation in Column H:
IF(E6="Uniforms" AND D17>0, REQUIRED, OPTIONAL)
```

---

## 📊 PHASE 5: TOTALS SECTION

### Location: Rows 38-39

| Row | Column E | Column F | Column G |
|-----|----------|----------|----------|
| 38  | **Items Count:** | =COUNTA(B17:B36) | |
| 39  | **ORDER TOTAL:** | | =SUM(G17:G36) |

Format G39 as Currency: `$#,##0.00`

---

## 📊 PHASE 6: BUTTONS (Insert → Shapes → Rounded Rectangle)

### Button 1: REFRESH DATA
- **Location:** Cell I4:I6
- **Text:** 🔄 REFRESH DATA
- **Macro:** RefreshData
- **Color:** Blue (RGB: 100, 150, 255)

### Button 2: SUBMIT ORDER
- **Location:** Cell I8:I10
- **Text:** 📤 SUBMIT ORDER
- **Macro:** SubmitOrder
- **Color:** Green (RGB: 0, 150, 50)

### Button 3: CLEAR FORM
- **Location:** Cell I12:I14
- **Text:** 🗑️ CLEAR FORM
- **Macro:** ClearForm
- **Color:** Red (RGB: 200, 100, 100)

---

## 📊 DATA SHEETS (Hidden)

### Sheet: SiteData
| A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| id | name | code | address | city | fulfillment_zone | contact_name | phone |
| 1 | Harare Main | HAR-001 | 123 Main St | Harare | COLLECTION | John Doe | +263... |

### Sheet: ItemData
| A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|
| id | product | sku | category | unit | cost | requires_employee |
| 1 | Safety Boots | PPE-001 | PPE | PAIR | 45.00 | FALSE |
| 2 | Overalls | UNI-001 | Uniforms | EACH | 35.00 | TRUE |

### Sheet: EmployeeData
| A | B | C | D | E |
|---|---|---|---|---|
| id | full_name | employee_code | role | site_code |
| 1 | John Smith | EMP-001 | Pump Attendant | HAR-001 |

### Sheet: Config (Very Hidden)
| A | B |
|---|---|
| API_URL | https://orderz-api.vercel.app |
| LAST_VOUCHER | 1023 |

---

## 🎯 COLUMN WIDTHS & FORMATTING

```
Column A: 4 (row numbers)
Column B: 35 (Item names)
Column C: 12 (SKU)
Column D: 8 (Qty)
Column E: 12 (Unit)
Column F: 10 (Cost)
Column G: 12 (Total)
Column H: 20 (Employee)
Column I: 18 (Buttons)
```

**Cell Colors:**
- Input cells (E6, E9, B17:B36, D17:D36, H17:H36): Light Yellow `RGB(255, 255, 230)`
- Auto-filled cells: Light Gray `RGB(245, 245, 245)`
- Headers: Dark Green `RGB(0, 100, 50)` with White text
- Sub-headers: Light Green `RGB(200, 230, 200)`

**Borders:**
- All data cells: Thin continuous borders
- Header rows: Thick bottom border

---

## 📝 VALIDATION RULES

### Required Fields (before submit):
1. **E6** (Category) - Must be selected
2. **E9** (Site) - Must be selected
3. **At least one item** in B17:B36 with Qty > 0
4. **If Category = "Uniforms"**: Column H must have employee name for each item row with qty

### Validation Messages:
```excel
E6: "Please select a category from the list"
E9: "Please select your site from the dropdown"
B17:B36: "Please select an item from the list"
D17:D36: "Enter quantity as a number (1, 2, 3...)"
H17:H36 (if Uniforms): "Employee name is required for uniform items"
```

---

## 🔄 API INTEGRATION FIELDS

### When Submitting Order (POST /api/excel/orders):

**JSON Payload Structure:**
```json
{
  "voucher_number": "VALUE from E4",
  "site_code": "VALUE from G9",
  "category": "VALUE from E6",
  "ordered_by": "Excel.Application.UserName",
  "notes": "Submitted via Excel Order Form",
  "items": [
    {
      "sku": "VALUE from C17",
      "quantity": VALUE from D17,
      "employee_name": "VALUE from H17 (if Uniforms)"
    },
    // ... for each row with Qty > 0
  ]
}
```

### Response Expected:
```json
{
  "success": true,
  "order": {
    "id": 123,
    "order_number": "ORD-202601-0001",
    "status": "PENDING",
    "site_name": "Harare Main",
    "total": 450.00
  },
  "items": [...],
  "errors": [] // If any items failed
}
```

---

## ✅ PHASE-BY-PHASE CHECKLIST

### Phase 1: Header ✓
- [ ] Add voucher number in E4
- [ ] Add date formula in E5
- [ ] Add category dropdown in E6

### Phase 2: Site Section ✓
- [ ] Create SiteData hidden sheet
- [ ] Add site dropdown in E9
- [ ] Add VLOOKUP formulas for auto-fill (G9, E10, G10, E11, E12, G12)

### Phase 3: Employee Section ✓
- [ ] Create EmployeeData hidden sheet
- [ ] Add employee dropdown in E15 (filtered by site)
- [ ] Add show/hide logic based on category

### Phase 4: Order Grid ✓
- [ ] Create ItemData hidden sheet
- [ ] Add item dropdowns in B17:B36 (filtered by category)
- [ ] Add VLOOKUP formulas for SKU, Unit, Cost
- [ ] Add Total formulas in G17:G36
- [ ] Add show/hide logic for Column H

### Phase 5: Totals ✓
- [ ] Add item count formula
- [ ] Add order total formula

### Phase 6: Buttons & Macros ✓
- [ ] Import VBA module (SiteOrderForm_V2.bas)
- [ ] Create Refresh Data button
- [ ] Create Submit Order button
- [ ] Create Clear Form button

---

## 🚀 QUICK START STEPS

1. **Open your existing Excel file**
2. **Copy Phase 1** - Paste header section
3. **Copy Phase 2** - Paste site section, create SiteData sheet
4. **Copy Phase 3** - Paste employee section (if needed), create EmployeeData sheet
5. **Copy Phase 4** - Paste order grid, create ItemData sheet
6. **Copy Phase 5** - Paste totals
7. **Import VBA** - Alt+F11 → File → Import → SiteOrderForm_V2.bas
8. **Run FirstTimeSetup** - Alt+F8 → FirstTimeSetup → Run
9. **Test** - Select category, site, add items, click Submit

