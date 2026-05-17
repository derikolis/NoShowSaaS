# start-dev.ps1 — Inicia todo o ambiente de desenvolvimento
# Uso: .\scripts\start-dev.ps1

Write-Host "`n Kired — Ambiente de desenvolvimento" -ForegroundColor Cyan
Write-Host "====================================`n" -ForegroundColor Cyan

# 1. Docker (Postgres + Redis + Evolution API)
Write-Host "[1/4] Subindo containers Docker..." -ForegroundColor Yellow
docker-compose up -d

if ($LASTEXITCODE -ne 0) {
    Write-Host "Erro ao subir Docker. Verifique se o Docker Desktop esta rodando." -ForegroundColor Red
    exit 1
}

# 2. Aguardar Postgres ficar pronto
Write-Host "[2/4] Aguardando PostgreSQL..." -ForegroundColor Yellow
$tries = 0
do {
    Start-Sleep -Seconds 1
    $tries++
    $result = docker exec noshow_postgres pg_isready -U noshow 2>$null
} while ($LASTEXITCODE -ne 0 -and $tries -lt 15)

if ($LASTEXITCODE -ne 0) {
    Write-Host "PostgreSQL nao respondeu a tempo. Tente novamente." -ForegroundColor Red
    exit 1
}

Write-Host "   PostgreSQL pronto!" -ForegroundColor Green

# 3. Migrations
Write-Host "[3/4] Rodando migrations..." -ForegroundColor Yellow
Set-Location backend
npx prisma migrate deploy 2>&1 | Select-String -NotMatch "^$"
Set-Location ..
Write-Host "   Migrations aplicadas!" -ForegroundColor Green

# 4. Iniciar backend e frontend em janelas separadas
Write-Host "[4/4] Iniciando backend e frontend..." -ForegroundColor Yellow

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\backend'; npm run dev" -WindowStyle Normal
Start-Sleep -Seconds 2
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\frontend'; npm run dev" -WindowStyle Normal

Write-Host "`n Tudo pronto!" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend  -> http://localhost:3000" -ForegroundColor White
Write-Host "  Backend   -> http://localhost:4000/api" -ForegroundColor White
Write-Host "  WhatsApp  -> http://localhost:8080" -ForegroundColor White
Write-Host ""
Write-Host "  Para ver o banco: cd backend && npm run db:studio" -ForegroundColor Gray
Write-Host ""
