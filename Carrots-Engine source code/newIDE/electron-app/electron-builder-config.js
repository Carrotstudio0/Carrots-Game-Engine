name: Build Windows EXE

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

env:
  NODE_VERSION: "18"
  PYTHON_VERSION: "3.11"
  LIBGD_MAX_SIZE_MIB: "8"

jobs:
  build-windows:
    name: Build Carrots Engine for Windows
    runs-on: windows-latest
    timeout-minutes: 120

    steps:
      # ========= CHECKOUT =========
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          submodules: recursive
          fetch-depth: 0

      # ========= SETUP =========
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: ${{ env.PYTHON_VERSION }}

      - name: Install system dependencies
        shell: pwsh
        run: |
          choco install cmake ninja git -y --no-progress
          Write-Host "✓ CMake, Ninja, and Git installed successfully" -ForegroundColor Green

      # ========= DIAGNOSTICS =========
      - name: Verify installed tools
        shell: pwsh
        run: |
          Write-Host "ninja location:" (Get-Command ninja -ErrorAction SilentlyContinue).Path
          ninja --version
          cmake --version

          try {
            emcc --version
          } catch {
            Write-Host "emcc not found yet" -ForegroundColor Yellow
          }

      - name: Export CMAKE_MAKE_PROGRAM
        shell: pwsh
        run: |
          $ninja = (Get-Command ninja -ErrorAction SilentlyContinue).Path

          if (-not $ninja) {
            Write-Host "❌ Ninja not found" -ForegroundColor Red
            exit 1
          }

          Add-Content -Path $env:GITHUB_ENV -Value "CMAKE_MAKE_PROGRAM=$ninja"
          Write-Host "✓ Exported CMAKE_MAKE_PROGRAM=$ninja" -ForegroundColor Green

      # ========= INSTALL DEPENDENCIES =========
      - name: Install GDJS dependencies
        working-directory: "Carrots-Engine source code/GDJS"
        shell: pwsh
        run: |
          Write-Host "Installing GDJS dependencies..." -ForegroundColor Cyan

          if (Test-Path package-lock.json) {
            npm ci --legacy-peer-deps
          } else {
            npm install --legacy-peer-deps
          }

          if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ GDJS dependencies installation failed" -ForegroundColor Red
            exit 1
          }

          Write-Host "✓ GDJS dependencies installed" -ForegroundColor Green

      - name: Install GDevelop.js dependencies
        working-directory: "Carrots-Engine source code/GDevelop.js"
        shell: pwsh
        run: |
          Write-Host "Installing GDevelop.js dependencies..." -ForegroundColor Cyan

          if (Test-Path package-lock.json) {
            npm ci --legacy-peer-deps
          } else {
            npm install --legacy-peer-deps
          }

          if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ GDevelop.js dependencies installation failed" -ForegroundColor Red
            exit 1
          }

          Write-Host "✓ GDevelop.js dependencies installed" -ForegroundColor Green

      - name: Install newIDE app dependencies
        working-directory: "Carrots-Engine source code/newIDE/app"
        shell: pwsh
        run: |
          Write-Host "Installing newIDE app dependencies..." -ForegroundColor Cyan

          if (Test-Path package-lock.json) {
            npm ci --legacy-peer-deps
          } else {
            npm install --legacy-peer-deps
          }

          if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ newIDE app dependencies installation failed" -ForegroundColor Red
            exit 1
          }

          Write-Host "✓ newIDE app dependencies installed" -ForegroundColor Green

      - name: Install Electron app dependencies
        working-directory: "Carrots-Engine source code/newIDE/electron-app"
        shell: pwsh
        run: |
          Write-Host "Installing Electron app dependencies..." -ForegroundColor Cyan

          if (Test-Path package-lock.json) {
            npm ci --legacy-peer-deps
          } else {
            npm install --legacy-peer-deps
          }

          if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ Electron app dependencies installation failed" -ForegroundColor Red
            exit 1
          }

          Write-Host "✓ Electron app dependencies installed" -ForegroundColor Green

      # ========= BUILD =========
      - name: Build GDJS
        working-directory: "Carrots-Engine source code/GDJS"
        shell: pwsh
        run: |
          Write-Host "=== Starting GDJS Build ===" -ForegroundColor Yellow

          npm run build

          if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ GDJS build failed" -ForegroundColor Red
            exit 1
          }

          Write-Host "✓ GDJS built successfully" -ForegroundColor Green

      # ========= EMSCRIPTEN =========
      - name: Setup Emscripten
        uses: mymindstorm/setup-emsdk@v14
        with:
          version: 3.1.45

      - name: Verify Emscripten
        shell: pwsh
        run: |
          emcc --version
          emcmake cmake --version

      - name: Clean previous build
        shell: pwsh
        run: |
          Remove-Item -Recurse -Force "Carrots-Engine source code/Binaries/embuild" -ErrorAction SilentlyContinue
          Remove-Item -Recurse -Force "Carrots-Engine source code/Binaries/Output/Release_Emscripten" -ErrorAction SilentlyContinue

      - name: Build GDevelop.js
        working-directory: "Carrots-Engine source code/GDevelop.js"
        shell: pwsh
        run: |
          Write-Host "=== Starting GDevelop.js Build ===" -ForegroundColor Yellow

          npm run build

          if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ GDevelop.js build failed" -ForegroundColor Red
            exit 1
          }

          Write-Host "✓ GDevelop.js built successfully" -ForegroundColor Green

      - name: Build Electron App
        working-directory: "Carrots-Engine source code/newIDE/electron-app"
        shell: pwsh
        run: |
          Write-Host "=== Starting Electron App Build ===" -ForegroundColor Yellow

          $env:NODE_ENV = "production"

          npm run build

          if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ Electron app build failed" -ForegroundColor Red
            exit 1
          }

          Write-Host "✓ Electron app built successfully" -ForegroundColor Green

      # ========= PACKAGE EXE =========
      - name: Build Windows EXE
        working-directory: "Carrots-Engine source code/newIDE/electron-app"
        shell: pwsh
        run: |
          Write-Host "=== Creating Windows Executable ===" -ForegroundColor Yellow

          $env:NODE_ENV = "production"

          npm run make

          if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ EXE creation failed" -ForegroundColor Red
            exit 1
          }

          Write-Host "✓ EXE created successfully" -ForegroundColor Green

      # ========= VERIFY =========
      - name: Verify build artifacts
        shell: pwsh
        run: |
          $distPath = "Carrots-Engine source code/newIDE/electron-app/dist"

          Write-Host "Checking for EXE files in: $distPath" -ForegroundColor Cyan

          $exeFiles = Get-ChildItem -Path $distPath -Recurse -Filter "*.exe" -ErrorAction SilentlyContinue

          if (-not $exeFiles -or $exeFiles.Count -eq 0) {
            Write-Host "❌ No EXE files found in $distPath" -ForegroundColor Red
            Write-Host "--- Full dist folder content (for debugging) ---" -ForegroundColor Yellow
            Get-ChildItem -Path $distPath -Recurse -ErrorAction SilentlyContinue | ForEach-Object { Write-Host $_.FullName }
            exit 1
          }

          Write-Host "✓ Found $($exeFiles.Count) EXE file(s):" -ForegroundColor Green
          $exeFiles | ForEach-Object { Write-Host "  - $($_.FullName)" -ForegroundColor Green }

      # ========= UPLOAD =========
      - name: Upload EXE artifacts
        uses: actions/upload-artifact@v4
        with:
          name: Carrots-Engine-Windows-EXE
          path: |
            Carrots-Engine source code/newIDE/electron-app/dist/*.exe
          retention-days: 30
