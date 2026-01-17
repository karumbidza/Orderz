' ============================================================================
' REDAN SITE ORDER FORM - VBA MODULE
' Connects to Neon Database via Vercel API
' ============================================================================
' INSTRUCTIONS:
' 1. Import this module into your Excel workbook (Alt+F11 > File > Import)
' 2. Set the API_BASE_URL constant to your Vercel deployment URL
' 3. Create the form layout as described in the FormSetup sub
' ============================================================================

Option Explicit

' === CONFIGURATION ===
Private Const API_BASE_URL As String = "https://your-app.vercel.app"  ' Change to your Vercel URL
Private Const API_KEY As String = ""  ' Optional: Add if you enable API authentication

' === SHEET REFERENCES ===
Private Const ORDER_SHEET As String = "Order Form"
Private Const CACHE_SHEET As String = "DataCache"  ' Hidden sheet for dropdown data

' === CELL REFERENCES (New Layout) ===
' Header Section
Private Const CELL_VOUCHER_NO As String = "D3"
Private Const CELL_DATE As String = "D4"
Private Const CELL_CATEGORY As String = "D5"
Private Const CELL_DEPARTMENT As String = "D6"

' Site Section
Private Const CELL_SITE_NAME As String = "D9"
Private Const CELL_SITE_CODE As String = "G9"
Private Const CELL_ADDRESS As String = "D10"
Private Const CELL_CITY As String = "G10"
Private Const CELL_FULFILLMENT As String = "D11"
Private Const CELL_CONTACT As String = "D12"
Private Const CELL_PHONE As String = "G12"
Private Const CELL_TM_EMAIL As String = "D13"

' Employee Section (for Uniforms)
Private Const CELL_EMPLOYEE_NAME As String = "D15"
Private Const CELL_EMPLOYEE_CODE As String = "G15"
Private Const CELL_EMPLOYEE_ROLE As String = "D16"

' Order Grid
Private Const ORDER_START_ROW As Long = 20
Private Const ORDER_END_ROW As Long = 39
Private Const COL_ITEM As String = "B"
Private Const COL_SKU As String = "C"
Private Const COL_QTY As String = "D"
Private Const COL_UNIT As String = "E"
Private Const COL_COST As String = "F"
Private Const COL_TOTAL As String = "G"
Private Const COL_EMPLOYEE As String = "H"  ' For uniform items - employee name

' ============================================================================
' API HELPER FUNCTIONS
' ============================================================================

Private Function CallAPI(endpoint As String, Optional method As String = "GET", Optional body As String = "") As String
    ' Makes HTTP request to the API and returns response
    
    Dim http As Object
    Dim url As String
    
    On Error GoTo ErrorHandler
    
    Set http = CreateObject("MSXML2.XMLHTTP")
    url = API_BASE_URL & endpoint
    
    http.Open method, url, False
    http.setRequestHeader "Content-Type", "application/json"
    http.setRequestHeader "Accept", "application/json"
    
    If API_KEY <> "" Then
        http.setRequestHeader "X-API-Key", API_KEY
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

Private Function ParseJSONArray(json As String, arrayKey As String) As Collection
    ' Simple JSON array parser - extracts array of objects
    ' Returns collection of dictionaries
    
    Dim result As New Collection
    Dim dataStart As Long, dataEnd As Long
    Dim arrayContent As String
    Dim objStart As Long, objEnd As Long
    Dim objContent As String
    Dim dict As Object
    
    ' Find the data array
    dataStart = InStr(json, """" & arrayKey & """:[")
    If dataStart = 0 Then
        dataStart = InStr(json, """" & arrayKey & """: [")
    End If
    
    If dataStart = 0 Then
        ' Try finding just array at start
        If Left(json, 1) = "[" Then
            arrayContent = Mid(json, 2, Len(json) - 2)
        Else
            Set ParseJSONArray = result
            Exit Function
        End If
    Else
        dataStart = InStr(dataStart, json, "[")
        dataEnd = FindMatchingBracket(json, dataStart, "[", "]")
        arrayContent = Mid(json, dataStart + 1, dataEnd - dataStart - 1)
    End If
    
    ' Parse each object in array
    objStart = 1
    Do While objStart < Len(arrayContent)
        objStart = InStr(objStart, arrayContent, "{")
        If objStart = 0 Then Exit Do
        
        objEnd = FindMatchingBracket(arrayContent, objStart, "{", "}")
        objContent = Mid(arrayContent, objStart, objEnd - objStart + 1)
        
        Set dict = ParseJSONObject(objContent)
        If Not dict Is Nothing Then
            result.Add dict
        End If
        
        objStart = objEnd + 1
    Loop
    
    Set ParseJSONArray = result
End Function

Private Function ParseJSONObject(json As String) As Object
    ' Simple JSON object parser - returns Scripting.Dictionary
    
    Dim dict As Object
    Dim content As String
    Dim pairs() As String
    Dim pair As Variant
    Dim key As String
    Dim value As String
    Dim i As Long
    
    On Error GoTo ErrorHandler
    
    Set dict = CreateObject("Scripting.Dictionary")
    
    ' Remove outer braces
    content = Trim(json)
    If Left(content, 1) = "{" Then content = Mid(content, 2)
    If Right(content, 1) = "}" Then content = Left(content, Len(content) - 1)
    
    ' Split by comma (simple - doesn't handle nested objects well)
    i = 1
    Do While i <= Len(content)
        ' Find key
        Dim keyStart As Long, keyEnd As Long
        keyStart = InStr(i, content, """")
        If keyStart = 0 Then Exit Do
        keyEnd = InStr(keyStart + 1, content, """")
        key = Mid(content, keyStart + 1, keyEnd - keyStart - 1)
        
        ' Find value
        Dim colonPos As Long
        colonPos = InStr(keyEnd, content, ":")
        
        Dim valueStart As Long
        valueStart = colonPos + 1
        Do While Mid(content, valueStart, 1) = " "
            valueStart = valueStart + 1
        Loop
        
        ' Determine value type and extract
        Dim valueChar As String
        valueChar = Mid(content, valueStart, 1)
        
        If valueChar = """" Then
            ' String value
            Dim valueEnd As Long
            valueEnd = InStr(valueStart + 1, content, """")
            value = Mid(content, valueStart + 1, valueEnd - valueStart - 1)
            i = valueEnd + 1
        ElseIf valueChar = "{" Or valueChar = "[" Then
            ' Nested object/array - skip for now
            Dim matchEnd As Long
            If valueChar = "{" Then
                matchEnd = FindMatchingBracket(content, valueStart, "{", "}")
            Else
                matchEnd = FindMatchingBracket(content, valueStart, "[", "]")
            End If
            value = Mid(content, valueStart, matchEnd - valueStart + 1)
            i = matchEnd + 1
        Else
            ' Number, boolean, or null
            Dim nextComma As Long
            nextComma = InStr(valueStart, content, ",")
            If nextComma = 0 Then nextComma = Len(content) + 1
            value = Trim(Mid(content, valueStart, nextComma - valueStart))
            ' Remove trailing bracket if present
            If Right(value, 1) = "}" Then value = Left(value, Len(value) - 1)
            i = nextComma
        End If
        
        dict(key) = value
        
        ' Move past comma
        i = InStr(i, content, ",")
        If i = 0 Then Exit Do
        i = i + 1
    Loop
    
    Set ParseJSONObject = dict
    Exit Function
    
ErrorHandler:
    Set ParseJSONObject = Nothing
End Function

Private Function FindMatchingBracket(text As String, startPos As Long, openChar As String, closeChar As String) As Long
    Dim depth As Long
    Dim i As Long
    Dim c As String
    Dim inString As Boolean
    
    depth = 0
    inString = False
    
    For i = startPos To Len(text)
        c = Mid(text, i, 1)
        
        If c = """" And (i = 1 Or Mid(text, i - 1, 1) <> "\") Then
            inString = Not inString
        End If
        
        If Not inString Then
            If c = openChar Then
                depth = depth + 1
            ElseIf c = closeChar Then
                depth = depth - 1
                If depth = 0 Then
                    FindMatchingBracket = i
                    Exit Function
                End If
            End If
        End If
    Next i
    
    FindMatchingBracket = Len(text)
End Function

Private Function BuildJSON(dict As Object) As String
    ' Builds JSON string from dictionary
    
    Dim result As String
    Dim key As Variant
    Dim value As Variant
    Dim first As Boolean
    
    result = "{"
    first = True
    
    For Each key In dict.Keys
        If Not first Then result = result & ","
        first = False
        
        value = dict(key)
        
        If IsNull(value) Or value = "" Then
            result = result & """" & key & """:null"
        ElseIf IsNumeric(value) And Not IsEmpty(value) Then
            result = result & """" & key & """:" & value
        Else
            result = result & """" & key & """:""" & EscapeJSON(CStr(value)) & """"
        End If
    Next key
    
    result = result & "}"
    BuildJSON = result
End Function

Private Function EscapeJSON(text As String) As String
    Dim result As String
    result = Replace(text, "\", "\\")
    result = Replace(result, """", "\""")
    result = Replace(result, vbCrLf, "\n")
    result = Replace(result, vbCr, "\n")
    result = Replace(result, vbLf, "\n")
    result = Replace(result, vbTab, "\t")
    EscapeJSON = result
End Function

' ============================================================================
' DATA LOADING FUNCTIONS
' ============================================================================

Public Sub LoadSitesToCache()
    ' Loads all sites from API to hidden cache sheet
    
    Dim response As String
    Dim sites As Collection
    Dim site As Object
    Dim ws As Worksheet
    Dim row As Long
    
    Application.StatusBar = "Loading sites from database..."
    
    response = CallAPI("/api/sites?limit=200")
    
    If InStr(response, """error""") > 0 Then
        MsgBox "Failed to load sites: " & response, vbCritical
        Application.StatusBar = False
        Exit Sub
    End If
    
    ' Ensure cache sheet exists
    On Error Resume Next
    Set ws = ThisWorkbook.Sheets(CACHE_SHEET)
    On Error GoTo 0
    
    If ws Is Nothing Then
        Set ws = ThisWorkbook.Sheets.Add(After:=ThisWorkbook.Sheets(ThisWorkbook.Sheets.Count))
        ws.Name = CACHE_SHEET
        ws.Visible = xlSheetVeryHidden
    End If
    
    ' Clear existing site data
    ws.Range("A:G").ClearContents
    ws.Range("A1").Value = "site_code"
    ws.Range("B1").Value = "name"
    ws.Range("C1").Value = "address"
    ws.Range("D1").Value = "city"
    ws.Range("E1").Value = "contact_name"
    ws.Range("F1").Value = "phone"
    ws.Range("G1").Value = "email"
    ws.Range("H1").Value = "fulfillment_zone"
    
    Set sites = ParseJSONArray(response, "data")
    
    row = 2
    For Each site In sites
        ws.Cells(row, 1).Value = site("site_code")
        ws.Cells(row, 2).Value = site("name")
        ws.Cells(row, 3).Value = site("address")
        ws.Cells(row, 4).Value = site("city")
        ws.Cells(row, 5).Value = site("contact_name")
        ws.Cells(row, 6).Value = site("phone")
        ws.Cells(row, 7).Value = site("email")
        ws.Cells(row, 8).Value = site("fulfillment_zone")
        row = row + 1
    Next site
    
    ' Update dropdown on Order Form
    UpdateSiteDropdown
    
    Application.StatusBar = "Loaded " & (row - 2) & " sites"
End Sub

Public Sub LoadItemsToCache()
    ' Loads all items from API to hidden cache sheet
    
    Dim response As String
    Dim items As Collection
    Dim item As Object
    Dim ws As Worksheet
    Dim row As Long
    
    Application.StatusBar = "Loading items from database..."
    
    response = CallAPI("/api/items?limit=500")
    
    If InStr(response, """error""") > 0 Then
        MsgBox "Failed to load items: " & response, vbCritical
        Application.StatusBar = False
        Exit Sub
    End If
    
    ' Ensure cache sheet exists
    On Error Resume Next
    Set ws = ThisWorkbook.Sheets(CACHE_SHEET)
    On Error GoTo 0
    
    If ws Is Nothing Then
        Set ws = ThisWorkbook.Sheets.Add(After:=ThisWorkbook.Sheets(ThisWorkbook.Sheets.Count))
        ws.Name = CACHE_SHEET
        ws.Visible = xlSheetVeryHidden
    End If
    
    ' Clear existing item data (columns K onwards)
    ws.Range("K:R").ClearContents
    ws.Range("K1").Value = "sku"
    ws.Range("L1").Value = "product"
    ws.Range("M1").Value = "category"
    ws.Range("N1").Value = "size"
    ws.Range("O1").Value = "unit"
    ws.Range("P1").Value = "cost"
    ws.Range("Q1").Value = "tracking_type"
    ws.Range("R1").Value = "requires_employee"
    
    Set items = ParseJSONArray(response, "data")
    
    row = 2
    For Each item In items
        ws.Cells(row, 11).Value = item("sku")
        ws.Cells(row, 12).Value = item("product")
        ws.Cells(row, 13).Value = item("category")
        ws.Cells(row, 14).Value = item("size")
        ws.Cells(row, 15).Value = item("unit")
        ws.Cells(row, 16).Value = item("cost")
        ws.Cells(row, 17).Value = item("tracking_type")
        ws.Cells(row, 18).Value = item("requires_employee")
        row = row + 1
    Next item
    
    Application.StatusBar = "Loaded " & (row - 2) & " items"
End Sub

Public Sub LoadEmployeesToCache()
    ' Loads employees for uniform assignments
    
    Dim response As String
    Dim employees As Collection
    Dim emp As Object
    Dim ws As Worksheet
    Dim row As Long
    
    Application.StatusBar = "Loading employees from database..."
    
    response = CallAPI("/api/employees?status=ACTIVE&limit=500")
    
    If InStr(response, """error""") > 0 Then
        Application.StatusBar = "Failed to load employees"
        Exit Sub
    End If
    
    On Error Resume Next
    Set ws = ThisWorkbook.Sheets(CACHE_SHEET)
    On Error GoTo 0
    
    If ws Is Nothing Then Exit Sub
    
    ' Clear existing employee data (columns T onwards)
    ws.Range("T:X").ClearContents
    ws.Range("T1").Value = "employee_code"
    ws.Range("U1").Value = "first_name"
    ws.Range("V1").Value = "last_name"
    ws.Range("W1").Value = "site_code"
    ws.Range("X1").Value = "role"
    
    Set employees = ParseJSONArray(response, "data")
    
    row = 2
    For Each emp In employees
        ws.Cells(row, 20).Value = emp("employee_code")
        ws.Cells(row, 21).Value = emp("first_name")
        ws.Cells(row, 22).Value = emp("last_name")
        ws.Cells(row, 23).Value = emp("site_code")
        ws.Cells(row, 24).Value = emp("role")
        row = row + 1
    Next emp
    
    Application.StatusBar = "Loaded " & (row - 2) & " employees"
End Sub

Public Sub RefreshAllData()
    ' Reloads all data from API
    
    Application.ScreenUpdating = False
    LoadSitesToCache
    LoadItemsToCache
    LoadEmployeesToCache
    Application.ScreenUpdating = True
    
    MsgBox "Data refreshed from database!", vbInformation
    Application.StatusBar = False
End Sub

' ============================================================================
' DROPDOWN MANAGEMENT
' ============================================================================

Private Sub UpdateSiteDropdown()
    ' Updates the Site Name dropdown from cache
    
    Dim ws As Worksheet
    Dim orderSheet As Worksheet
    Dim lastRow As Long
    Dim siteRange As String
    
    On Error Resume Next
    Set ws = ThisWorkbook.Sheets(CACHE_SHEET)
    Set orderSheet = ThisWorkbook.Sheets(ORDER_SHEET)
    On Error GoTo 0
    
    If ws Is Nothing Or orderSheet Is Nothing Then Exit Sub
    
    lastRow = ws.Cells(ws.Rows.Count, "B").End(xlUp).row
    If lastRow < 2 Then Exit Sub
    
    siteRange = CACHE_SHEET & "!$B$2:$B$" & lastRow
    
    With orderSheet.Range(CELL_SITE_NAME).Validation
        .Delete
        .Add Type:=xlValidateList, AlertStyle:=xlValidAlertStop, Formula1:="=" & siteRange
        .IgnoreBlank = True
        .InCellDropdown = True
    End With
End Sub

Public Sub UpdateItemDropdownsForCategory()
    ' Updates item dropdowns based on selected category
    
    Dim ws As Worksheet
    Dim orderSheet As Worksheet
    Dim category As String
    Dim lastRow As Long
    Dim i As Long
    Dim itemList As String
    
    On Error Resume Next
    Set ws = ThisWorkbook.Sheets(CACHE_SHEET)
    Set orderSheet = ThisWorkbook.Sheets(ORDER_SHEET)
    On Error GoTo 0
    
    If ws Is Nothing Or orderSheet Is Nothing Then Exit Sub
    
    category = orderSheet.Range(CELL_CATEGORY).Value
    
    ' Build comma-separated list of items for this category
    lastRow = ws.Cells(ws.Rows.Count, "K").End(xlUp).row
    itemList = ""
    
    For i = 2 To lastRow
        If category = "" Or ws.Cells(i, 13).Value = category Then
            Dim displayName As String
            displayName = ws.Cells(i, 12).Value  ' Product name
            If ws.Cells(i, 14).Value <> "" Then
                displayName = displayName & " (" & ws.Cells(i, 14).Value & ")"  ' Add size
            End If
            
            If itemList = "" Then
                itemList = displayName
            Else
                itemList = itemList & "," & displayName
            End If
        End If
    Next i
    
    ' Apply to all item cells in order grid
    For i = ORDER_START_ROW To ORDER_END_ROW
        With orderSheet.Range(COL_ITEM & i).Validation
            .Delete
            If itemList <> "" Then
                .Add Type:=xlValidateList, AlertStyle:=xlValidAlertStop, Formula1:=itemList
                .IgnoreBlank = True
                .InCellDropdown = True
            End If
        End With
    Next i
End Sub

' ============================================================================
' EVENT HANDLERS (Place in Sheet code module)
' ============================================================================

' === COPY THIS TO THE ORDER FORM SHEET CODE MODULE ===
' Private Sub Worksheet_Change(ByVal Target As Range)
'     On Error GoTo ExitHandler
'     Application.EnableEvents = False
'     
'     ' Handle Site selection
'     If Not Intersect(Target, Range("D9")) Is Nothing Then
'         Call FillSiteDetails
'     End If
'     
'     ' Handle Category change
'     If Not Intersect(Target, Range("D5")) Is Nothing Then
'         Call UpdateItemDropdownsForCategory
'         Call ToggleEmployeeSection
'     End If
'     
'     ' Handle Item selection - fill SKU, unit, cost
'     If Not Intersect(Target, Range("B20:B39")) Is Nothing Then
'         Call FillItemDetails(Target.row)
'     End If
'     
' ExitHandler:
'     Application.EnableEvents = True
' End Sub

Public Sub FillSiteDetails()
    ' When site is selected, fill in address, phone, contact, etc.
    
    Dim ws As Worksheet
    Dim orderSheet As Worksheet
    Dim siteName As String
    Dim i As Long
    Dim lastRow As Long
    
    On Error Resume Next
    Set ws = ThisWorkbook.Sheets(CACHE_SHEET)
    Set orderSheet = ThisWorkbook.Sheets(ORDER_SHEET)
    On Error GoTo 0
    
    If ws Is Nothing Or orderSheet Is Nothing Then Exit Sub
    
    siteName = orderSheet.Range(CELL_SITE_NAME).Value
    If siteName = "" Then
        ' Clear site details
        orderSheet.Range(CELL_SITE_CODE).Value = ""
        orderSheet.Range(CELL_ADDRESS).Value = ""
        orderSheet.Range(CELL_CITY).Value = ""
        orderSheet.Range(CELL_FULFILLMENT).Value = ""
        orderSheet.Range(CELL_CONTACT).Value = ""
        orderSheet.Range(CELL_PHONE).Value = ""
        orderSheet.Range(CELL_TM_EMAIL).Value = ""
        Exit Sub
    End If
    
    lastRow = ws.Cells(ws.Rows.Count, "B").End(xlUp).row
    
    For i = 2 To lastRow
        If ws.Cells(i, 2).Value = siteName Then
            orderSheet.Range(CELL_SITE_CODE).Value = ws.Cells(i, 1).Value
            orderSheet.Range(CELL_ADDRESS).Value = ws.Cells(i, 3).Value
            orderSheet.Range(CELL_CITY).Value = ws.Cells(i, 4).Value
            orderSheet.Range(CELL_CONTACT).Value = ws.Cells(i, 5).Value
            orderSheet.Range(CELL_PHONE).Value = ws.Cells(i, 6).Value
            orderSheet.Range(CELL_TM_EMAIL).Value = ws.Cells(i, 7).Value
            
            ' Set fulfillment message based on zone
            If ws.Cells(i, 8).Value = "COLLECTION" Then
                orderSheet.Range(CELL_FULFILLMENT).Value = "Ready for collection at Head Office"
            Else
                orderSheet.Range(CELL_FULFILLMENT).Value = "Will be dispatched to site"
            End If
            
            ' Load employees for this site
            Call LoadEmployeesForSite(ws.Cells(i, 1).Value)
            Exit For
        End If
    Next i
End Sub

Private Sub LoadEmployeesForSite(siteCode As String)
    ' Filters employee dropdown to selected site
    
    Dim ws As Worksheet
    Dim orderSheet As Worksheet
    Dim lastRow As Long
    Dim i As Long
    Dim empList As String
    
    On Error Resume Next
    Set ws = ThisWorkbook.Sheets(CACHE_SHEET)
    Set orderSheet = ThisWorkbook.Sheets(ORDER_SHEET)
    On Error GoTo 0
    
    If ws Is Nothing Or orderSheet Is Nothing Then Exit Sub
    
    lastRow = ws.Cells(ws.Rows.Count, "T").End(xlUp).row
    empList = ""
    
    For i = 2 To lastRow
        If ws.Cells(i, 23).Value = siteCode Or siteCode = "" Then
            Dim empName As String
            empName = ws.Cells(i, 21).Value & " " & ws.Cells(i, 22).Value
            If empList = "" Then
                empList = empName
            Else
                empList = empList & "," & empName
            End If
        End If
    Next i
    
    ' Update employee dropdown
    With orderSheet.Range(CELL_EMPLOYEE_NAME).Validation
        .Delete
        If empList <> "" Then
            .Add Type:=xlValidateList, AlertStyle:=xlValidAlertStop, Formula1:=empList
            .IgnoreBlank = True
            .InCellDropdown = True
        End If
    End With
    
    ' Also update employee column in grid for uniform items
    For i = ORDER_START_ROW To ORDER_END_ROW
        With orderSheet.Range(COL_EMPLOYEE & i).Validation
            .Delete
            If empList <> "" Then
                .Add Type:=xlValidateList, AlertStyle:=xlValidAlertStop, Formula1:=empList
                .IgnoreBlank = True
                .InCellDropdown = True
            End If
        End With
    Next i
End Sub

Public Sub FillItemDetails(row As Long)
    ' When item is selected, fill SKU, unit, cost
    
    Dim ws As Worksheet
    Dim orderSheet As Worksheet
    Dim itemName As String
    Dim i As Long
    Dim lastRow As Long
    
    On Error Resume Next
    Set ws = ThisWorkbook.Sheets(CACHE_SHEET)
    Set orderSheet = ThisWorkbook.Sheets(ORDER_SHEET)
    On Error GoTo 0
    
    If ws Is Nothing Or orderSheet Is Nothing Then Exit Sub
    
    itemName = orderSheet.Range(COL_ITEM & row).Value
    If itemName = "" Then Exit Sub
    
    ' Extract base product name (remove size in parentheses)
    Dim baseName As String
    Dim parenPos As Long
    parenPos = InStr(itemName, " (")
    If parenPos > 0 Then
        baseName = Left(itemName, parenPos - 1)
    Else
        baseName = itemName
    End If
    
    lastRow = ws.Cells(ws.Rows.Count, "K").End(xlUp).row
    
    For i = 2 To lastRow
        Dim displayName As String
        displayName = ws.Cells(i, 12).Value
        If ws.Cells(i, 14).Value <> "" Then
            displayName = displayName & " (" & ws.Cells(i, 14).Value & ")"
        End If
        
        If displayName = itemName Or ws.Cells(i, 12).Value = baseName Then
            orderSheet.Range(COL_SKU & row).Value = ws.Cells(i, 11).Value
            orderSheet.Range(COL_UNIT & row).Value = ws.Cells(i, 15).Value
            orderSheet.Range(COL_COST & row).Value = ws.Cells(i, 16).Value
            
            ' Show/require employee column if item requires employee
            If ws.Cells(i, 18).Value = "true" Or ws.Cells(i, 18).Value = True Then
                orderSheet.Range(COL_EMPLOYEE & row).Interior.Color = RGB(255, 255, 200)  ' Yellow highlight
            Else
                orderSheet.Range(COL_EMPLOYEE & row).Interior.ColorIndex = xlNone
            End If
            Exit For
        End If
    Next i
End Sub

Public Sub ToggleEmployeeSection()
    ' Shows/hides employee section based on category
    
    Dim orderSheet As Worksheet
    Dim category As String
    
    On Error Resume Next
    Set orderSheet = ThisWorkbook.Sheets(ORDER_SHEET)
    On Error GoTo 0
    
    If orderSheet Is Nothing Then Exit Sub
    
    category = orderSheet.Range(CELL_CATEGORY).Value
    
    ' Show employee section for Uniforms
    If category = "Uniforms" Then
        orderSheet.Rows("15:16").Hidden = False
        orderSheet.Columns("H").Hidden = False  ' Employee column in grid
    Else
        orderSheet.Rows("15:16").Hidden = True
        orderSheet.Columns("H").Hidden = True
    End If
End Sub

' ============================================================================
' ORDER SUBMISSION
' ============================================================================

Public Sub SubmitOrder()
    ' Validates and submits order to API, then emails PDF
    
    Dim orderSheet As Worksheet
    Dim siteCode As String
    Dim siteName As String
    Dim category As String
    Dim voucherNo As Long
    Dim orderItems As String
    Dim i As Long
    Dim hasItems As Boolean
    Dim response As String
    Dim orderId As Long
    
    On Error Resume Next
    Set orderSheet = ThisWorkbook.Sheets(ORDER_SHEET)
    On Error GoTo 0
    
    If orderSheet Is Nothing Then
        MsgBox "Order Form sheet not found!", vbCritical
        Exit Sub
    End If
    
    ' === VALIDATION ===
    siteName = orderSheet.Range(CELL_SITE_NAME).Value
    siteCode = orderSheet.Range(CELL_SITE_CODE).Value
    category = orderSheet.Range(CELL_CATEGORY).Value
    voucherNo = orderSheet.Range(CELL_VOUCHER_NO).Value
    
    If Trim(siteName) = "" Then
        MsgBox "Please select a site", vbExclamation, "Missing Site"
        orderSheet.Range(CELL_SITE_NAME).Select
        Exit Sub
    End If
    
    If Trim(category) = "" Then
        MsgBox "Please select a category", vbExclamation, "Missing Category"
        orderSheet.Range(CELL_CATEGORY).Select
        Exit Sub
    End If
    
    ' Check for items
    hasItems = False
    orderItems = "["
    
    For i = ORDER_START_ROW To ORDER_END_ROW
        Dim itemName As String
        Dim qty As Variant
        Dim sku As String
        Dim employeeName As String
        
        itemName = orderSheet.Range(COL_ITEM & i).Value
        qty = orderSheet.Range(COL_QTY & i).Value
        sku = orderSheet.Range(COL_SKU & i).Value
        employeeName = orderSheet.Range(COL_EMPLOYEE & i).Value
        
        If itemName <> "" And IsNumeric(qty) And qty > 0 Then
            If hasItems Then orderItems = orderItems & ","
            
            Dim itemDict As Object
            Set itemDict = CreateObject("Scripting.Dictionary")
            itemDict("sku") = sku
            itemDict("product") = itemName
            itemDict("quantity") = qty
            itemDict("employee_name") = employeeName
            
            orderItems = orderItems & BuildJSON(itemDict)
            hasItems = True
        End If
    Next i
    
    orderItems = orderItems & "]"
    
    If Not hasItems Then
        MsgBox "Please add at least one item with quantity", vbExclamation, "No Items"
        Exit Sub
    End If
    
    ' Check employee for uniform orders
    If category = "Uniforms" Then
        Dim missingEmployee As Boolean
        missingEmployee = False
        For i = ORDER_START_ROW To ORDER_END_ROW
            If orderSheet.Range(COL_ITEM & i).Value <> "" And _
               orderSheet.Range(COL_QTY & i).Value > 0 And _
               Trim(orderSheet.Range(COL_EMPLOYEE & i).Value) = "" Then
                missingEmployee = True
                Exit For
            End If
        Next i
        
        If missingEmployee Then
            MsgBox "Uniform orders require employee name for each item", vbExclamation, "Missing Employee"
            Exit Sub
        End If
    End If
    
    ' === SUBMIT TO API ===
    Application.StatusBar = "Submitting order to database..."
    
    ' Build JSON body matching API format:
    ' {"voucher_number":"...", "site_code":"...", "category":"...", "ordered_by":"...", "notes":"...", "items":[...]}
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
    
    If InStr(response, """error""") > 0 Then
        MsgBox "Failed to submit order: " & response, vbCritical
        Application.StatusBar = False
        Exit Sub
    End If
    
    ' Extract order ID from response
    Dim respDict As Object
    Set respDict = ParseJSONObject(response)
    If respDict.Exists("id") Then
        orderId = CLng(respDict("id"))
    Else
        orderId = voucherNo  ' Fallback
    End If
    
    Application.StatusBar = "Order #" & orderId & " submitted successfully!"
    
    ' === GENERATE PDF AND EMAIL ===
    Call GenerateAndEmailPDF(siteName, category, voucherNo)
    
    ' === CLEAR FORM ===
    Call ClearOrderForm
    
    ' Increment voucher number
    orderSheet.Range(CELL_VOUCHER_NO).Value = voucherNo + 1
    
    MsgBox "Order #" & orderId & " submitted and emailed successfully!" & vbCrLf & _
           "— Powered by Orderz API", vbInformation
    
    Application.StatusBar = False
End Sub

Private Sub GenerateAndEmailPDF(siteName As String, category As String, voucherNo As Long)
    ' Exports PDF and emails it
    
    Dim orderSheet As Worksheet
    Dim filePath As String
    Dim fileName As String
    Dim fullPath As String
    Dim tmEmail As String
    Dim sanitizedSite As String
    
    Set orderSheet = ThisWorkbook.Sheets(ORDER_SHEET)
    
    ' Sanitize site name for filename
    sanitizedSite = siteName
    Dim ch As Variant
    For Each ch In Array("\", "/", ":", "*", "?", """", "<", ">", "|")
        sanitizedSite = Replace(sanitizedSite, ch, "_")
    Next ch
    
    ' Generate file path
    filePath = Environ$("TEMP") & "\"
    fileName = voucherNo & "_" & sanitizedSite & ".pdf"
    fullPath = filePath & fileName
    
    On Error GoTo PDFError
    orderSheet.ExportAsFixedFormat Type:=xlTypePDF, fileName:=fullPath, IgnorePrintAreas:=False
    On Error GoTo 0
    
    ' Email PDF
    tmEmail = orderSheet.Range(CELL_TM_EMAIL).Value
    
    On Error Resume Next
    Dim OutlookApp As Object
    Dim OutlookMail As Object
    
    Set OutlookApp = CreateObject("Outlook.Application")
    Set OutlookMail = OutlookApp.CreateItem(0)
    
    With OutlookMail
        Select Case UCase(Trim(category))
            Case "HSSE", "PPE"
                .To = "bridget.sibanda@redan.co.zw"
            Case Else
                .To = "allen.karumbidza@redan.co.zw"
        End Select
        
        If tmEmail <> "" Then .CC = tmEmail
        
        .Subject = category & " Request #" & voucherNo & " - " & siteName
        
        Dim fulfillment As String
        fulfillment = orderSheet.Range(CELL_FULFILLMENT).Value
        
        .body = "Good day," & vbCrLf & vbCrLf & _
                "Please find attached the " & category & " request for " & siteName & "." & vbCrLf & vbCrLf & _
                "Fulfillment: " & fulfillment & vbCrLf & vbCrLf & _
                "This order has been recorded in the Orderz system." & vbCrLf & vbCrLf & _
                "Regards," & vbCrLf & Application.UserName
        
        .Attachments.Add fullPath
        .Send
    End With
    
    Set OutlookMail = Nothing
    Set OutlookApp = Nothing
    On Error GoTo 0
    
    Exit Sub
    
PDFError:
    MsgBox "Error generating PDF: " & Err.Description, vbExclamation
End Sub

Public Sub ClearOrderForm()
    ' Clears the order form for next entry
    
    Dim orderSheet As Worksheet
    Dim i As Long
    
    On Error Resume Next
    Set orderSheet = ThisWorkbook.Sheets(ORDER_SHEET)
    On Error GoTo 0
    
    If orderSheet Is Nothing Then Exit Sub
    
    ' Clear header (except voucher number)
    orderSheet.Range(CELL_CATEGORY).ClearContents
    orderSheet.Range(CELL_DEPARTMENT).ClearContents
    
    ' Clear site section
    orderSheet.Range(CELL_SITE_NAME).ClearContents
    orderSheet.Range(CELL_SITE_CODE).ClearContents
    orderSheet.Range(CELL_ADDRESS).ClearContents
    orderSheet.Range(CELL_CITY).ClearContents
    orderSheet.Range(CELL_FULFILLMENT).ClearContents
    orderSheet.Range(CELL_CONTACT).ClearContents
    orderSheet.Range(CELL_PHONE).ClearContents
    orderSheet.Range(CELL_TM_EMAIL).ClearContents
    
    ' Clear employee section
    orderSheet.Range(CELL_EMPLOYEE_NAME).ClearContents
    orderSheet.Range(CELL_EMPLOYEE_CODE).ClearContents
    orderSheet.Range(CELL_EMPLOYEE_ROLE).ClearContents
    
    ' Clear order grid
    For i = ORDER_START_ROW To ORDER_END_ROW
        orderSheet.Range(COL_ITEM & i & ":" & COL_EMPLOYEE & i).ClearContents
        orderSheet.Range(COL_EMPLOYEE & i).Interior.ColorIndex = xlNone
    Next i
    
    ' Reset date
    orderSheet.Range(CELL_DATE).Value = Date
    
    ' Save
    ThisWorkbook.Save
End Sub

' ============================================================================
' FORM SETUP (Run once to create layout)
' ============================================================================

Public Sub SetupOrderForm()
    ' Creates the order form layout - run this once
    
    Dim ws As Worksheet
    Dim i As Long
    
    ' Create or get Order Form sheet
    On Error Resume Next
    Set ws = ThisWorkbook.Sheets(ORDER_SHEET)
    On Error GoTo 0
    
    If ws Is Nothing Then
        Set ws = ThisWorkbook.Sheets.Add(Before:=ThisWorkbook.Sheets(1))
        ws.Name = ORDER_SHEET
    End If
    
    ws.Cells.ClearContents
    ws.Cells.ClearFormats
    
    ' === HEADER ===
    ws.Range("B2").Value = "Redan"
    ws.Range("B2").Font.Size = 24
    ws.Range("B2").Font.Bold = True
    ws.Range("B2").Font.Color = RGB(0, 100, 0)
    
    ws.Range("F2").Value = "Request Voucher"
    ws.Range("F2").Font.Size = 20
    ws.Range("F2").Font.Bold = True
    
    ' Voucher details
    ws.Range("C3").Value = "Voucher No:"
    ws.Range("D3").Value = 1001  ' Starting number
    ws.Range("C4").Value = "Date:"
    ws.Range("D4").Value = Date
    ws.Range("C5").Value = "Category:"
    ws.Range("C6").Value = "Department:"
    
    ' Category dropdown
    With ws.Range("D5").Validation
        .Delete
        .Add Type:=xlValidateList, Formula1:="Uniforms,PPE,Stationery,Consumable,HSSE"
    End With
    
    ' === SITE SECTION ===
    ws.Range("B8").Value = "Site Details"
    ws.Range("B8").Font.Bold = True
    ws.Range("B8").Font.Size = 12
    
    ws.Range("C9").Value = "Site Name:"
    ws.Range("F9").Value = "Code:"
    ws.Range("C10").Value = "Address:"
    ws.Range("F10").Value = "City:"
    ws.Range("C11").Value = "Fulfillment:"
    ws.Range("C12").Value = "Contact:"
    ws.Range("F12").Value = "Phone:"
    ws.Range("C13").Value = "TM Email:"
    
    ' === EMPLOYEE SECTION (Initially hidden) ===
    ws.Range("B14").Value = "Employee (for Uniforms)"
    ws.Range("B14").Font.Bold = True
    ws.Range("C15").Value = "Employee:"
    ws.Range("F15").Value = "Code:"
    ws.Range("C16").Value = "Role:"
    
    ' === ORDER GRID ===
    ws.Range("B18").Value = "Order Items"
    ws.Range("B18").Font.Bold = True
    ws.Range("B18").Font.Size = 12
    
    ' Headers
    ws.Range("B19").Value = "Item"
    ws.Range("C19").Value = "SKU"
    ws.Range("D19").Value = "Qty"
    ws.Range("E19").Value = "Unit"
    ws.Range("F19").Value = "Cost"
    ws.Range("G19").Value = "Total"
    ws.Range("H19").Value = "Employee"
    
    ws.Range("B19:H19").Font.Bold = True
    ws.Range("B19:H19").Interior.Color = RGB(0, 100, 0)
    ws.Range("B19:H19").Font.Color = RGB(255, 255, 255)
    
    ' Row numbers
    For i = ORDER_START_ROW To ORDER_END_ROW
        ws.Range("A" & i).Value = i - ORDER_START_ROW + 1
        ws.Range("A" & i).Font.Color = RGB(150, 150, 150)
        
        ' Total formula
        ws.Range("G" & i).Formula = "=IF(D" & i & "<>"""",D" & i & "*F" & i & ","""")"
    Next i
    
    ' === TOTALS ===
    ws.Range("F" & (ORDER_END_ROW + 2)).Value = "TOTAL:"
    ws.Range("F" & (ORDER_END_ROW + 2)).Font.Bold = True
    ws.Range("G" & (ORDER_END_ROW + 2)).Formula = "=SUM(G" & ORDER_START_ROW & ":G" & ORDER_END_ROW & ")"
    ws.Range("G" & (ORDER_END_ROW + 2)).Font.Bold = True
    
    ' === BUTTONS ===
    ws.Range("I3").Value = "🔄 Refresh Data"
    ws.Range("I5").Value = "📤 Submit Order"
    ws.Range("I7").Value = "🗑️ Clear Form"
    
    ' Column widths
    ws.Columns("A").ColumnWidth = 4
    ws.Columns("B").ColumnWidth = 30
    ws.Columns("C").ColumnWidth = 15
    ws.Columns("D").ColumnWidth = 8
    ws.Columns("E").ColumnWidth = 8
    ws.Columns("F").ColumnWidth = 10
    ws.Columns("G").ColumnWidth = 12
    ws.Columns("H").ColumnWidth = 20
    
    ' Hide employee rows initially
    ws.Rows("14:16").Hidden = True
    ws.Columns("H").Hidden = True
    
    MsgBox "Order Form setup complete!" & vbCrLf & vbCrLf & _
           "Next steps:" & vbCrLf & _
           "1. Update API_BASE_URL in the VBA module" & vbCrLf & _
           "2. Run RefreshAllData to load sites/items" & vbCrLf & _
           "3. Add buttons linked to macros", vbInformation
End Sub

' ============================================================================
' QUICK ACTIONS (Assign to buttons)
' ============================================================================

Public Sub Button_RefreshData()
    Call RefreshAllData
End Sub

Public Sub Button_SubmitOrder()
    Call SubmitOrder
End Sub

Public Sub Button_ClearForm()
    If MsgBox("Clear all form data?", vbQuestion + vbYesNo) = vbYes Then
        Call ClearOrderForm
    End If
End Sub
