# Redan Coupon - Site Manager Ordering Guide

## Getting Started

### Step 1: Enable Macros in Excel

**For Windows:**
1. Open the Excel file `RequisitionForm_MacrosEnabled.xlsm`
2. You'll see a yellow security warning bar at the top saying "SECURITY WARNING: Macros have been disabled"
3. Click **"Enable Content"** button
4. If prompted again, click **"Enable Macros"**

**For Mac:**
1. Open the Excel file `RequisitionForm_MacrosEnabled.xlsm`
2. When prompted about macros, click **"Enable Macros"**
3. If you don't see the prompt, go to: **Excel → Preferences → Security & Privacy**
4. Set "Macro Security" to **"Enable all macros"**

> ⚠️ **Important:** The file must be `.xlsm` format (macro-enabled). If you save as `.xlsx`, the macros will be lost.

---

## Step 2: Understanding SKU Codes (CRITICAL)

The SKU code is how the system identifies each item. **You must use the exact SKU code** for your order to be processed correctly.

### SKU Format Examples:

| Category | SKU Code | Description |
|----------|----------|-------------|
| **PPE** | `PPE-SAFETY-BOOTS` | Safety Boots |
| **PPE** | `PPE-HARD-HAT` | Hard Hat |
| **PPE** | `PPE-REFLECTIVE-VEST` | Reflective Vest |
| **PPE** | `PPE-SAFETY-GLASSES` | Safety Glasses |
| **PPE** | `PPE-WORK-GLOVES` | Work Gloves |
| **PPE** | `PPE-EAR-PLUGS` | Ear Plugs |
| **Uniforms** | `UNI-SHIRT-BLUE` | Blue Uniform Shirt |
| **Uniforms** | `UNI-PANTS-BLUE` | Blue Uniform Pants |
| **Uniforms** | `UNI-JACKET-BLUE` | Blue Uniform Jacket |
| **Stationery** | `STA-PEN-BLACK` | Black Pen |
| **Stationery** | `STA-NOTEBOOK-A4` | A4 Notebook |
| **Stationery** | `STA-STAPLER` | Stapler |

### How to Find SKU Codes:

1. **Check the Items List** - A complete list of items with SKU codes should be provided by Head Office
2. **Use the Category Prefix** - SKUs follow a pattern:
   - `PPE-` = Personal Protective Equipment
   - `UNI-` = Uniforms
   - `STA-` = Stationery
   - `TOO-` = Tools
   - `CLE-` = Cleaning

3. **Ask Head Office** - If unsure, contact Head Office for the correct SKU

> ⚠️ **Warning:** If you enter an incorrect SKU, the item will NOT be included in your order!

---

## Step 3: Filling Out the Order Form

### Header Information:
1. **Site Code** - Enter your site code (e.g., `HARARE-MAIN`, `BULAWAYO-CBD`)
2. **Requested By** - Your name
3. **Category** - Select from: PPE, UNIFORMS, STATIONERY, TOOLS, CLEANING

### Order Items Table:
For each item you need:

| Column | What to Enter | Example |
|--------|---------------|---------|
| **SKU** | The exact SKU code | `PPE-SAFETY-BOOTS` |
| **Item Name** | Description (optional) | Safety Boots |
| **Size** | Size if applicable | `42` or `Large` |
| **Quantity** | Number needed | `5` |
| **Employee Name** | Who it's for (if applicable) | John Smith |
| **Notes** | Any special requirements | Urgent - needed for new staff |

### Example Order:

| SKU | Item Name | Size | Qty | Employee | Notes |
|-----|-----------|------|-----|----------|-------|
| PPE-SAFETY-BOOTS | Safety Boots | 42 | 2 | John Smith | |
| PPE-SAFETY-BOOTS | Safety Boots | 44 | 1 | Peter Jones | |
| PPE-HARD-HAT | Hard Hat | | 3 | | For new hires |
| PPE-REFLECTIVE-VEST | Reflective Vest | XL | 2 | | |

---

## Step 4: Submitting Your Order

### Using the Submit Button:

1. Fill in all required fields (Site Code, items with SKUs and quantities)
2. Click the **"Submit Order"** button
3. Wait for the confirmation message
4. You'll receive a **Voucher Number** (e.g., `RV-2026-0001`) - **Save this number!**

### What Happens Next:

1. ✅ Order is sent to Head Office
2. 📋 Status starts as **PENDING**
3. 📦 Head Office processes and dispatches
4. 🚚 You receive goods with dispatch note
5. ✔️ Confirm receipt

---

## Step 5: Checking Order Status

Contact Head Office with your **Voucher Number** to check status:

| Status | Meaning |
|--------|---------|
| **PENDING** | Order received, awaiting processing |
| **PROCESSING** | Order being prepared |
| **DISPATCHED** | Goods sent to your site |
| **RECEIVED** | Delivery confirmed |
| **CANCELLED** | Order cancelled |

---

## Troubleshooting

### "Macros Disabled" Error
- Make sure you clicked "Enable Content" when opening the file
- Check your Excel security settings allow macros

### "Invalid SKU" or Item Not Found
- Double-check the SKU code spelling
- Use UPPERCASE for SKU codes
- Contact Head Office for the correct SKU

### "Site Not Found" Error
- Verify your Site Code is correct
- Contact Head Office to confirm your site is registered

### Order Won't Submit
- Check internet connection
- Ensure all required fields are filled
- Try closing and reopening Excel

### "Connection Error"
- Check your internet connection
- The server may be temporarily unavailable - try again in a few minutes

---

## Quick Reference Card

```
╔════════════════════════════════════════════════════════════╗
║           REDAN COUPON - QUICK ORDER GUIDE                 ║
╠════════════════════════════════════════════════════════════╣
║  1. Open Excel file (.xlsm)                                ║
║  2. Click "Enable Content" for macros                      ║
║  3. Enter your Site Code                                   ║
║  4. Enter items with EXACT SKU codes                       ║
║  5. Click "Submit Order"                                   ║
║  6. Save your Voucher Number!                              ║
╠════════════════════════════════════════════════════════════╣
║  SKU EXAMPLES:                                             ║
║  • PPE-SAFETY-BOOTS    • UNI-SHIRT-BLUE                   ║
║  • PPE-HARD-HAT        • STA-PEN-BLACK                    ║
║  • PPE-REFLECTIVE-VEST • STA-NOTEBOOK-A4                  ║
╠════════════════════════════════════════════════════════════╣
║  NEED HELP? Contact Head Office                            ║
╚════════════════════════════════════════════════════════════╝
```

---

## Contact Head Office

For questions about:
- SKU codes and item availability
- Order status
- Technical issues with the form

**Email:** orders@redancoupon.co.zw  
**Phone:** [Head Office Number]

---

*Last Updated: 21 January 2026*
