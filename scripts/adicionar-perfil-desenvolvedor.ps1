$ErrorActionPreference = "Stop"
$caminho = Join-Path (Get-Location) "prisma/schema.prisma"
if (-not (Test-Path $caminho)) { throw "Execute na raiz do projeto." }
$conteudo = [System.IO.File]::ReadAllText($caminho)
$padrao = '(?s)enum TipoUsuario\s*\{(?<corpo>[^}]*)\}'
$match = [regex]::Match($conteudo, $padrao)
if (-not $match.Success) { throw "Enum TipoUsuario não encontrado: nenhuma alteração realizada." }
if ($match.Groups['corpo'].Value -match '\bDESENVOLVEDOR\b') { Write-Host "Perfil já existe. Nenhuma alteração necessária."; exit 0 }
if ($match.Groups['corpo'].Value -notmatch '\bDONO\b' -or $match.Groups['corpo'].Value -notmatch '\bFUNCIONARIO\b') { throw "Enum diferente do esperado. Pare e confira." }
$novo = $match.Value -replace '\s*\}$', "`n  DESENVOLVEDOR`n}"
$conteudo = $conteudo.Substring(0, $match.Index) + $novo + $conteudo.Substring($match.Index + $match.Length)
[System.IO.File]::WriteAllText($caminho, $conteudo, [System.Text.UTF8Encoding]::new($false))
Write-Host "Perfil DESENVOLVEDOR adicionado ao schema." 
