# Setup da instância WhatsApp na Evolution API
# Rodar após: docker-compose up -d evolution-api

$API_URL  = "http://localhost:8080"
$API_KEY  = "noshow-evolution-key-dev"
$INSTANCE = "noshow"
# URL do webhook — backend rodando localmente
# host.docker.internal aponta para o host a partir do container
$WEBHOOK_URL = "http://host.docker.internal:4000/webhooks/whatsapp"

$headers = @{
    "Content-Type" = "application/json"
    "apikey"       = $API_KEY
}

Write-Host ""
Write-Host "=== Setup Evolution API ===" -ForegroundColor Cyan

# 1. Aguarda a API estar pronta
Write-Host "Aguardando Evolution API iniciar..." -ForegroundColor Yellow
$tries = 0
do {
    Start-Sleep -Seconds 2
    $tries++
    try {
        $r = Invoke-RestMethod -Uri "$API_URL/" -Method Get -ErrorAction Stop
        break
    } catch {
        if ($tries -ge 15) {
            Write-Host "Evolution API nao respondeu apos 30s. Verifique se o container esta rodando." -ForegroundColor Red
            exit 1
        }
    }
} while ($true)
Write-Host "API pronta." -ForegroundColor Green

# 2. Cria a instância
Write-Host ""
Write-Host "Criando instancia '$INSTANCE'..." -ForegroundColor Yellow
$body = @{ instanceName = $INSTANCE; qrcode = $true; integration = "WHATSAPP-BAILEYS" } | ConvertTo-Json
try {
    $resp = Invoke-RestMethod -Uri "$API_URL/instance/create" -Method Post -Headers $headers -Body $body
    Write-Host "Instancia criada." -ForegroundColor Green
} catch {
    $msg = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($msg.message -match "already") {
        Write-Host "Instancia ja existe, continuando..." -ForegroundColor Yellow
    } else {
        Write-Host "Erro ao criar instancia: $_" -ForegroundColor Red
    }
}

# 3. Configura o webhook
Write-Host ""
Write-Host "Configurando webhook -> $WEBHOOK_URL" -ForegroundColor Yellow
$webhookBody = @{
    webhook = @{
        enabled    = $true
        url        = $WEBHOOK_URL
        byEvents   = $false
        base64     = $false
        events     = @("MESSAGES_UPSERT")
    }
} | ConvertTo-Json -Depth 5
try {
    Invoke-RestMethod -Uri "$API_URL/webhook/set/$INSTANCE" -Method Post -Headers $headers -Body $webhookBody | Out-Null
    Write-Host "Webhook configurado." -ForegroundColor Green
} catch {
    Write-Host "Erro ao configurar webhook: $_" -ForegroundColor Red
}

# 4. Pega o QR code para conexão
Write-Host ""
Write-Host "Obtendo QR code..." -ForegroundColor Yellow
try {
    $qr = Invoke-RestMethod -Uri "$API_URL/instance/connect/$INSTANCE" -Method Get -Headers $headers
    Write-Host ""
    Write-Host "ESCANEIE O QR CODE COM O WHATSAPP:" -ForegroundColor Cyan
    Write-Host "Acesse no navegador:" -ForegroundColor White
    Write-Host "  http://localhost:8080/instance/connect/$INSTANCE" -ForegroundColor Green
    Write-Host ""
    Write-Host "Ou use a interface da Evolution API:" -ForegroundColor White
    Write-Host "  http://localhost:8080/manager" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "Erro ao obter QR code: $_" -ForegroundColor Red
    Write-Host "Tente acessar manualmente: http://localhost:8080/manager" -ForegroundColor Yellow
}

Write-Host "=== Proximo passo ===" -ForegroundColor Cyan
Write-Host "1. Abra http://localhost:8080/manager no navegador"
Write-Host "2. Clique na instancia '$INSTANCE'"
Write-Host "3. Escaneie o QR code com o WhatsApp do numero que vai disparar as mensagens"
Write-Host "4. Apos conectar, atualize o numero em Configuracoes no painel"
Write-Host ""
