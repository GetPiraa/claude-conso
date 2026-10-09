@echo off
rem Fabrique Conso-for-Claude.exe a partir du mod de ce depot. A lancer depuis la racine du depot.
rem Le compilateur C# utilise est celui de .NET Framework 4, present sur Windows.
setlocal
if exist "%TEMP%\conso-build" rmdir /s /q "%TEMP%\conso-build"
mkdir "%TEMP%\conso-build\conso"
xcopy /e /q /i conso\.claude-plugin "%TEMP%\conso-build\conso\.claude-plugin" >nul
xcopy /e /q /i conso\bin "%TEMP%\conso-build\conso\bin" >nul
xcopy /e /q /i conso\hooks "%TEMP%\conso-build\conso\hooks" >nul
xcopy /e /q /i conso\types "%TEMP%\conso-build\conso\types" >nul
powershell -NoProfile -Command "Compress-Archive -Path '%TEMP%\conso-build\conso' -DestinationPath '%TEMP%\conso-build\conso.zip' -Force"
"%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe" -nologo -target:winexe -optimize+ -codepage:65001 -out:Conso-for-Claude.exe "-resource:%TEMP%\conso-build\conso.zip,conso.zip" -r:System.IO.Compression.dll -r:System.IO.Compression.FileSystem.dll -r:System.Web.Extensions.dll -r:System.Windows.Forms.dll installeur\Installer.cs
if errorlevel 1 exit /b 1
echo Conso-for-Claude.exe est pret.
