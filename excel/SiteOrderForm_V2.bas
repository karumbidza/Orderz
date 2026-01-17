' ============================================================================
' REDAN SITE ORDER FORM - VBA MODULE v2.0
' Connects to Neon Database via Vercel API
' ============================================================================
' QUICK START:
' 1. Import this module (Alt+F11 > File > Import)
' 2. Run "FirstTimeSetup" macro (Alt+F8 > FirstTimeSetup > Run)
' 3. That's it! The wizard will guide you through everything.
' ============================================================================

Option Explicit

' === CONFIGURATION (Stored in hidden sheet) ===
Private Const CONFIG_SHEET As String = "Config"
Private Const ORDER_SHEET As String = "Order Form"
Private Const CACHE_SHEET As String = "DataCache"

' Default API URL - will be prompted to change
Private Const DEFAULT_API_URL As String = "https://orderz-api.vercel.app"

' === CELL REFERENCES ===
Private Const CELL_VOUCHER_NO As String = "E4"
Private Const CELL_DATE As String = "E5"
Private Const CELL_CATEGORY As String = "E6"
Private Const CELL_SITE_NAME As String = "E9"
Private Const CELL_SITE_CODE As String = "G9"
Private Const CELL_ADDRESS As String = "E10"
Private Const CELL_CITY As String = "G10"
Private Const CELL_FULFILLMENT As String = "E11"
Private Const CELL_CONTACT As String = "E12"
Private Const CELL_PHONE As String = "G12"

Private Const ORDER_START_ROW As Long = 17
Private Const ORDER_END_ROW As Long = 36
Private Const COL_ITEM As String = "B"
Private Const COL_SKU As String = "C"
Private Const COL_QTY As String = "D"
Private Const COL_UNIT As String = "E"
Private Const COL_COST As String = "F"
Private Const COL_TOTAL As String = "G"
Private Const COL_EMPLOYEE As String = "H"

' ============================================================================
' FIRST TIME SETUP WIZARD
' ============================================================================

Public Sub FirstTimeSetup()
    ' Run this once to set up everything
    
    Dim apiUrl As String
    Dim testResult As String
    
    MsgBox "Welcome to Redan Order Form Setup!" & vbCrLf & vbCrLf & _
           "This wizard will:" & vbCrLf & _
           "1. Configure your API connection" & vbCrLf & _
           "2. Create the order form" & vbCrLf & _
           "3. Load sites and items from the database" & vbCrLf & vbCrLf & _
           "Click OK to begin.", vbInformation, "Setup Wizard"
    
    ' Step 1: Get API URL
    apiUrl = InputBox("Enter your Vercel API URL:" & vbCrLf & vbCrLf & _
                      "Example: https://orderz-api.vercel.app" & vbCrLf & vbCrLf & _
                      "(Ask your administrator if you don't know)", _
                      "Step 1: API Configuration", DEFAULT_API_URL)
    
    If apiUrl = "" Then
        MsgBox "Setup cancelled.", vbExclamation
        Exit Sub
    End If
    
    ' Remove trailing slash if present
    If Right(apiUrl, 1) = "/" Then apiUrl = Left(apiUrl, Len(apiUrl) - 1)
    
    ' Step 2: Test connection
    Application.StatusBar = "Testing connection to " & apiUrl & "..."
    testResult = TestAPIConnection(apiUrl)
    
    If InStr(testResult, "error") > 0 Or testResult = "" Then
        If MsgBox("Could not connect to API!" & vbCrLf & vbCrLf & _
                  "URL: " & apiUrl & vbCrLf & _
                  "Error: " & testResult & vbCrLf & vbCrLf & _
                  "Continue anyway? (You can fix the URL later)", _
                  vbExclamation + vbYesNo, "Connection Test Failed") = vbNo Then
            Exit Sub
        End If
    Else
        MsgBox "Connection successful!" & vbCrLf & vbCrLf & _
               "Connected to: " & apiUrl, vbInformation, "Step 1 Complete"
    End If
    
    ' Step 3: Save configuration
    SaveConfig "API_URL", apiUrl
    SaveConfig "SETUP_COMPLETE", "YES"
    SaveConfig "SETUP_DATE", CStr(Now())
    
    ' Step 4: Create form
    Application.StatusBar = "Creating order form..."
    CreateOrderFormLayout
    
    ' Step 5: Create DataCache sheet
    CreateDataCacheSheet
    
    ' Step 6: Load data
    Application.StatusBar = "Loading sites from database..."
    LoadSitesFromAPI
    
    Application.StatusBar = "Loading items from database..."
    LoadItemsFromAPI
    
    Application.StatusBar = False
    
    ' Done!
    MsgBox "Setup Complete!" & vbCrLf & vbCrLf & _
           "Your order form is ready to use." & vbCrLf & vbCrLf & _
           "HOW TO ORDER:" & vbCrLf & _
           "1. Select a Category (Uniforms, PPE, etc.)" & vbCrLf & _
           "2. Select your Site from the dropdown" & vbCrLf & _
           "3. Add items and quantities" & vbCrLf & _
           "4. Click the SUBMIT button" & vbCrLf & vbCrLf & _
           "The form will now open.", vbInformation, "Setup Complete!"
    
    ' Activate the order form
    ThisWorkbook.Sheets(ORDER_SHEET).Activate
End Sub

Private Function TestAPIConnection(apiUrl As String) As String
    ' Tests if we can connect to the API
    
    Dim http As Object
    Dim url As String
    
    On Error GoTo ErrorHandler
    
    Set http = CreateObject("MSXML2.XMLHTTP")
    url = apiUrl & "/api/items?limit=1"
    
    http.Open "GET", url, False
    http.setRequestHeader "Accept", "application/json"
    http.send
    
    If http.Status >= 200 And http.Status < 300 Then
        TestAPIConnection = "OK"
    Else
        TestAPIConnection = "error: HTTP " & http.Status
    End If
    
    Set http = Nothing
    Exit Function
    
ErrorHandler:
    TestAPIConnection = "error: " & Err.Description
    Set http = Nothing
End Function

' ============================================================================
' CONFIGURATION MANAGEMENT
' ============================================================================

Private Sub SaveConfig(key As String, value As String)
    Dim ws As Worksheet
    Dim lastRow As Long
    Dim i As Long
    Dim found As Boolean
    
    Set ws = GetOrCreateSheet(CONFIG_SHEET)
    ws.Visible = xlSheetVeryHidden
    
    ' Find existing key or add new
    lastRow = ws.Cells(ws.Rows.Count, 1).End(xlUp).row
    found = False
    
    For i = 1 To lastRow
        If ws.Cells(i, 1).Value = key Then
            ws.Cells(i, 2).Value = value
            found = True
            Exit For
        End If
    Next i
    
    If Not found Then
        ws.Cells(lastRow + 1, 1).Value = key
        ws.Cells(lastRow + 1, 2).Value = value
    End If
End Sub

Private Function GetConfig(key As String) As String
    Dim ws As Worksheet
    Dim lastRow As Long
    Dim i As Long
    
    On Error Resume Next
    Set ws = ThisWorkbook.Sheets(CONFIG_SHEET)
    On Error GoTo 0
    
    If ws Is Nothing Then
        GetConfig = ""
        Exit Function
    End If
    
    lastRow = ws.Cells(ws.Rows.Count, 1).End(xlUp).row
    
    For i = 1 To lastRow
        If ws.Cells(i, 1).Value = key Then
            GetConfig = ws.Cells(i, 2).Value
            Exit Function
        End If
    Next i
    
    GetConfig = ""
End Function

Private Function GetAPIBaseURL() As String
    Dim url As String
    url = GetConfig("API_URL")
    If url = "" Then url = DEFAULT_API_URL
    GetAPIBaseURL = url
End Function

Private Function GetOrCreateSheet(sheetName As String) As Worksheet
    Dim ws As Worksheet
    
    On Error Resume Next
    Set ws = ThisWorkbook.Sheets(sheetName)
    On Error GoTo 0
    
    If ws Is Nothing Then
        Set ws = ThisWorkbook.Sheets.Add(After:=ThisWorkbook.Sheets(ThisWorkbook.Sheets.Count))
        ws.Name = sheetName
    End If
    
    Set GetOrCreateSheet = ws
End Function

' ============================================================================
' API FUNCTIONS
' ============================================================================

Private Function CallAPI(endpoint As String, Optional method As String = "GET", Optional body As String = "") As String
    Dim http As Object
    Dim url As String
    Dim apiKey As String
    
    On Error GoTo ErrorHandler
    
    Set http = CreateObject("MSXML2.XMLHTTP")
    url = GetAPIBaseURL() & endpoint
    apiKey = GetConfig("API_KEY")
    
    http.Open method, url, False
    http.setRequestHeader "Content-Type", "application/json"
    http.setRequestHeader "Accept", "application/json"
    
    If apiKey <> "" Then
        http.setRequestHeader "X-API-Key", apiKey
    End If
    
    If method = "POST" Or method = "PUT" Then
        http.send body
    Else
        http.send
    End If
    
    If http.Status >= 200 And http.Status < 300 Then
        CallAPI = http.responseText
    Else
        CallAPI = "{""error"": ""HTTP " & http.Status & ": " & http.statusText & """}"
    End If
    
    Set http = Nothing
    Exit Function
    
ErrorHandler:
    CallAPI = "{""error"": """ & Err.Description & """}"
    Set http = Nothing
End Function

' ============================================================================
' JSON PARSING (Simple implementation for VBA)
' ============================================================================

Private Function ParseJSONArray(json As String) As Collection
    ' Simple JSON array parser - returns collection of dictionaries
    Dim result As New Collection
    Dim objects As Variant
    Dim i As Long
    Dim obj As String
    Dim dict As Object
    
    On Error GoTo ErrorHandler
    
    ' Remove outer brackets and split by },{
    json = Trim(json)
    
    ' Find the array - look for "data":[ or just [
    Dim startPos As Long, endPos As Long
    startPos = InStr(json, "[")
    If startPos = 0 Then
        Set ParseJSONArray = result
        Exit Function
    End If
    
    endPos = InStrRev(json, "]")
    If endPos = 0 Then endPos = Len(json)
    
    json = Mid(json, startPos + 1, endPos - startPos - 1)
    
    If Len(Trim(json)) = 0 Then
        Set ParseJSONArray = result
        Exit Function
    End If
    
    ' Split objects
    objects = Split(json, "},{")
    
    For i = LBound(objects) To UBound(objects)
        obj = objects(i)
        If Left(obj, 1) <> "{" Then obj = "{" & obj
        If Right(obj, 1) <> "}" Then obj = obj & "}"
        
        Set dict = ParseJSONObject(obj)
        result.Add dict
    Next i
    
    Set ParseJSONArray = result
    Exit Function
    
ErrorHandler:
    Set ParseJSONArray = New Collection
End Function

Private Function ParseJSONObject(json As String) As Object
    ' Simple JSON object parser - returns Scripting.Dictionary
    Dim dict As Object
    Dim pairs As Variant
    Dim i As Long
    Dim key As String
    Dim value As String
    Dim colonPos As Long
    
    Set dict = CreateObject("Scripting.Dictionary")
    
    On Error GoTo ErrorHandler
    
    ' Remove braces
    json = Trim(json)
    If Left(json, 1) = "{" Then json = Mid(json, 2)
    If Right(json, 1) = "}" Then json = Left(json, Len(json) - 1)
    
    ' Split by comma (simplified - doesn't handle nested objects)
    Dim inQuotes As Boolean
    Dim currentPair As String
    Dim c As String
    Dim j As Long
    
    inQuotes = False
    currentPair = ""
    
    For j = 1 To Len(json)
        c = Mid(json, j, 1)
        
        If c = """" Then
            inQuotes = Not inQuotes
            currentPair = currentPair & c
        ElseIf c = "," And Not inQuotes Then
            ' Process pair
            Call ExtractKeyValue(currentPair, dict)
            currentPair = ""
        Else
            currentPair = currentPair & c
        End If
    Next j
    
    ' Process last pair
    If Len(Trim(currentPair)) > 0 Then
        Call ExtractKeyValue(currentPair, dict)
    End If
    
    Set ParseJSONObject = dict
    Exit Function
    
ErrorHandler:
    Set ParseJSONObject = CreateObject("Scripting.Dictionary")
End Function

Private Sub ExtractKeyValue(pair As String, dict As Object)
    Dim colonPos As Long
    Dim key As String
    Dim value As String
    
    colonPos = InStr(pair, ":")
    If colonPos = 0 Then Exit Sub
    
    key = Trim(Left(pair, colonPos - 1))
    value = Trim(Mid(pair, colonPos + 1))
    
    ' Remove quotes from key
    key = Replace(key, """", "")
    
    ' Remove quotes from value if string
    If Left(value, 1) = """" And Right(value, 1) = """" Then
        value = Mid(value, 2, Len(value) - 2)
    End If
    
    ' Handle null
    If value = "null" Then value = ""
    
    dict(key) = value
End Sub

Private Function EscapeJSON(s As String) As String
    Dim result As String
    result = s
    result = Replace(result, "\", "\\")
    result = Replace(result, """", "\""")
    result = Replace(result, vbCr, "\r")
    result = Replace(result, vbLf, "\n")
    result = Replace(result, vbTab, "\t")
    EscapeJSON = result
End Function

' ============================================================================
' DATA LOADING
' ============================================================================

Private Sub LoadSitesFromAPI()
    Dim response As String
    Dim sites As Collection
    Dim site As Object
    Dim ws As Worksheet
    Dim row As Long
    
    response = CallAPI("/api/sites?limit=500")
    
    If InStr(response, """error""") > 0 Then
        MsgBox "Failed to load sites: " & response, vbExclamation
        Exit Sub
    End If
    
    Set ws = GetOrCreateSheet(CACHE_SHEET)
    
    ' Clear and set headers
    ws.Range("A:F").ClearContents
    ws.Range("A1").Value = "site_id"
    ws.Range("B1").Value = "site_name"
    ws.Range("C1").Value = "site_code"
    ws.Range("D1").Value = "address"
    ws.Range("E1").Value = "city"
    ws.Range("F1").Value = "fulfillment_zone"
    ws.Range("G1").Value = "contact_name"
    ws.Range("H1").Value = "phone"
    
    Set sites = ParseJSONArray(response)
    
    row = 2
    For Each site In sites
        ws.Cells(row, 1).Value = site("id")
        ws.Cells(row, 2).Value = site("name")
        ws.Cells(row, 3).Value = site("code")
        ws.Cells(row, 4).Value = site("address")
        ws.Cells(row, 5).Value = site("city")
        ws.Cells(row, 6).Value = site("fulfillment_zone")
        ws.Cells(row, 7).Value = site("contact_name")
        ws.Cells(row, 8).Value = site("phone")
        row = row + 1
    Next site
    
    ' Update dropdown
    UpdateSiteDropdown
    
    Application.StatusBar = "Loaded " & (row - 2) & " sites"
End Sub

Private Sub LoadItemsFromAPI()
    Dim response As String
    Dim items As Collection
    Dim item As Object
    Dim ws As Worksheet
    Dim row As Long
    
    response = CallAPI("/api/items?limit=500")
    
    If InStr(response, """error""") > 0 Then
        MsgBox "Failed to load items: " & response, vbExclamation
        Exit Sub
    End If
    
    Set ws = GetOrCreateSheet(CACHE_SHEET)
    
    ' Items go in columns K onwards
    ws.Range("K:Q").ClearContents
    ws.Range("K1").Value = "item_id"
    ws.Range("L1").Value = "product"
    ws.Range("M1").Value = "category"
    ws.Range("N1").Value = "sku"
    ws.Range("O1").Value = "unit"
    ws.Range("P1").Value = "cost"
    ws.Range("Q1").Value = "requires_employee"
    
    Set items = ParseJSONArray(response)
    
    row = 2
    For Each item In items
        ws.Cells(row, 11).Value = item("id")
        ws.Cells(row, 12).Value = item("product")
        ws.Cells(row, 13).Value = item("category")
        ws.Cells(row, 14).Value = item("sku")
        ws.Cells(row, 15).Value = item("unit")
        ws.Cells(row, 16).Value = item("cost")
        ws.Cells(row, 17).Value = item("requires_employee")
        row = row + 1
    Next item
    
    Application.StatusBar = "Loaded " & (row - 2) & " items"
End Sub

Private Sub CreateDataCacheSheet()
    Dim ws As Worksheet
    Set ws = GetOrCreateSheet(CACHE_SHEET)
    ws.Visible = xlSheetHidden
End Sub

' ============================================================================
' DROPDOWN MANAGEMENT
' ============================================================================

Private Sub UpdateSiteDropdown()
    Dim cacheWs As Worksheet
    Dim orderWs As Worksheet
    Dim lastRow As Long
    Dim siteRange As String
    
    On Error Resume Next
    Set cacheWs = ThisWorkbook.Sheets(CACHE_SHEET)
    Set orderWs = ThisWorkbook.Sheets(ORDER_SHEET)
    On Error GoTo 0
    
    If cacheWs Is Nothing Or orderWs Is Nothing Then Exit Sub
    
    lastRow = cacheWs.Cells(cacheWs.Rows.Count, "B").End(xlUp).row
    If lastRow < 2 Then Exit Sub
    
    siteRange = CACHE_SHEET & "!$B$2:$B$" & lastRow
    
    With orderWs.Range(CELL_SITE_NAME).Validation
        .Delete
        .Add Type:=xlValidateList, AlertStyle:=xlValidAlertStop, Formula1:="=" & siteRange
        .IgnoreBlank = True
        .InCellDropdown = True
        .ShowError = True
        .ErrorTitle = "Invalid Site"
        .ErrorMessage = "Please select a site from the dropdown list."
    End With
End Sub

Public Sub UpdateItemDropdowns()
    ' Updates item dropdowns based on selected category
    Dim cacheWs As Worksheet
    Dim orderWs As Worksheet
    Dim category As String
    Dim lastRow As Long
    Dim i As Long
    Dim j As Long
    Dim itemList As String
    
    On Error Resume Next
    Set cacheWs = ThisWorkbook.Sheets(CACHE_SHEET)
    Set orderWs = ThisWorkbook.Sheets(ORDER_SHEET)
    On Error GoTo 0
    
    If cacheWs Is Nothing Or orderWs Is Nothing Then Exit Sub
    
    category = orderWs.Range(CELL_CATEGORY).Value
    
    ' Build list of items for this category
    lastRow = cacheWs.Cells(cacheWs.Rows.Count, "K").End(xlUp).row
    itemList = ""
    
    For i = 2 To lastRow
        If category = "" Or cacheWs.Cells(i, 13).Value = category Then
            If itemList <> "" Then itemList = itemList & ","
            itemList = itemList & cacheWs.Cells(i, 12).Value  ' Product name
        End If
    Next i
    
    ' Apply to all item cells
    For j = ORDER_START_ROW To ORDER_END_ROW
        With orderWs.Range(COL_ITEM & j).Validation
            .Delete
            If itemList <> "" Then
                .Add Type:=xlValidateList, AlertStyle:=xlValidAlertStop, Formula1:=itemList
                .IgnoreBlank = True
                .InCellDropdown = True
            End If
        End With
    Next j
    
    ' Show/hide employee column based on category
    If category = "Uniforms" Then
        orderWs.Columns("H").Hidden = False
    Else
        orderWs.Columns("H").Hidden = True
    End If
End Sub

' ============================================================================
' FORM EVENT HANDLERS
' ============================================================================

Public Sub OnSiteSelected()
    ' Called when user selects a site - auto-fills details
    Dim orderWs As Worksheet
    Dim cacheWs As Worksheet
    Dim siteName As String
    Dim i As Long
    Dim lastRow As Long
    
    On Error Resume Next
    Set orderWs = ThisWorkbook.Sheets(ORDER_SHEET)
    Set cacheWs = ThisWorkbook.Sheets(CACHE_SHEET)
    On Error GoTo 0
    
    If orderWs Is Nothing Or cacheWs Is Nothing Then Exit Sub
    
    siteName = orderWs.Range(CELL_SITE_NAME).Value
    If siteName = "" Then Exit Sub
    
    ' Find site in cache
    lastRow = cacheWs.Cells(cacheWs.Rows.Count, "B").End(xlUp).row
    
    For i = 2 To lastRow
        If cacheWs.Cells(i, 2).Value = siteName Then
            ' Fill in site details
            orderWs.Range(CELL_SITE_CODE).Value = cacheWs.Cells(i, 3).Value
            orderWs.Range(CELL_ADDRESS).Value = cacheWs.Cells(i, 4).Value
            orderWs.Range(CELL_CITY).Value = cacheWs.Cells(i, 5).Value
            
            ' Fulfillment message
            If cacheWs.Cells(i, 6).Value = "COLLECTION" Then
                orderWs.Range(CELL_FULFILLMENT).Value = "COLLECTION from Head Office"
            Else
                orderWs.Range(CELL_FULFILLMENT).Value = "DISPATCH via courier"
            End If
            
            orderWs.Range(CELL_CONTACT).Value = cacheWs.Cells(i, 7).Value
            orderWs.Range(CELL_PHONE).Value = cacheWs.Cells(i, 8).Value
            Exit For
        End If
    Next i
End Sub

Public Sub OnItemSelected(row As Long)
    ' Called when user selects an item - auto-fills SKU, unit, cost
    Dim orderWs As Worksheet
    Dim cacheWs As Worksheet
    Dim itemName As String
    Dim i As Long
    Dim lastRow As Long
    
    On Error Resume Next
    Set orderWs = ThisWorkbook.Sheets(ORDER_SHEET)
    Set cacheWs = ThisWorkbook.Sheets(CACHE_SHEET)
    On Error GoTo 0
    
    If orderWs Is Nothing Or cacheWs Is Nothing Then Exit Sub
    
    itemName = orderWs.Range(COL_ITEM & row).Value
    If itemName = "" Then Exit Sub
    
    ' Find item in cache
    lastRow = cacheWs.Cells(cacheWs.Rows.Count, "K").End(xlUp).row
    
    For i = 2 To lastRow
        If cacheWs.Cells(i, 12).Value = itemName Then
            orderWs.Range(COL_SKU & row).Value = cacheWs.Cells(i, 14).Value
            orderWs.Range(COL_UNIT & row).Value = cacheWs.Cells(i, 15).Value
            orderWs.Range(COL_COST & row).Value = cacheWs.Cells(i, 16).Value
            Exit For
        End If
    Next i
End Sub

' ============================================================================
' CREATE FORM LAYOUT
' ============================================================================

Private Sub CreateOrderFormLayout()
    Dim ws As Worksheet
    Dim i As Long
    
    Set ws = GetOrCreateSheet(ORDER_SHEET)
    
    Application.ScreenUpdating = False
    
    ws.Cells.ClearContents
    ws.Cells.ClearFormats
    ws.Cells.Interior.Color = RGB(255, 255, 255)
    
    ' === HEADER ===
    ws.Range("B2:H2").Merge
    ws.Range("B2").Value = "REDAN PETROLEUM - REQUEST VOUCHER"
    ws.Range("B2").Font.Size = 18
    ws.Range("B2").Font.Bold = True
    ws.Range("B2").Font.Color = RGB(0, 100, 50)
    ws.Range("B2").HorizontalAlignment = xlCenter
    
    ' === VOUCHER INFO ===
    ws.Range("D4").Value = "Voucher No:"
    ws.Range("E4").Value = GetNextVoucherNumber()
    ws.Range("E4").Font.Bold = True
    
    ws.Range("D5").Value = "Date:"
    ws.Range("E5").Value = Date
    ws.Range("E5").NumberFormat = "dd-mmm-yyyy"
    
    ws.Range("D6").Value = "Category:"
    With ws.Range("E6").Validation
        .Delete
        .Add Type:=xlValidateList, Formula1:="Uniforms,PPE,Stationery,Consumable,HSSE"
        .IgnoreBlank = False
        .ShowError = True
        .ErrorTitle = "Select Category"
        .ErrorMessage = "Please select a category from the list."
    End With
    ws.Range("E6").Interior.Color = RGB(255, 255, 200)
    
    ' === SITE SECTION ===
    ws.Range("B8").Value = "SITE DETAILS"
    ws.Range("B8").Font.Bold = True
    ws.Range("B8").Font.Size = 11
    ws.Range("B8:H8").Interior.Color = RGB(0, 100, 50)
    ws.Range("B8:H8").Font.Color = RGB(255, 255, 255)
    
    ws.Range("D9").Value = "Site:"
    ws.Range("E9").Interior.Color = RGB(255, 255, 200)
    ws.Range("F9").Value = "Code:"
    ws.Range("G9").Locked = True
    ws.Range("G9").Interior.Color = RGB(240, 240, 240)
    
    ws.Range("D10").Value = "Address:"
    ws.Range("E10").Locked = True
    ws.Range("F10").Value = "City:"
    ws.Range("G10").Locked = True
    
    ws.Range("D11").Value = "Fulfillment:"
    ws.Range("E11").Locked = True
    ws.Range("E11").Font.Bold = True
    
    ws.Range("D12").Value = "Contact:"
    ws.Range("E12").Locked = True
    ws.Range("F12").Value = "Phone:"
    ws.Range("G12").Locked = True
    
    ' === ORDER GRID HEADER ===
    ws.Range("B15").Value = "ORDER ITEMS"
    ws.Range("B15").Font.Bold = True
    ws.Range("B15").Font.Size = 11
    ws.Range("B15:H15").Interior.Color = RGB(0, 100, 50)
    ws.Range("B15:H15").Font.Color = RGB(255, 255, 255)
    
    ws.Range("B16").Value = "Item"
    ws.Range("C16").Value = "SKU"
    ws.Range("D16").Value = "Qty"
    ws.Range("E16").Value = "Unit"
    ws.Range("F16").Value = "Cost"
    ws.Range("G16").Value = "Total"
    ws.Range("H16").Value = "Employee"
    ws.Range("B16:H16").Font.Bold = True
    ws.Range("B16:H16").Interior.Color = RGB(200, 230, 200)
    
    ' === ORDER ROWS ===
    For i = ORDER_START_ROW To ORDER_END_ROW
        ' Row number
        ws.Range("A" & i).Value = i - ORDER_START_ROW + 1
        ws.Range("A" & i).Font.Color = RGB(180, 180, 180)
        ws.Range("A" & i).HorizontalAlignment = xlCenter
        
        ' Item cell (dropdown)
        ws.Range(COL_ITEM & i).Interior.Color = RGB(255, 255, 230)
        
        ' Qty cell
        ws.Range(COL_QTY & i).Interior.Color = RGB(255, 255, 230)
        ws.Range(COL_QTY & i).HorizontalAlignment = xlCenter
        
        ' Auto-fill cells (locked)
        ws.Range(COL_SKU & i).Interior.Color = RGB(245, 245, 245)
        ws.Range(COL_UNIT & i).Interior.Color = RGB(245, 245, 245)
        ws.Range(COL_COST & i).Interior.Color = RGB(245, 245, 245)
        ws.Range(COL_COST & i).NumberFormat = "$#,##0.00"
        
        ' Total formula
        ws.Range(COL_TOTAL & i).Formula = "=IF(" & COL_QTY & i & "<>""""," & COL_QTY & i & "*" & COL_COST & i & ","""")"
        ws.Range(COL_TOTAL & i).NumberFormat = "$#,##0.00"
        ws.Range(COL_TOTAL & i).Interior.Color = RGB(245, 245, 245)
        
        ' Employee (for uniforms)
        ws.Range(COL_EMPLOYEE & i).Interior.Color = RGB(255, 255, 230)
        
        ' Borders
        ws.Range("B" & i & ":H" & i).Borders.LineStyle = xlContinuous
        ws.Range("B" & i & ":H" & i).Borders.Color = RGB(200, 200, 200)
    Next i
    
    ' === TOTALS ROW ===
    Dim totalRow As Long
    totalRow = ORDER_END_ROW + 2
    
    ws.Range("E" & totalRow).Value = "TOTAL ITEMS:"
    ws.Range("E" & totalRow).Font.Bold = True
    ws.Range("F" & totalRow).Formula = "=COUNTA(B" & ORDER_START_ROW & ":B" & ORDER_END_ROW & ")"
    ws.Range("F" & totalRow).Font.Bold = True
    
    ws.Range("E" & (totalRow + 1)).Value = "ORDER TOTAL:"
    ws.Range("E" & (totalRow + 1)).Font.Bold = True
    ws.Range("F" & (totalRow + 1)).Formula = "=SUM(G" & ORDER_START_ROW & ":G" & ORDER_END_ROW & ")"
    ws.Range("F" & (totalRow + 1)).Font.Bold = True
    ws.Range("F" & (totalRow + 1)).NumberFormat = "$#,##0.00"
    ws.Range("F" & (totalRow + 1)).Font.Size = 14
    
    ' === BUTTONS (Shapes) ===
    AddFormButton ws, "I4", "I6", "🔄 REFRESH DATA", "RefreshData", RGB(100, 150, 255)
    AddFormButton ws, "I8", "I10", "📤 SUBMIT ORDER", "SubmitOrder", RGB(0, 150, 50)
    AddFormButton ws, "I12", "I14", "🗑️ CLEAR FORM", "ClearForm", RGB(200, 100, 100)
    
    ' === COLUMN WIDTHS ===
    ws.Columns("A").ColumnWidth = 4
    ws.Columns("B").ColumnWidth = 35
    ws.Columns("C").ColumnWidth = 12
    ws.Columns("D").ColumnWidth = 8
    ws.Columns("E").ColumnWidth = 12
    ws.Columns("F").ColumnWidth = 10
    ws.Columns("G").ColumnWidth = 12
    ws.Columns("H").ColumnWidth = 20
    ws.Columns("I").ColumnWidth = 18
    
    ' Hide employee column initially
    ws.Columns("H").Hidden = True
    
    ' Freeze panes
    ws.Range("B17").Select
    ActiveWindow.FreezePanes = True
    
    Application.ScreenUpdating = True
End Sub

Private Sub AddFormButton(ws As Worksheet, topLeft As String, bottomRight As String, caption As String, macroName As String, btnColor As Long)
    Dim btn As Shape
    
    Set btn = ws.Shapes.AddShape(msoShapeRoundedRectangle, _
        ws.Range(topLeft).Left, ws.Range(topLeft).Top, _
        ws.Range(bottomRight).Left + ws.Range(bottomRight).Width - ws.Range(topLeft).Left, _
        ws.Range(bottomRight).Top + ws.Range(bottomRight).Height - ws.Range(topLeft).Top)
    
    With btn
        .Name = "btn_" & macroName
        .Fill.ForeColor.RGB = btnColor
        .Line.Visible = msoFalse
        .TextFrame2.TextRange.Text = caption
        .TextFrame2.TextRange.Font.Fill.ForeColor.RGB = RGB(255, 255, 255)
        .TextFrame2.TextRange.Font.Size = 12
        .TextFrame2.TextRange.Font.Bold = msoTrue
        .TextFrame2.TextRange.ParagraphFormat.Alignment = msoAlignCenter
        .TextFrame2.VerticalAnchor = msoAnchorMiddle
        .OnAction = macroName
    End With
End Sub

Private Function GetNextVoucherNumber() As Long
    Dim configNum As String
    Dim nextNum As Long
    
    configNum = GetConfig("LAST_VOUCHER")
    If configNum = "" Then
        nextNum = 1001
    Else
        nextNum = CLng(configNum) + 1
    End If
    
    GetNextVoucherNumber = nextNum
End Function

' ============================================================================
' PUBLIC ACTIONS (Called by buttons)
' ============================================================================

Public Sub RefreshData()
    ' Reload all data from API
    
    Application.ScreenUpdating = False
    Application.StatusBar = "Refreshing data..."
    
    LoadSitesFromAPI
    LoadItemsFromAPI
    UpdateItemDropdowns
    
    Application.ScreenUpdating = True
    Application.StatusBar = False
    
    MsgBox "Data refreshed successfully!", vbInformation, "Refresh Complete"
End Sub

Public Sub ClearForm()
    ' Clear the form for a new order
    
    Dim ws As Worksheet
    Dim i As Long
    
    If MsgBox("Clear all order data and start a new order?", vbQuestion + vbYesNo, "Clear Form") = vbNo Then
        Exit Sub
    End If
    
    On Error Resume Next
    Set ws = ThisWorkbook.Sheets(ORDER_SHEET)
    On Error GoTo 0
    
    If ws Is Nothing Then Exit Sub
    
    ' Clear site info
    ws.Range(CELL_SITE_NAME).ClearContents
    ws.Range(CELL_SITE_CODE).ClearContents
    ws.Range(CELL_ADDRESS).ClearContents
    ws.Range(CELL_CITY).ClearContents
    ws.Range(CELL_FULFILLMENT).ClearContents
    ws.Range(CELL_CONTACT).ClearContents
    ws.Range(CELL_PHONE).ClearContents
    
    ' Clear order items
    For i = ORDER_START_ROW To ORDER_END_ROW
        ws.Range(COL_ITEM & i).ClearContents
        ws.Range(COL_SKU & i).ClearContents
        ws.Range(COL_QTY & i).ClearContents
        ws.Range(COL_UNIT & i).ClearContents
        ws.Range(COL_COST & i).ClearContents
        ws.Range(COL_EMPLOYEE & i).ClearContents
    Next i
    
    ' Increment voucher number
    ws.Range(CELL_VOUCHER_NO).Value = GetNextVoucherNumber()
    ws.Range(CELL_DATE).Value = Date
    
    MsgBox "Form cleared. Ready for new order.", vbInformation
End Sub

Public Sub SubmitOrder()
    ' Validate and submit order to API
    
    Dim ws As Worksheet
    Dim siteName As String
    Dim siteCode As String
    Dim category As String
    Dim voucherNo As Long
    Dim i As Long
    Dim hasItems As Boolean
    Dim orderItems As String
    Dim response As String
    
    On Error Resume Next
    Set ws = ThisWorkbook.Sheets(ORDER_SHEET)
    On Error GoTo 0
    
    If ws Is Nothing Then
        MsgBox "Order Form sheet not found!", vbCritical
        Exit Sub
    End If
    
    ' === VALIDATION ===
    category = ws.Range(CELL_CATEGORY).Value
    If Trim(category) = "" Then
        MsgBox "Please select a CATEGORY first.", vbExclamation, "Missing Category"
        ws.Range(CELL_CATEGORY).Select
        Exit Sub
    End If
    
    siteName = ws.Range(CELL_SITE_NAME).Value
    siteCode = ws.Range(CELL_SITE_CODE).Value
    If Trim(siteName) = "" Or Trim(siteCode) = "" Then
        MsgBox "Please select your SITE from the dropdown.", vbExclamation, "Missing Site"
        ws.Range(CELL_SITE_NAME).Select
        Exit Sub
    End If
    
    voucherNo = ws.Range(CELL_VOUCHER_NO).Value
    
    ' Check for items
    hasItems = False
    orderItems = "["
    
    For i = ORDER_START_ROW To ORDER_END_ROW
        Dim itemName As String
        Dim qty As Variant
        Dim sku As String
        Dim employeeName As String
        
        itemName = ws.Range(COL_ITEM & i).Value
        qty = ws.Range(COL_QTY & i).Value
        sku = ws.Range(COL_SKU & i).Value
        employeeName = ws.Range(COL_EMPLOYEE & i).Value
        
        If itemName <> "" And IsNumeric(qty) And qty > 0 Then
            ' Validate employee for uniforms
            If category = "Uniforms" And Trim(employeeName) = "" Then
                MsgBox "Row " & (i - ORDER_START_ROW + 1) & ": Uniform items require an EMPLOYEE NAME in column H.", _
                       vbExclamation, "Missing Employee"
                ws.Range(COL_EMPLOYEE & i).Select
                Exit Sub
            End If
            
            If hasItems Then orderItems = orderItems & ","
            
            orderItems = orderItems & "{" & _
                """sku"":""" & EscapeJSON(sku) & """," & _
                """quantity"":" & CStr(CLng(qty)) & "," & _
                """employee_name"":""" & EscapeJSON(employeeName) & """" & _
                "}"
            
            hasItems = True
        End If
    Next i
    
    orderItems = orderItems & "]"
    
    If Not hasItems Then
        MsgBox "Please add at least ONE ITEM with a quantity.", vbExclamation, "No Items"
        ws.Range(COL_ITEM & ORDER_START_ROW).Select
        Exit Sub
    End If
    
    ' === CONFIRM ===
    If MsgBox("Submit this order?" & vbCrLf & vbCrLf & _
              "Site: " & siteName & vbCrLf & _
              "Category: " & category & vbCrLf & _
              "Voucher: " & voucherNo, _
              vbQuestion + vbYesNo, "Confirm Submission") = vbNo Then
        Exit Sub
    End If
    
    ' === SUBMIT ===
    Application.StatusBar = "Submitting order..."
    
    Dim orderBody As String
    orderBody = "{" & _
        """voucher_number"":""" & CStr(voucherNo) & """," & _
        """site_code"":""" & siteCode & """," & _
        """category"":""" & category & """," & _
        """ordered_by"":""" & EscapeJSON(Application.UserName) & """," & _
        """notes"":""Submitted via Excel Order Form""," & _
        """items"":" & orderItems & _
        "}"
    
    response = CallAPI("/api/excel/orders", "POST", orderBody)
    
    Application.StatusBar = False
    
    If InStr(response, """error""") > 0 Then
        MsgBox "Order submission FAILED!" & vbCrLf & vbCrLf & _
               "Error: " & response & vbCrLf & vbCrLf & _
               "Please check your internet connection and try again.", _
               vbCritical, "Submission Failed"
        Exit Sub
    End If
    
    ' === SUCCESS ===
    ' Save voucher number
    SaveConfig "LAST_VOUCHER", CStr(voucherNo)
    
    ' Parse response for order number
    Dim respDict As Object
    Set respDict = ParseJSONObject(response)
    
    Dim orderNumber As String
    Dim orderStatus As String
    
    If respDict.Exists("order") Then
        Dim orderObj As Object
        Set orderObj = ParseJSONObject("{" & Mid(response, InStr(response, """order"":") + 8))
        orderNumber = orderObj("order_number")
    Else
        orderNumber = CStr(voucherNo)
    End If
    
    MsgBox "ORDER SUBMITTED SUCCESSFULLY!" & vbCrLf & vbCrLf & _
           "Order Number: " & orderNumber & vbCrLf & _
           "Site: " & siteName & vbCrLf & _
           "Category: " & category & vbCrLf & vbCrLf & _
           "Your order has been sent to Head Office for processing.", _
           vbInformation, "Order Submitted"
    
    ' Ask to clear form
    If MsgBox("Would you like to start a new order?", vbQuestion + vbYesNo) = vbYes Then
        ClearForm
    End If
End Sub

' ============================================================================
' WORKSHEET EVENT HANDLERS (Copy to Sheet code module)
' ============================================================================
' To enable auto-fill when selecting from dropdowns:
' 1. In VBA Editor, double-click "Order Form" in the left panel
' 2. Paste this code there:
'
' Private Sub Worksheet_Change(ByVal Target As Range)
'     If Target.Address = Range("E9").Address Then
'         ' Site selected
'         Call OnSiteSelected
'     ElseIf Target.Address = Range("E6").Address Then
'         ' Category changed
'         Call UpdateItemDropdowns
'     ElseIf Not Intersect(Target, Range("B17:B36")) Is Nothing Then
'         ' Item selected
'         Call OnItemSelected(Target.row)
'     End If
' End Sub
' ============================================================================

