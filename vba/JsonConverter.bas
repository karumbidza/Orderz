Attribute VB_Name = "JsonConverter"
''
' VBA-JSON v2.3.1
' (c) Tim Hall - https://github.com/VBA-tools/VBA-JSON
'
' JSON Converter for VBA
'
' Errors:
' 10001 - JSON parse error
'
' @class JsonConverter
' @author tim.hall.engr@gmail.com
' @license MIT (http://www.opensource.org/licenses/mit-license.php)
'' ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ '
'
' Based originally on vba-json (Google Code Archive)
' and other projects.
'
' ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ '
Option Explicit

' --------------------------------------------- '
' Constants and Private Variables
' --------------------------------------------- '

Private Const json_QUOTE As String = """"

' ============================================= '
' Public Methods
' ============================================= '

''
' Convert JSON string to object (Dictionary/Collection)
'
Public Function ParseJson(ByVal JsonString As String) As Object
    Dim json_Index As Long
    json_Index = 1

    ' Remove BOM if present
    If Left$(JsonString, 1) = Chr$(65279) Then
        JsonString = Right$(JsonString, Len(JsonString) - 1)
    End If

    ' Remove whitespace at start
    Call json_SkipWhitespace(JsonString, json_Index)
    
    Select Case Mid$(JsonString, json_Index, 1)
        Case "{"
            Set ParseJson = json_ParseObject(JsonString, json_Index)
        Case "["
            Set ParseJson = json_ParseArray(JsonString, json_Index)
        Case Else
            Err.Raise 10001, "JSONConverter", "JSON parse error: Expected '{' or '['"
    End Select
End Function

''
' Convert object to JSON string
'
Public Function ConvertToJson(ByVal JsonValue As Variant, Optional ByVal Whitespace As Integer = 0) As String
    Dim json_buffer As String
    Dim json_Key As Variant
    Dim json_Index As Long
    Dim json_Value As Variant
    
    Select Case VarType(JsonValue)
        Case vbNull, vbEmpty
            ConvertToJson = "null"
        Case vbString
            ConvertToJson = json_QUOTE & json_Escape(JsonValue) & json_QUOTE
        Case vbBoolean
            If JsonValue Then
                ConvertToJson = "true"
            Else
                ConvertToJson = "false"
            End If
        Case vbInteger, vbLong, vbSingle, vbDouble, vbCurrency, vbDecimal
            ConvertToJson = Replace(CStr(JsonValue), ",", ".")
        Case vbObject
            If JsonValue Is Nothing Then
                ConvertToJson = "null"
            ElseIf TypeName(JsonValue) = "Dictionary" Then
                json_buffer = "{"
                json_Index = 0
                For Each json_Key In JsonValue.Keys
                    If json_Index > 0 Then json_buffer = json_buffer & ","
                    json_buffer = json_buffer & json_QUOTE & json_Key & json_QUOTE & ":" & ConvertToJson(JsonValue(json_Key), Whitespace)
                    json_Index = json_Index + 1
                Next json_Key
                ConvertToJson = json_buffer & "}"
            ElseIf TypeName(JsonValue) = "Collection" Then
                json_buffer = "["
                json_Index = 0
                For Each json_Value In JsonValue
                    If json_Index > 0 Then json_buffer = json_buffer & ","
                    json_buffer = json_buffer & ConvertToJson(json_Value, Whitespace)
                    json_Index = json_Index + 1
                Next json_Value
                ConvertToJson = json_buffer & "]"
            End If
        Case Else
            ConvertToJson = json_QUOTE & CStr(JsonValue) & json_QUOTE
    End Select
End Function

' ============================================= '
' Private Methods
' ============================================= '

Private Function json_ParseObject(ByRef JsonString As String, ByRef json_Index As Long) As Object
    Dim json_Key As String
    Dim json_Object As Object
    
    Set json_Object = CreateObject("Scripting.Dictionary")
    
    ' Skip opening brace
    json_Index = json_Index + 1
    Call json_SkipWhitespace(JsonString, json_Index)
    
    ' Check for empty object
    If Mid$(JsonString, json_Index, 1) = "}" Then
        json_Index = json_Index + 1
        Set json_ParseObject = json_Object
        Exit Function
    End If
    
    Do
        Call json_SkipWhitespace(JsonString, json_Index)
        
        ' Get key
        json_Key = json_ParseString(JsonString, json_Index)
        
        Call json_SkipWhitespace(JsonString, json_Index)
        
        ' Skip colon
        If Mid$(JsonString, json_Index, 1) <> ":" Then
            Err.Raise 10001, "JSONConverter", "JSON parse error: Expected ':'"
        End If
        json_Index = json_Index + 1
        
        Call json_SkipWhitespace(JsonString, json_Index)
        
        ' Get value
        json_Object(json_Key) = json_ParseValue(JsonString, json_Index)
        
        Call json_SkipWhitespace(JsonString, json_Index)
        
        ' Check for more items or end
        Select Case Mid$(JsonString, json_Index, 1)
            Case ","
                json_Index = json_Index + 1
            Case "}"
                json_Index = json_Index + 1
                Exit Do
            Case Else
                Err.Raise 10001, "JSONConverter", "JSON parse error: Expected ',' or '}'"
        End Select
    Loop
    
    Set json_ParseObject = json_Object
End Function

Private Function json_ParseArray(ByRef JsonString As String, ByRef json_Index As Long) As Object
    Dim json_Array As Object
    
    Set json_Array = New Collection
    
    ' Skip opening bracket
    json_Index = json_Index + 1
    Call json_SkipWhitespace(JsonString, json_Index)
    
    ' Check for empty array
    If Mid$(JsonString, json_Index, 1) = "]" Then
        json_Index = json_Index + 1
        Set json_ParseArray = json_Array
        Exit Function
    End If
    
    Do
        Call json_SkipWhitespace(JsonString, json_Index)
        
        ' Get value
        json_Array.Add json_ParseValue(JsonString, json_Index)
        
        Call json_SkipWhitespace(JsonString, json_Index)
        
        ' Check for more items or end
        Select Case Mid$(JsonString, json_Index, 1)
            Case ","
                json_Index = json_Index + 1
            Case "]"
                json_Index = json_Index + 1
                Exit Do
            Case Else
                Err.Raise 10001, "JSONConverter", "JSON parse error: Expected ',' or ']'"
        End Select
    Loop
    
    Set json_ParseArray = json_Array
End Function

Private Function json_ParseValue(ByRef JsonString As String, ByRef json_Index As Long) As Variant
    Call json_SkipWhitespace(JsonString, json_Index)
    
    Select Case Mid$(JsonString, json_Index, 1)
        Case json_QUOTE
            json_ParseValue = json_ParseString(JsonString, json_Index)
        Case "{"
            Set json_ParseValue = json_ParseObject(JsonString, json_Index)
        Case "["
            Set json_ParseValue = json_ParseArray(JsonString, json_Index)
        Case "t", "f"
            json_ParseValue = json_ParseBoolean(JsonString, json_Index)
        Case "n"
            json_ParseValue = json_ParseNull(JsonString, json_Index)
        Case Else
            json_ParseValue = json_ParseNumber(JsonString, json_Index)
    End Select
End Function

Private Function json_ParseString(ByRef JsonString As String, ByRef json_Index As Long) As String
    Dim json_Char As String
    Dim json_buffer As String
    
    ' Skip opening quote
    json_Index = json_Index + 1
    
    Do
        json_Char = Mid$(JsonString, json_Index, 1)
        
        Select Case json_Char
            Case json_QUOTE
                json_Index = json_Index + 1
                Exit Do
            Case "\"
                json_Index = json_Index + 1
                json_Char = Mid$(JsonString, json_Index, 1)
                
                Select Case json_Char
                    Case json_QUOTE, "\", "/"
                        json_buffer = json_buffer & json_Char
                    Case "b"
                        json_buffer = json_buffer & Chr$(8)
                    Case "f"
                        json_buffer = json_buffer & Chr$(12)
                    Case "n"
                        json_buffer = json_buffer & vbLf
                    Case "r"
                        json_buffer = json_buffer & vbCr
                    Case "t"
                        json_buffer = json_buffer & vbTab
                    Case "u"
                        json_buffer = json_buffer & ChrW$(CLng("&H" & Mid$(JsonString, json_Index + 1, 4)))
                        json_Index = json_Index + 4
                End Select
                json_Index = json_Index + 1
            Case Else
                json_buffer = json_buffer & json_Char
                json_Index = json_Index + 1
        End Select
    Loop
    
    json_ParseString = json_buffer
End Function

Private Function json_ParseNumber(ByRef JsonString As String, ByRef json_Index As Long) As Variant
    Dim json_Char As String
    Dim json_buffer As String
    
    Do
        json_Char = Mid$(JsonString, json_Index, 1)
        
        If InStr("0123456789.eE+-", json_Char) > 0 Then
            json_buffer = json_buffer & json_Char
            json_Index = json_Index + 1
        Else
            Exit Do
        End If
    Loop
    
    json_buffer = Replace(json_buffer, ".", Application.International(xlDecimalSeparator))
    
    If InStr(json_buffer, Application.International(xlDecimalSeparator)) > 0 Or InStr(LCase(json_buffer), "e") > 0 Then
        json_ParseNumber = CDbl(json_buffer)
    ElseIf Len(json_buffer) > 9 Then
        json_ParseNumber = CDbl(json_buffer)
    Else
        json_ParseNumber = CLng(json_buffer)
    End If
End Function

Private Function json_ParseBoolean(ByRef JsonString As String, ByRef json_Index As Long) As Boolean
    If Mid$(JsonString, json_Index, 4) = "true" Then
        json_ParseBoolean = True
        json_Index = json_Index + 4
    ElseIf Mid$(JsonString, json_Index, 5) = "false" Then
        json_ParseBoolean = False
        json_Index = json_Index + 5
    Else
        Err.Raise 10001, "JSONConverter", "JSON parse error: Expected 'true' or 'false'"
    End If
End Function

Private Function json_ParseNull(ByRef JsonString As String, ByRef json_Index As Long) As Variant
    If Mid$(JsonString, json_Index, 4) = "null" Then
        json_ParseNull = Null
        json_Index = json_Index + 4
    Else
        Err.Raise 10001, "JSONConverter", "JSON parse error: Expected 'null'"
    End If
End Function

Private Sub json_SkipWhitespace(ByRef JsonString As String, ByRef json_Index As Long)
    Do While InStr(" " & vbTab & vbCr & vbLf, Mid$(JsonString, json_Index, 1)) > 0
        json_Index = json_Index + 1
    Loop
End Sub

Private Function json_Escape(ByVal json_String As String) As String
    json_String = Replace(json_String, "\", "\\")
    json_String = Replace(json_String, json_QUOTE, "\" & json_QUOTE)
    json_String = Replace(json_String, vbCr, "\r")
    json_String = Replace(json_String, vbLf, "\n")
    json_String = Replace(json_String, vbTab, "\t")
    json_Escape = json_String
End Function
