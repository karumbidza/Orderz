# Redan Site Order Form - Setup Guide
## For Users with Zero Coding Experience

---

## PART 1: CREATE THE EXCEL FILE

### Step 1.1: Open Excel
1. Open Microsoft Excel
2. Click **File** → **New** → **Blank Workbook**

### Step 1.2: Save as Macro-Enabled Workbook
1. Click **File** → **Save As**
2. Choose your location (Desktop or Documents)
3. **IMPORTANT**: In the "Save as type" dropdown, select **Excel Macro-Enabled Workbook (*.xlsm)**
4. Name it: `Redan_Order_Form.xlsm`
5. Click **Save**

### Step 1.3: Rename the Sheet
1. Right-click the sheet tab at the bottom (it says "Sheet1")
2. Click **Rename**
3. Type: `Order Form`
4. Press Enter

### Step 1.4: Create the Hidden Data Sheet
1. Right-click the `Order Form` tab
2. Click **Insert** → **Worksheet**
3. Right-click the new sheet tab
4. Click **Rename** → Type: `DataCache`
5. Press Enter

---

## PART 2: IMPORT THE VBA CODE

### Step 2.1: Open VBA Editor
1. Press **Alt + F11** (this opens the VBA Editor)
   - OR: Click **Developer** tab → **Visual Basic**
   - If you don't see Developer tab, see "Enable Developer Tab" below

### Step 2.2: Import the Module
1. In the VBA Editor, click **File** → **Import File...**
2. Navigate to: `Documents/PROJECTS/Orderz/excel/`
3. Select: `SiteOrderForm_VBA.bas`
4. Click **Open**
5. You should see "Module1" appear in the left panel

### Step 2.3: Close VBA Editor
1. Click **File** → **Close and Return to Microsoft Excel**
   - OR press **Alt + Q**

---

## PART 3: CONFIGURE THE API URL

### Step 3.1: Set Your Vercel URL
1. Press **Alt + F11** to open VBA Editor again
2. In the left panel, double-click **Module1**
3. Find this line near the top (around line 14):
   ```
   Private Const API_BASE_URL As String = "https://your-app.vercel.app"
   ```
4. Replace `https://your-app.vercel.app` with your actual Vercel URL
   - Example: `"https://orderz-api.vercel.app"`
5. Press **Ctrl + S** to save
6. Press **Alt + Q** to close VBA Editor

---

## PART 4: SET UP THE FORM LAYOUT

### Step 4.1: Run the Setup
1. Press **Alt + F8** (this opens the Macro dialog)
2. Select **SetupOrderForm** from the list
3. Click **Run**
4. Wait for it to complete (you'll see a message box)

### Step 4.2: Load Data from Database
1. Press **Alt + F8** again
2. Select **RefreshAllData**
3. Click **Run**
4. Wait for "Data refreshed from database!" message

---

## PART 5: HOW TO USE THE FORM

### Placing an Order:
1. **Select Category**: Click the Category dropdown (cell D5), choose: Uniforms, PPE, Stationery, etc.
2. **Select Site**: Click the Site dropdown (cell D9), choose your site
   - Address, phone, contact will auto-fill
3. **Add Items**: 
   - Click any cell in column B (rows 20-39)
   - Select an item from the dropdown
   - Enter quantity in column D
   - For Uniforms: Enter employee name in column H
4. **Submit**: Press **Alt + F8** → Run **SubmitOrder**

### Other Commands:
| Shortcut | Action |
|----------|--------|
| Alt + F8 → RefreshAllData | Reload sites/items from database |
| Alt + F8 → ClearOrderForm | Clear form for new order |
| Alt + F8 → SubmitOrder | Submit current order |

---

## TROUBLESHOOTING

### "Developer tab not visible"
1. Click **File** → **Options**
2. Click **Customize Ribbon**
3. On the right side, check ✓ **Developer**
4. Click **OK**

### "Macros are disabled"
1. Click **File** → **Options**
2. Click **Trust Center** → **Trust Center Settings**
3. Click **Macro Settings**
4. Select **Enable all macros**
5. Click **OK** twice
6. Close and reopen the file

### "Cannot connect to API"
1. Check your internet connection
2. Verify the API_BASE_URL is correct
3. Make sure the Vercel deployment is running

### "Run-time error"
1. Press **Alt + F8**
2. Run **RefreshAllData** first
3. Try your action again

---

## DISTRIBUTING TO SITES

When sending this file to sites:
1. Each site gets a copy of `Redan_Order_Form.xlsm`
2. They save it to their local computer
3. The form connects to the central database via internet
4. All orders are stored in the cloud database
5. Sites can work offline but need internet to submit orders

---

## QUICK REFERENCE: FORM LAYOUT

```
┌─────────────────────────────────────────────────────────┐
│  REDAN PETROLEUM - ORDER VOUCHER                        │
├─────────────────────────────────────────────────────────┤
│  Voucher No: [D3]     Date: [D4]                        │
│  Category:   [D5 ▼]   Department: [D6]                  │
├─────────────────────────────────────────────────────────┤
│  SITE DETAILS                                           │
│  Site Name:  [D9 ▼]   Site Code: [G9]                   │
│  Address:    [D10]    City: [G10]                       │
│  Fulfillment: [D11]                                     │
│  Contact:    [D12]    Phone: [G12]                      │
│  TM Email:   [D13]                                      │
├─────────────────────────────────────────────────────────┤
│  EMPLOYEE (for Uniforms only)                           │
│  Name:       [D15 ▼]  Code: [G15]                       │
│  Role:       [D16]                                      │
├─────────────────────────────────────────────────────────┤
│  ORDER ITEMS                                            │
│  Item      │ SKU │ Qty │ Unit │ Cost  │ Total │ Employee│
│  [B20 ▼]   │ C20 │ D20 │ E20  │ F20   │ G20   │ H20     │
│  [B21 ▼]   │ C21 │ D21 │ E21  │ F21   │ G21   │ H21     │
│  ... (rows 20-39)                                       │
├─────────────────────────────────────────────────────────┤
│  TOTALS                                                 │
│  Item Count: [D41]    Order Total: [G41]                │
└─────────────────────────────────────────────────────────┘
```

---

## SUPPORT

If you encounter issues:
1. Check internet connection
2. Verify macros are enabled
3. Contact IT support with the error message

