param(
    [switch]$Deployment,
    [string]$BackendUrl = "",
    [string]$OllamaUrl  = "",
    [string]$FrontendUrl = ""
)

$ErrorActionPreference = "Stop"

function Read-Url {
    param([string]$Label, [string]$Value)
    if ($Value) { return $Value.TrimEnd('/') }
    Write-Host "Enter $Label URL (e.g. https://xxxx.example.com):" -ForegroundColor Yellow
    return (Read-Host $Label).TrimEnd('/')
}

function Start-Backend {
    param([string]$OllamaBaseUrl = "", [switch]$DeploymentMode, [string]$CorsOrigin = "", [string]$FrontendUrl = "")
    Write-Host "Starting Backend..." -ForegroundColor Green
    $host_addr = if ($DeploymentMode) { "0.0.0.0" } else { "127.0.0.1" }
    $envPrefix = ""
    if ($OllamaBaseUrl) { $envPrefix += "`$env:OLLAMA_BASE_URL = '$OllamaBaseUrl'; " }
    if ($CorsOrigin)    { $envPrefix += "`$env:CORS_ALLOWED_ORIGIN = '$CorsOrigin'; " }
    if ($FrontendUrl)   { $envPrefix += "`$env:FRONTEND_URL = '$FrontendUrl'; " }
    return Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "${envPrefix}& '.\backend\venv\Scripts\python.exe' -m uvicorn backend.main:app --reload --host $host_addr" -PassThru
}

function Start-Frontend {
    param([switch]$DeploymentMode)
    Write-Host "Starting Frontend..." -ForegroundColor Green
    if ($DeploymentMode) {
        return Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "cd frontend; .\node_modules\.bin\vite --mode deployment" -PassThru
    } else {
        return Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev" -PassThru
    }
}

function Stop-Services {
    param($b, $f)
    Write-Host "Stopping Services..." -ForegroundColor Yellow
    if ($b -and -not $b.HasExited) {
        Start-Process -FilePath "taskkill.exe" -ArgumentList "/PID", $b.Id, "/T", "/F" -NoNewWindow -Wait
    }
    if ($f -and -not $f.HasExited) {
        Start-Process -FilePath "taskkill.exe" -ArgumentList "/PID", $f.Id, "/T", "/F" -NoNewWindow -Wait
    }
}

# --- Deployment Config ---
if ($Deployment) {
    Write-Host "`n[Deployment Mode]" -ForegroundColor Magenta

    $BackendUrl  = Read-Url "Backend " $BackendUrl
    $OllamaUrl   = Read-Url "Ollama  " $OllamaUrl
    $FrontendUrl = Read-Url "Frontend" $FrontendUrl

    Write-Host "`n  Backend  -> $BackendUrl" -ForegroundColor Cyan
    Write-Host "  Ollama   -> $OllamaUrl"   -ForegroundColor Cyan
    Write-Host "  Frontend -> $FrontendUrl`n" -ForegroundColor Cyan

    # Write .env.deployment.local — Vite auto-gitignores *.local files
    $localEnvPath = "frontend\.env.deployment.local"
    $baseEnv = Get-Content "frontend\.env.deployment" | Where-Object { $_ -notmatch '^VITE_API_URL=' -and $_ -notmatch '^VITE_FRONTEND_URL=' }
    $baseEnv + "VITE_API_URL=$BackendUrl" + "VITE_FRONTEND_URL=$FrontendUrl" | Set-Content $localEnvPath -Encoding utf8
    Write-Host "Frontend env written to $localEnvPath" -ForegroundColor Gray
}

# --- Setup Checks ---
Write-Host "`nDo you want to download and install dependencies? (Y/N)" -ForegroundColor Yellow
$downloadDeps = Read-Host "Choose"

if ($downloadDeps -eq 'y' -or $downloadDeps -eq 'yes') {
    Write-Host "`nChecking Backend Virtual Environment..." -ForegroundColor Cyan
    if (-not (Test-Path "backend\venv")) {
        Write-Host "Creating venv..."
        python -m venv backend\venv
    }

    Write-Host "Updating pip..." -ForegroundColor Cyan
    & ".\backend\venv\Scripts\python.exe" -m pip install --upgrade pip

    Write-Host "Installing/Updating Requirements..." -ForegroundColor Cyan
    & ".\backend\venv\Scripts\pip.exe" install -r backend\requirements.txt

    Write-Host "Downloading/Verifying wav2vec2 model..." -ForegroundColor Cyan
    & ".\backend\venv\Scripts\python.exe" -c "import os; os.environ['DISABLE_SAFETENSORS_CONVERSION'] = '1'; from transformers import AutoFeatureExtractor, AutoModelForAudioClassification; model_name='superb/wav2vec2-base-superb-er'; AutoFeatureExtractor.from_pretrained(model_name); AutoModelForAudioClassification.from_pretrained(model_name, use_safetensors=False)"

    Write-Host "`nInstalling Frontend Dependencies..." -ForegroundColor Cyan
    if (-not (Test-Path "frontend\node_modules")) {
        Write-Host "Installing npm packages..."
    }
    Set-Location frontend
    npm install
    Set-Location ..
}
else {
    Write-Host "Skipping dependency installation." -ForegroundColor Gray
}

# --- Main Loop ---
$backendProc  = $null
$frontendProc = $null

try {
    $backendProc  = Start-Backend  -OllamaBaseUrl $(if ($Deployment) { $OllamaUrl } else { "" }) -DeploymentMode:$Deployment -CorsOrigin $(if ($Deployment) { $FrontendUrl } else { "" }) -FrontendUrl $(if ($Deployment) { $FrontendUrl } else { "" })
    $frontendProc = Start-Frontend -DeploymentMode:$Deployment

    Write-Host "`nServices are running in separate windows." -ForegroundColor Green
    if ($Deployment) {
        Write-Host "`nShare with testers:" -ForegroundColor Magenta
        Write-Host "  Frontend -> $FrontendUrl" -ForegroundColor Magenta
        Write-Host "  Backend  -> $BackendUrl"  -ForegroundColor Magenta
        Write-Host "  Ollama   -> $OllamaUrl`n"  -ForegroundColor Magenta
    }

    while ($true) {
        Write-Host "`n--------------------------------" -ForegroundColor DarkGray
        Write-Host "[R]estart Services   [Q]uit / Close" -ForegroundColor Cyan
        $action = Read-Host "Type command"

        if ($action -eq 'q' -or $action -eq 'quit') {
            break
        }
        elseif ($action -eq 'r' -or $action -eq 'restart') {
            Stop-Services $backendProc $frontendProc
            Start-Sleep -Seconds 1
            Write-Host "Restarting..."
            $backendProc  = Start-Backend  -OllamaBaseUrl $(if ($Deployment) { $OllamaUrl } else { "" }) -DeploymentMode:$Deployment -CorsOrigin $(if ($Deployment) { $FrontendUrl } else { "" }) -FrontendUrl $(if ($Deployment) { $FrontendUrl } else { "" })
            $frontendProc = Start-Frontend -DeploymentMode:$Deployment
        }
    }
}
catch {
    Write-Error $_
}
finally {
    Stop-Services $backendProc $frontendProc
    Write-Host "Exited." -ForegroundColor Gray
}
