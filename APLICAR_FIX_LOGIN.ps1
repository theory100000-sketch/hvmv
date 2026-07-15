$ErrorActionPreference = 'Stop'

$base = Split-Path -Parent $MyInvocation.MyCommand.Path
$index = Join-Path $base 'index.html'
$hotfix = Join-Path $base 'tel-auth-fix.js'

if (-not (Test-Path $index)) {
  Write-Host 'ERROR: No se encuentra index.html en esta carpeta.' -ForegroundColor Red
  Write-Host 'Copia estos archivos dentro de la carpeta principal de la web y vuelve a ejecutar.'
  Read-Host 'Pulsa ENTER para cerrar'
  exit 1
}
if (-not (Test-Path $hotfix)) {
  Write-Host 'ERROR: Falta tel-auth-fix.js.' -ForegroundColor Red
  Read-Host 'Pulsa ENTER para cerrar'
  exit 1
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $base "index.html.backup-$stamp"
Copy-Item $index $backup -Force

$content = Get-Content $index -Raw -Encoding UTF8

# Corrige errores de sintaxis detectados en las versiones anteriores.
$content = $content.Replace('user = {.accounts[email], email}', 'user = {...accounts[email], email}')
$content = $content.Replace('user={.accounts[email], email}', 'user={...accounts[email], email}')
$content = $content.Replace('[.email].reduce', '[...email].reduce')
$content = $content.Replace("'#userDisplayName,account-name,account-fullname'", "'#userDisplayName,.account-name,.account-fullname'")
$content = $content.Replace('"#userDisplayName,account-name,account-fullname"', '"#userDisplayName,.account-name,.account-fullname"')

# Elimina la llave de cierre duplicada que aparece justo antes del botón de contraseña.
$content = [regex]::Replace(
  $content,
  '(?s)(document\.querySelector\(''#loginForm''\)\?\.addEventListener\(''submit''.*?\n\s*\}\);)\s*\n\s*\}\);(?=\s*\n\s*document\.querySelector\(''\.password-toggle''\))',
  '$1'
)

$tag = '<script src="./tel-auth-fix.js?v=2"></script>'
$scriptRegex = [regex]::new('<script\s+src=["'']\./tel-auth-fix\.js[^>]*></script>', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
$content = $scriptRegex.Replace($content, '')

if ($content -notmatch '</body>') {
  throw 'index.html no contiene la etiqueta </body>.'
}
$bodyRegex = [regex]::new('</body>', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
$content = $bodyRegex.Replace($content, "  $tag`r`n</body>", 1)

Set-Content -Path $index -Value $content -Encoding UTF8

Write-Host ''
Write-Host 'FIX APLICADO CORRECTAMENTE' -ForegroundColor Green
Write-Host "Copia de seguridad: $backup"
Write-Host 'Archivos que debes subir a GitHub:'
Write-Host '  - index.html'
Write-Host '  - tel-auth-fix.js'
Write-Host ''
Read-Host 'Pulsa ENTER para cerrar'
