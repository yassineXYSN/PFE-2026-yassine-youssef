$ErrorActionPreference = "Stop"

function Start-Backend {
    Write-Host "Starting Backend..." -ForeColor Green
    # Start Backend in a new separate window, return the process object
    return Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "& '.\backend\venv\Scripts\python.exe' -m uvicorn backend.main:app --reload --host 127.0.0.1" -PassThru
    # return Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "& '.\backend\venv\Scripts\python.exe' -m uvicorn backend.main:app --reload --host https://knoll-zero-operation.ngrok-free.dev" -PassThru
}

function Start-Frontend {
    Write-Host "Starting Frontend..." -ForeColor Green
    # Start Frontend in a new separate window, return the process object
    return Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev" -PassThru
}

function Stop-Services {
    param($b, $f)
    Write-Host "Stopping Services..." -ForeColor Yellow
    if ($b -and -not $b.HasExited) { 
        # Kill process tree to ensure uvicorn/python die
        Start-Process -FilePath "taskkill.exe" -ArgumentList "/PID", $b.Id, "/T", "/F" -NoNewWindow -Wait
    }
    if ($f -and -not $f.HasExited) { 
        # Kill process tree to ensure node/vite die
        Start-Process -FilePath "taskkill.exe" -ArgumentList "/PID", $f.Id, "/T", "/F" -NoNewWindow -Wait
    }
}

# --- Setup Checks ---
Write-Host "`nDo you want to download and install dependencies? (Y/N)" -ForeColor Yellow
$downloadDeps = Read-Host "Choose"

if ($downloadDeps -eq 'y' -or $downloadDeps -eq 'yes') {
    # Backend Setup
    Write-Host "`nChecking Backend Virtual Environment..." -ForeColor Cyan
    if (-not (Test-Path "backend\venv")) {
        Write-Host "Creating venv..."
        python -m venv backend\venv
    }

    Write-Host "Updating pip..." -ForeColor Cyan
    & ".\backend\venv\Scripts\python.exe" -m pip install --upgrade pip

    Write-Host "Installing/Updating Requirements..." -ForeColor Cyan
    & ".\backend\venv\Scripts\pip.exe" install -r backend\requirements.txt

    # Frontend Setup
    Write-Host "`nInstalling Frontend Dependencies..." -ForeColor Cyan
    if (-not (Test-Path "frontend\node_modules")) {
        Write-Host "Installing npm packages..."
    }
    cd frontend
    npm install
    cd ..
}
else {
    Write-Host "Skipping dependency installation." -ForeColor Gray
}

# --- Main Loop ---
$backendProc = $null
$frontendProc = $null

try {
    $backendProc = Start-Backend
    $frontendProc = Start-Frontend

    Write-Host "`nServices are running in separate windows." -ForeColor Green
    Write-Host "Dependencies are verified at start." -ForeColor Gray

    while ($true) {
        Write-Host "`n--------------------------------" -ForeColor DarkGray
        Write-Host "[R]estart Services   [Q]uit / Close" -ForeColor Cyan
        $action = Read-Host "Type command"

        if ($action -eq 'q' -or $action -eq 'quit') {
            break
        }
        elseif ($action -eq 'r' -or $action -eq 'restart') {
            Stop-Services $backendProc $frontendProc
            Start-Sleep -Seconds 1
            Write-Host "Restarting..."
            $backendProc = Start-Backend
            $frontendProc = Start-Frontend
        }
    }
}
catch {
    Write-Error $_
}
finally {
    Stop-Services $backendProc $frontendProc
    Write-Host "Exited." -ForeColor Gray
}
