# Excel Integration Guide

This guide covers how to connect Excel to the Orderz API for reading data and submitting orders.

## Table of Contents
1. [Power Query Setup](#power-query-setup)
2. [Reading Data](#reading-data)
3. [VBA for Order Submission](#vba-for-order-submission)
4. [Troubleshooting](#troubleshooting)

---

## Power Query Setup

### Initial Connection

1. Open Excel
2. Go to **Data** → **Get Data** → **From Other Sources** → **From Web**
3. Select **Advanced**
4. Enter your API URL: `https://your-app.vercel.app/api/excel/items`
5. Add HTTP header (if using API key):
   - Name: `X-API-Key`
   - Value: `your-api-key`
6. Click **OK**

### Transform JSON to Table

After connecting, use Power Query Editor:

```m
let
    Source = Json.Document(Web.Contents("https://your-app.vercel.app/api/excel/items")),
    ToTable = Table.FromList(Source, Splitter.SplitByNothing(), null, null, ExtraValues.Error),
    ExpandedColumns = Table.ExpandRecordColumn(ToTable, "Column1", 
        {"id", "sku", "category", "product", "role", "size", "variant", "unit", "cost"}, 
        {"id", "sku", "category", "product", "role", "size", "variant", "unit", "cost"}),
    ChangedTypes = Table.TransformColumnTypes(ExpandedColumns, {
        {"id", Int64.Type}, 
        {"cost", type number}
    })
in
    ChangedTypes
```

---

## Reading Data

### Stock Levels Query

```m
let
    // Fetch stock data
    Source = Json.Document(Web.Contents("https://your-app.vercel.app/api/excel/stock")),
    
    // Convert to table
    ToTable = Table.FromList(Source, Splitter.SplitByNothing()),
    
    // Expand all columns
    Expanded = Table.ExpandRecordColumn(ToTable, "Column1", {
        "item_id", "sku", "category", "product", "role", "size", "variant",
        "unit", "cost", "warehouse_id", "warehouse_code", "warehouse_name",
        "quantity", "min_quantity", "max_quantity", "stock_value", "stock_status"
    }),
    
    // Set data types
    TypedTable = Table.TransformColumnTypes(Expanded, {
        {"item_id", Int64.Type},
        {"quantity", Int64.Type},
        {"min_quantity", Int64.Type},
        {"max_quantity", Int64.Type},
        {"cost", type number},
        {"stock_value", type number}
    })
in
    TypedTable
```

### Low Stock Alerts

```m
let
    Source = Json.Document(Web.Contents("https://your-app.vercel.app/api/excel/stock?low_stock=true")),
    ToTable = Table.FromList(Source, Splitter.SplitByNothing()),
    Expanded = Table.ExpandRecordColumn(ToTable, "Column1", {
        "sku", "product", "warehouse_code", "quantity", "min_quantity", "stock_status"
    })
in
    Expanded
```

### Filter by Warehouse

```m
let
    Source = Json.Document(Web.Contents("https://your-app.vercel.app/api/excel/stock?warehouse=MAIN")),
    // ... rest of transformation
in
    Result
```

### Lookups (Dropdowns)

For populating dropdown lists in your order forms:

```m
let
    Source = Json.Document(Web.Contents("https://your-app.vercel.app/api/excel/lookups")),
    Sites = Source[sites],
    SitesTable = Table.FromList(Sites, Splitter.SplitByNothing()),
    Expanded = Table.ExpandRecordColumn(SitesTable, "Column1", {"id", "code", "name"})
in
    Expanded
```

---

## VBA for Order Submission

### Setup

1. Enable Developer tab in Excel
2. Press `Alt + F11` to open VBA Editor
3. Go to **Tools** → **References**
4. Enable **Microsoft Scripting Runtime**
5. Add a new Module

### Basic Order Submission

```vba
' Module: OrderSubmission

Private Const API_URL As String = "https://your-app.vercel.app/api/excel/submit-order"
Private Const API_KEY As String = "your-api-key"  ' Optional

Public Sub SubmitOrder()
    Dim http As Object
    Dim jsonBody As String
    Dim response As String
    Dim ws As Worksheet
    
    Set ws = ThisWorkbook.Sheets("OrderForm")
    
    ' Build JSON payload
    jsonBody = BuildOrderJson(ws)
    
    ' Create HTTP request
    Set http = CreateObject("MSXML2.XMLHTTP")
    
    http.Open "POST", API_URL, False
    http.setRequestHeader "Content-Type", "application/json"
    http.setRequestHeader "X-API-Key", API_KEY
    http.Send jsonBody
    
    ' Handle response
    If http.Status = 200 Then
        response = http.responseText
        MsgBox "Order submitted successfully!" & vbCrLf & _
               "Response: " & response, vbInformation
    Else
        MsgBox "Error: " & http.Status & vbCrLf & _
               http.responseText, vbExclamation
    End If
    
    Set http = Nothing
End Sub

Private Function BuildOrderJson(ws As Worksheet) As String
    Dim json As String
    Dim i As Long
    Dim lastRow As Long
    Dim items As String
    
    ' Get order header from named ranges or cells
    Dim siteCode As String: siteCode = ws.Range("SiteCode").Value
    Dim warehouseCode As String: warehouseCode = ws.Range("WarehouseCode").Value
    Dim orderedBy As String: orderedBy = ws.Range("OrderedBy").Value
    
    ' Find last row of items
    lastRow = ws.Cells(ws.Rows.Count, "A").End(xlUp).Row
    
    ' Build items array
    items = ""
    For i = 10 To lastRow  ' Assuming items start at row 10
        Dim sku As String: sku = ws.Cells(i, 1).Value
        Dim qty As Long: qty = ws.Cells(i, 2).Value
        
        If sku <> "" And qty > 0 Then
            If items <> "" Then items = items & ","
            items = items & "{""sku"":""" & sku & """,""quantity"":" & qty & "}"
        End If
    Next i
    
    ' Build complete JSON
    json = "{"
    json = json & """site_code"":""" & siteCode & ""","
    json = json & """warehouse_code"":""" & warehouseCode & ""","
    json = json & """ordered_by"":""" & orderedBy & ""","
    json = json & """submit"":true,"
    json = json & """items"":[" & items & "]"
    json = json & "}"
    
    BuildOrderJson = json
End Function
```

### Stock Check Before Submit

```vba
Public Function CheckStockAvailability(warehouseCode As String, items As Collection) As Boolean
    Dim http As Object
    Dim jsonBody As String
    Dim response As String
    Dim result As Object
    
    ' Get warehouse ID first
    Dim warehouseId As Long
    warehouseId = GetWarehouseId(warehouseCode)
    
    ' Build items array for check
    Dim itemsJson As String
    itemsJson = ""
    
    Dim item As Variant
    For Each item In items
        If itemsJson <> "" Then itemsJson = itemsJson & ","
        itemsJson = itemsJson & "{""item_id"":" & item("id") & ",""quantity"":" & item("qty") & "}"
    Next item
    
    jsonBody = "{""warehouse_id"":" & warehouseId & ",""items"":[" & itemsJson & "]}"
    
    Set http = CreateObject("MSXML2.XMLHTTP")
    http.Open "POST", "https://your-app.vercel.app/api/stock/check", False
    http.setRequestHeader "Content-Type", "application/json"
    http.Send jsonBody
    
    If http.Status = 200 Then
        ' Parse response
        Set result = JsonConverter.ParseJson(http.responseText)
        CheckStockAvailability = result("data")("all_sufficient")
    Else
        CheckStockAvailability = False
    End If
    
    Set http = Nothing
End Function
```

---

## Excel Template Structure

### Order Form Sheet

| Cell/Range | Purpose |
|------------|---------|
| B2 | Site Code (dropdown from Sites table) |
| B3 | Warehouse Code (dropdown from Warehouses table) |
| B4 | Ordered By (text) |
| B5 | Notes (text) |
| A10:C100 | Order items (SKU, Quantity, Notes) |

### Data Validation for Dropdowns

```vba
Sub SetupDropdowns()
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Sheets("OrderForm")
    
    ' Site dropdown
    With ws.Range("B2").Validation
        .Delete
        .Add Type:=xlValidateList, _
             AlertStyle:=xlValidAlertStop, _
             Formula1:="=Sites[code]"
    End With
    
    ' Warehouse dropdown
    With ws.Range("B3").Validation
        .Delete
        .Add Type:=xlValidateList, _
             AlertStyle:=xlValidAlertStop, _
             Formula1:="=Warehouses[code]"
    End With
End Sub
```

---

## Refreshing Data

### Manual Refresh
1. Go to **Data** → **Refresh All**
2. Or right-click on a table → **Refresh**

### Auto-Refresh on Open

```vba
Private Sub Workbook_Open()
    ThisWorkbook.RefreshAll
End Sub
```

### Scheduled Refresh (Windows Only)

Use Task Scheduler to run a VBS script:

```vbs
' RefreshExcel.vbs
Set objExcel = CreateObject("Excel.Application")
Set objWorkbook = objExcel.Workbooks.Open("C:\Path\To\Orderz.xlsx")
objWorkbook.RefreshAll
objExcel.Application.CalculateUntilAsyncQueriesDone
objWorkbook.Save
objWorkbook.Close
objExcel.Quit
```

---

## Troubleshooting

### Connection Refused
- Verify API URL is correct
- Check if Vercel deployment is active
- Try accessing URL in browser first

### JSON Parse Error
- Check API response format
- Verify Power Query transformation steps
- Look for special characters in data

### 401 Unauthorized
- Verify API key is correct
- Check X-API-Key header is being sent

### Timeout Errors
- Large datasets may timeout
- Use pagination: `?page=1&limit=100`
- Filter data at API level

### CORS Issues
- Should not occur with properly configured API
- VBA uses XMLHTTP which bypasses browser CORS

---

## Sample Workbook Structure

```
Orderz.xlsx
├── Dashboard           # Summary view with charts
├── OrderForm           # Order entry form
├── StockLevels         # Live stock data (Power Query)
├── LowStock            # Filtered low stock view
├── Items               # Product catalog reference
├── Sites               # Site lookup table
├── Warehouses          # Warehouse lookup table
└── OrderHistory        # Past orders (Power Query)
```

Each data sheet should have a Power Query connection that refreshes from the API.
