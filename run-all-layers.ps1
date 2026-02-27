$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$fastapiPath = Join-Path $repoRoot "fastapi-backend"
$springPath = Join-Path $repoRoot "spring-backend"
$frontendPath = Join-Path $repoRoot "frontend"

function Start-ServiceWindow {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ScriptText
    )

    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($ScriptText))
    Start-Process -FilePath "powershell.exe" -ArgumentList @("-NoExit", "-EncodedCommand", $encoded) | Out-Null
}

$fastapiScript = @"
`$host.UI.RawUI.WindowTitle = "FastAPI Backend"
Set-Location "$fastapiPath"

if (Test-Path ".venv\Scripts\python.exe") {
    `$pythonExe = (Resolve-Path ".venv\Scripts\python.exe").Path
}
elseif (Test-Path ".venv/bin/python") {
    `$pythonExe = (Resolve-Path ".venv/bin/python").Path
}
else {
    Write-Host "Missing FastAPI virtual environment. Run setup in fastapi-backend first." -ForegroundColor Red
    return
}

& `$pythonExe -m uvicorn app.main:app --reload --port 8000
"@

$springScript = @"
`$host.UI.RawUI.WindowTitle = "Spring Backend"
Set-Location "$springPath"

if (-not (Test-Path ".\mvnw.cmd")) {
    Write-Host "Missing spring-backend\mvnw.cmd." -ForegroundColor Red
    return
}

& .\mvnw.cmd spring-boot:run
"@

$frontendScript = @"
`$host.UI.RawUI.WindowTitle = "Frontend"
Set-Location "$frontendPath"
npm run dev
"@

Start-ServiceWindow -ScriptText $fastapiScript
Start-Sleep -Milliseconds 250
Start-ServiceWindow -ScriptText $springScript
Start-Sleep -Milliseconds 250
Start-ServiceWindow -ScriptText $frontendScript

Write-Host "Started FastAPI, Spring Boot, and frontend in separate PowerShell windows."
Write-Host "FastAPI: http://localhost:8000"
Write-Host "Spring:  http://localhost:8080"
Write-Host "Frontend: http://localhost:5173"
