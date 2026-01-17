# EXCEL FORMULAS - COPY & PASTE GUIDE
## Use this to copy exact formulas into your Excel cells

---

## PHASE 2: AUTO-FILL FORMULAS (Site Section)

### Cell G9 (Site Code)
```
=IFERROR(VLOOKUP($E$9,SiteData!$B:$C,2,FALSE),"")
```

### Cell E10 (Address)
```
=IFERROR(VLOOKUP($E$9,SiteData!$B:$D,3,FALSE),"")
```

### Cell G10 (City)
```
=IFERROR(VLOOKUP($E$9,SiteData!$B:$E,4,FALSE),"")
```

### Cell E11 (Fulfillment)
```
=IFERROR(IF(VLOOKUP($E$9,SiteData!$B:$F,5,FALSE)="COLLECTION","✓ COLLECTION from Head Office","📦 DISPATCH via courier"),"")
```

### Cell E12 (Contact)
```
=IFERROR(VLOOKUP($E$9,SiteData!$B:$G,6,FALSE),"")
```

### Cell G12 (Phone)
```
=IFERROR(VLOOKUP($E$9,SiteData!$B:$H,7,FALSE),"")
```

---

## PHASE 3: EMPLOYEE AUTO-FILL FORMULAS

### Cell G15 (Employee Code)
```
=IFERROR(VLOOKUP($E$15,EmployeeData!$B:$C,2,FALSE),"")
```

### Cell E16 (Role)
```
=IFERROR(VLOOKUP($E$15,EmployeeData!$B:$D,3,FALSE),"")
```

---

## PHASE 4: ORDER GRID FORMULAS (Row 17 - copy down to row 36)

### Cell C17 (SKU - auto-fill when item selected)
```
=IFERROR(VLOOKUP(B17,ItemData!$B:$C,2,FALSE),"")
```

### Cell E17 (Unit - auto-fill)
```
=IFERROR(VLOOKUP(B17,ItemData!$B:$E,4,FALSE),"")
```

### Cell F17 (Cost - auto-fill)
```
=IFERROR(VLOOKUP(B17,ItemData!$B:$F,5,FALSE),"")
```

### Cell G17 (Total - calculate)
```
=IF(AND(D17<>"",ISNUMBER(D17)),D17*F17,"")
```

**COPY FORMULAS DOWN:**
- Select C17:G17
- Copy (Ctrl+C)
- Select C18:G36
- Paste (Ctrl+V)

---

## PHASE 5: TOTALS FORMULAS

### Cell F38 (Item Count)
```
=COUNTIF(B17:B36,"<>")
```

### Cell G39 (Order Total)
```
=SUM(G17:G36)
```

---

## DATA VALIDATION FORMULAS

### Cell E6 (Category Dropdown)
**Data → Data Validation → Settings:**
- Allow: List
- Source: `Uniforms,PPE,Stationery,Consumable,HSSE`

### Cell E9 (Site Dropdown)
**Data → Data Validation → Settings:**
- Allow: List
- Source: `=SiteData!$B$2:$B$100`

### Cells B17:B36 (Item Dropdown - Dynamic)
**Data → Data Validation → Settings:**
- Allow: List
- Source: `=IF($E$6="",ItemData!$B$2:$B$500,IF($E$6="Uniforms",ItemData!$B$2:$B$200,ItemData!$B$2:$B$500))`

**Note:** For filtered dropdowns, you may need a helper column or VBA

### Cell E15 (Employee Dropdown - Filtered by Site)
**Data → Data Validation → Settings:**
- Allow: List
- Source: `=EmployeeData!$B$2:$B$200`

**Note:** For site filtering, you'll need VBA or a helper column

### Cells D17:D36 (Quantity - Numbers Only)
**Data → Data Validation → Settings:**
- Allow: Whole number
- Data: greater than
- Minimum: 0

---

## CONDITIONAL FORMATTING RULES

### Highlight Required Fields (Yellow)
**Applies to:** E6, E9
**Format:** Fill: RGB(255, 255, 230)
**Rule:** =TRUE

### Highlight Input Cells (Light Yellow)
**Applies to:** B17:B36, D17:D36, H17:H36
**Format:** Fill: RGB(255, 255, 230)
**Rule:** =TRUE

### Highlight Auto-filled Cells (Light Gray)
**Applies to:** C17:C36, E17:E36, F17:F36, G9, E10:E12, G10, G12
**Format:** Fill: RGB(245, 245, 245)
**Rule:** =TRUE

### Show Employee Column Only for Uniforms
**Use VBA or manually hide/unhide Column H**
```vb
If Range("E6").Value = "Uniforms" Then
    Columns("H").Hidden = False
Else
    Columns("H").Hidden = True
End If
```

---

## NAMED RANGES (Optional but Recommended)

Create these named ranges for easier formula management:

1. **SelectedCategory** = 'Order Form'!$E$6
2. **SelectedSite** = 'Order Form'!$E$9
3. **OrderItemsRange** = 'Order Form'!$B$17:$H$36
4. **SiteDatabase** = SiteData!$A:$H
5. **ItemDatabase** = ItemData!$A:$G
6. **EmployeeDatabase** = EmployeeData!$A:$E

**To Create Named Range:**
1. Select the cell/range
2. Click in the Name Box (left of formula bar)
3. Type the name
4. Press Enter

---

## CELL PROTECTION

### Protect Sheet with Exceptions
**Allow users to edit only:**
- E4 (Voucher No)
- E5 (Date)
- E6 (Category)
- E9 (Site)
- E15 (Employee - if Uniforms)
- B17:B36 (Items)
- D17:D36 (Quantities)
- H17:H36 (Employees - if Uniforms)

**Lock all other cells**

**Steps:**
1. Select all cells (Ctrl+A)
2. Format Cells → Protection → ✓ Locked
3. Select input cells above
4. Format Cells → Protection → ☐ Locked (uncheck)
5. Review → Protect Sheet
6. Password (optional)
7. ✓ Allow: Select unlocked cells

---

## QUICK COPY-PASTE TEMPLATE

### SiteData Sheet Setup
```
Row 1 Headers:
A1: id
B1: name
C1: code
D1: address
E1: city
F1: fulfillment_zone
G1: contact_name
H1: phone

Row 2 Sample:
A2: 1
B2: Harare Main
C2: HAR-001
D2: 123 Main Street
E2: Harare
F2: COLLECTION
G2: John Doe
H2: +263712345678
```

### ItemData Sheet Setup
```
Row 1 Headers:
A1: id
B1: product
C1: sku
D1: category
E1: unit
F1: cost
G1: requires_employee

Row 2 Sample (PPE):
A2: 1
B2: Safety Boots - Size 42
C2: PPE-001
D2: PPE
E2: PAIR
F2: 45.00
G2: FALSE

Row 3 Sample (Uniform):
A3: 2
B3: Overalls - Large
C3: UNI-001
D3: Uniforms
E3: EACH
F3: 35.00
G3: TRUE
```

### EmployeeData Sheet Setup
```
Row 1 Headers:
A1: id
B1: full_name
C1: employee_code
D1: role
E1: site_code

Row 2 Sample:
A2: 1
B2: John Smith
C2: EMP-001
D2: Pump Attendant
E2: HAR-001
```

---

## TESTING YOUR SETUP

### Test Checklist:
1. ✓ Select Category → Item dropdown filters correctly
2. ✓ Select Site → Address, City, Contact auto-fill
3. ✓ Select Item → SKU, Unit, Cost auto-fill
4. ✓ Enter Quantity → Total calculates
5. ✓ If Uniforms → Employee column shows, dropdown works
6. ✓ Item count updates
7. ✓ Order total calculates
8. ✓ Submit button validates required fields

### Common Errors:
- **#REF!** → Sheet name or range doesn't exist
- **#N/A** → Lookup value not found (OK if cell is empty)
- **#VALUE!** → Wrong data type (text instead of number)
- **Dropdown doesn't work** → Check Data Validation source range

---

## 💡 PRO TIPS

1. **Use Table References** instead of ranges:
   - Convert SiteData to a Table (Ctrl+T)
   - Rename table to "tblSites"
   - Use: `=VLOOKUP(E9,tblSites[name]:[phone],2,FALSE)`

2. **Dynamic Dropdowns** using OFFSET:
   ```
   =OFFSET(SiteData!$B$1,1,0,COUNTA(SiteData!$B:$B)-1,1)
   ```

3. **Error-Free Formulas**:
   Always wrap in IFERROR to show blank instead of #N/A

4. **Fast Fill**:
   Double-click the fill handle (bottom-right corner of cell) to copy formula down automatically

