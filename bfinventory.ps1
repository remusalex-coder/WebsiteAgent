<#
==============================================================================
 BUSINESSFORGE - LAPTOP DISCOVERY (READ-ONLY)
==============================================================================
 Run from:  C:\Users\40728\WebsiteAgent

 USAGE (creates one text file you can paste back; nothing else is written):

   powershell -ExecutionPolicy Bypass -File .\bf-inventory.ps1 > bf-inventory.txt

 The -ExecutionPolicy flag applies to that one process only. It does not
 change any machine or user policy.

------------------------------------------------------------------------------
 SAFETY CONTRACT - what this script does and does not do
------------------------------------------------------------------------------
 DOES:   reads files, reads the registry, queries CIM/WMI, lists processes,
         lists services, lists listening TCP sockets, and runs "--version" /
         read-only list subcommands on tools that are already installed.

 DOES NOT:  install, download, update, uninstall, create, modify, move,
            rename or delete anything. It never writes to the filesystem
            (the single output file is created by YOUR redirection, not by
            the script). It never starts, stops or restarts a service or
            container. It never sets or clears an environment variable.
            It never changes any configuration. It never calls npx, pip
            install, npm install, or "playwright install".

 CREDENTIALS: values are never printed. Two independent guards:
   1. any key whose NAME matches a secret pattern is reported as
      PRESENT / ABSENT only;
   2. any VALUE that looks like a credential (known key prefixes, JWTs, or
      a long opaque string) is redacted regardless of its key name.
   .env is parsed for variable NAMES only; values are never read into output.

 If any single probe fails, it is reported and the script continues.
==============================================================================
#>

$ErrorActionPreference = 'SilentlyContinue'
$ProgressPreference    = 'SilentlyContinue'
$script:SectionCount   = 0
$RepoRoot              = (Get-Location).Path

# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------
function Section {
    param([string]$Num, [string]$Title)
    $script:SectionCount++
    Write-Output ''
    Write-Output "===[ $Num $Title ]==============================================="
}
function KV   { param($k, $v) Write-Output ("  {0,-34} {1}" -f $k, $v) }
function Note { param($t)     Write-Output "  # $t" }
function Line { param($t)     Write-Output "    $t" }

# ---------------------------------------------------------------------------
# Redaction - the core safety mechanism
# ---------------------------------------------------------------------------
$SecretNameRx = '(?i)(api[_-]?key|apikey|_key$|^key$|token|secret|password|passwd|pwd|credential|cookie|authorization|auth$|bearer|session|signature|private|salt|dsn|connection[_-]?string)'
$SecretValRx  = '(?i)^(sk-|sk-ant-|sk-proj-|ghp_|gho_|ghs_|ghu_|github_pat_|AIza|ya29\.|xox[baprs]-|eyJ[A-Za-z0-9_-]{8,}|npm_|dop_v1_|hf_|pplx-|r8_|glpat-|lin_api_|pat-|Bearer\s)'

function Protect-Value {
    param([string]$Name, $Value)

    if ($null -eq $Value) { return '<null>' }
    if ($Value -is [bool]) { return $Value.ToString() }
    if ($Value -is [int] -or $Value -is [long] -or $Value -is [double]) { return $Value.ToString() }

    $s = [string]$Value

    # Guard 1 - the key name says it is a secret.
    if ($Name -and $Name -match $SecretNameRx) {
        if ($s.Trim().Length -eq 0) { return 'ABSENT (empty)' }
        return "PRESENT [REDACTED len=$($s.Length)]"
    }
    # Guard 2 - the value looks like a secret whatever it is called.
    if ($s -match $SecretValRx) { return "PRESENT [REDACTED - credential-shaped len=$($s.Length)]" }
    if ($s.Length -ge 32 -and $s -match '^[A-Za-z0-9+/=_\-\.]{32,}$' -and $s -notmatch '[\\/]') {
        return "PRESENT [REDACTED - long opaque len=$($s.Length)]"
    }
    if ($s.Length -gt 160) { return ($s.Substring(0,160) + ' ...[truncated]') }
    return $s
}

# Walks a parsed-JSON object, printing structure with every value protected.
function Show-JsonSafe {
    param($Obj, [string]$Prefix = '    ', [int]$Depth = 0, [int]$MaxDepth = 5)

    if ($Depth -gt $MaxDepth) { Write-Output "$Prefix...[max depth]"; return }
    if ($null -eq $Obj) { return }

    if ($Obj -is [System.Collections.IDictionary]) {
        foreach ($k in $Obj.Keys) { Show-JsonPair $k $Obj[$k] $Prefix $Depth $MaxDepth }
        return
    }
    if ($Obj -is [pscustomobject]) {
        foreach ($p in $Obj.PSObject.Properties) { Show-JsonPair $p.Name $p.Value $Prefix $Depth $MaxDepth }
        return
    }
    if ($Obj -is [System.Collections.IEnumerable] -and $Obj -isnot [string]) {
        $i = 0
        foreach ($item in $Obj) {
            if ($i -ge 25) { Write-Output "$Prefix...[$(@($Obj).Count) items total, first 25 shown]"; break }
            if ($item -is [pscustomobject] -or $item -is [System.Collections.IDictionary]) {
                Write-Output "$Prefix[$i]"
                Show-JsonSafe $item ($Prefix + '  ') ($Depth+1) $MaxDepth
            } else {
                Write-Output "$Prefix[$i] $(Protect-Value '' $item)"
            }
            $i++
        }
        return
    }
    Write-Output "$Prefix$(Protect-Value '' $Obj)"
}
function Show-JsonPair {
    param($Name, $Val, $Prefix, $Depth, $MaxDepth)
    if ($Val -is [pscustomobject] -or $Val -is [System.Collections.IDictionary]) {
        Write-Output "$Prefix${Name}:"
        Show-JsonSafe $Val ($Prefix + '  ') ($Depth+1) $MaxDepth
    }
    elseif ($Val -is [System.Collections.IEnumerable] -and $Val -isnot [string]) {
        # A secret-named array is still a secret.
        if ($Name -match $SecretNameRx) { Write-Output "$Prefix${Name}: PRESENT [REDACTED array]"; return }
        Write-Output "$Prefix${Name}: [array]"
        Show-JsonSafe $Val ($Prefix + '  ') ($Depth+1) $MaxDepth
    }
    else {
        Write-Output "$Prefix${Name}: $(Protect-Value $Name $Val)"
    }
}

# ---------------------------------------------------------------------------
# Probes
# ---------------------------------------------------------------------------
function Probe-Cmd {
    # Reports whether a command exists, where it lives, and its version.
    param([string]$Name, [string]$VersionArg = '--version')
    $c = Get-Command $Name -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $c) { KV $Name 'ABSENT'; return }
    $src = $c.Source; if (-not $src) { $src = $c.Definition }
    $ver = 'UNKNOWN'
    try {
        $raw = & $Name $VersionArg 2>&1 | Select-Object -First 2
        if ($raw) { $ver = (($raw -join ' | ') -replace '\s+',' ').Trim() }
    } catch { $ver = "UNKNOWN (probe failed: $($_.Exception.Message))" }
    KV $Name "PRESENT  ver=$ver"
    Line "path: $src"
}

# REPORT-ONLY. Returns nothing. Never use this in an "if" - a PowerShell
# function returns all of its uncaptured output, so the KV line would itself
# be the truthy return value. Use Test-Path separately where a boolean is
# needed.
function Probe-Path {
    param([string]$Label, [string]$Path, [switch]$Count)
    if (Test-Path -LiteralPath $Path) {
        if ($Count) {
            $n = @(Get-ChildItem -LiteralPath $Path -Force -ErrorAction SilentlyContinue).Count
            KV $Label "PRESENT  ($n entries)  $Path"
        } else {
            $it = Get-Item -LiteralPath $Path -ErrorAction SilentlyContinue
            KV $Label "PRESENT  $Path"
            if ($it -and -not $it.PSIsContainer) { Line "size=$($it.Length)B  modified=$($it.LastWriteTime)" }
        }
    } else {
        KV $Label "ABSENT   $Path"
    }
}

function Probe-EnvPresence {
    param([string[]]$Names)
    foreach ($n in $Names) {
        $v = [Environment]::GetEnvironmentVariable($n, 'Process')
        if (-not $v) { $v = [Environment]::GetEnvironmentVariable($n, 'User') }
        if (-not $v) { $v = [Environment]::GetEnvironmentVariable($n, 'Machine') }
        if ($v -and $v.Trim().Length -gt 0) {
            if ($n -match $SecretNameRx) { KV $n "PRESENT [value never read]" }
            else { KV $n "PRESENT  = $(Protect-Value $n $v)" }
        } else { KV $n 'ABSENT' }
    }
}

function Find-Dirs {
    # Bounded search for a directory name under a set of roots. Never recurses
    # into node_modules / .git and never leaves the given roots.
    param([string[]]$Roots, [string]$Pattern, [int]$Depth = 3, [int]$Limit = 40)
    $hits = @()
    foreach ($r in $Roots) {
        if (-not (Test-Path -LiteralPath $r)) { continue }
        try {
            $found = Get-ChildItem -LiteralPath $r -Directory -Recurse -Depth $Depth -Filter $Pattern -Force -ErrorAction SilentlyContinue |
                     Where-Object { $_.FullName -notmatch '\\node_modules\\' -and $_.FullName -notmatch '\\\.git\\' } |
                     Select-Object -First $Limit
            if ($found) { $hits += $found }
        } catch { }
    }
    return ($hits | Select-Object -First $Limit)
}

# ===========================================================================
Write-Output '############################################################################'
Write-Output '# BUSINESSFORGE LAPTOP DISCOVERY REPORT (READ-ONLY)'
Write-Output "# generated       : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')"
Write-Output "# working dir     : $RepoRoot"
Write-Output "# powershell      : $($PSVersionTable.PSVersion) ($($PSVersionTable.PSEdition))"
Write-Output "# run as admin    : $([bool](New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator))"
Write-Output '# NOTE: credential VALUES are never printed. See SAFETY CONTRACT in the script.'
Write-Output '############################################################################'

# ---------------------------------------------------------------- 01 OS
Section '01' 'WINDOWS OS'
try {
    $os = Get-CimInstance Win32_OperatingSystem
    KV 'Caption'          $os.Caption
    KV 'Version'          $os.Version
    KV 'BuildNumber'      $os.BuildNumber
    KV 'Architecture'     $os.OSArchitecture
    KV 'InstallDate'      $os.InstallDate
    KV 'LastBootUpTime'   $os.LastBootUpTime
    KV 'SystemLocale'     (Get-Culture).Name
    $dv = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion' -ErrorAction SilentlyContinue
    KV 'DisplayVersion'   $dv.DisplayVersion
    KV 'UBR'              $dv.UBR
} catch { Note "OS probe failed: $($_.Exception.Message)" }
KV 'WSL present'  $(if (Get-Command wsl -ErrorAction SilentlyContinue) { 'PRESENT' } else { 'ABSENT' })
if (Get-Command wsl -ErrorAction SilentlyContinue) {
    Note 'wsl -l -v (read-only listing):'
    try { (wsl -l -v 2>&1) | ForEach-Object { Line $_ } } catch { Line 'probe failed' }
}

# ---------------------------------------------------------------- 02 HARDWARE
Section '02' 'CPU / RAM / GPU / DISK'
try {
    $cs = Get-CimInstance Win32_ComputerSystem
    $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
    KV 'CPU'            $cpu.Name
    KV 'Cores/Threads'  "$($cpu.NumberOfCores) / $($cpu.NumberOfLogicalProcessors)"
    KV 'RAM (GB)'       ([math]::Round($cs.TotalPhysicalMemory/1GB,1))
    KV 'Manufacturer'   $cs.Manufacturer
    KV 'Model'          $cs.Model
} catch { Note "hardware probe failed: $($_.Exception.Message)" }
try {
    foreach ($g in Get-CimInstance Win32_VideoController) {
        KV 'GPU' "$($g.Name)  vram=$([math]::Round($g.AdapterRAM/1MB,0))MB  driver=$($g.DriverVersion)"
    }
} catch { Note 'GPU probe failed' }
try {
    foreach ($d in Get-PSDrive -PSProvider FileSystem) {
        if ($null -ne $d.Free) {
            KV "Drive $($d.Name):" "free=$([math]::Round($d.Free/1GB,1))GB  used=$([math]::Round($d.Used/1GB,1))GB"
        }
    }
} catch { }

# ---------------------------------------------------------------- 03 NODE
Section '03' 'NODE / NPM / NPX / PNPM / YARN / BUN'
Probe-Cmd 'node'; Probe-Cmd 'npm'; Probe-Cmd 'npx'
Probe-Cmd 'pnpm'; Probe-Cmd 'yarn'; Probe-Cmd 'bun'
Probe-Cmd 'tsc'; Probe-Cmd 'tsx'; Probe-Cmd 'deno'
Probe-EnvPresence @('NODE_ENV','NODE_OPTIONS','NPM_CONFIG_PREFIX','NVM_HOME','NVM_SYMLINK')
if (Get-Command npm -ErrorAction SilentlyContinue) {
    Note 'globally installed npm packages (npm ls -g --depth=0 - read-only, may take ~15s):'
    try { (npm ls -g --depth=0 2>&1) | Select-Object -First 60 | ForEach-Object { Line $_ } }
    catch { Line 'probe failed' }
    Note 'npm prefix / cache locations:'
    try { Line "prefix: $(npm config get prefix 2>&1)"; Line "cache : $(npm config get cache 2>&1)" } catch { }
}

# ---------------------------------------------------------------- 04 PYTHON
Section '04' 'PYTHON / PIP'
Probe-Cmd 'python'; Probe-Cmd 'python3'; Probe-Cmd 'py' '-0'
Probe-Cmd 'pip'; Probe-Cmd 'pip3'; Probe-Cmd 'uv'; Probe-Cmd 'pipx'; Probe-Cmd 'conda'
if (Get-Command pip -ErrorAction SilentlyContinue) {
    Note 'pip list (read-only) - first 40, filtered to AI/web/automation relevance:'
    try {
        (pip list 2>&1) | Select-String -Pattern 'openai|anthropic|google|genai|langchain|llama|playwright|selenium|requests|fastapi|flask|django|pillow|numpy|torch|transformers|mcp|httpx' |
            Select-Object -First 40 | ForEach-Object { Line $_ }
    } catch { Line 'probe failed' }
}

# ---------------------------------------------------------------- 05 GIT
Section '05' 'GIT'
Probe-Cmd 'git'; Probe-Cmd 'gh'; Probe-Cmd 'git-lfs' 'version'
if (Get-Command git -ErrorAction SilentlyContinue) {
    Note 'global git config (credential-bearing keys are redacted):'
    try {
        (git config --global --list 2>&1) | Select-Object -First 40 | ForEach-Object {
            $parts = $_ -split '=', 2
            if ($parts.Count -eq 2) { Line "$($parts[0]) = $(Protect-Value $parts[0] $parts[1])" } else { Line $_ }
        }
    } catch { Line 'probe failed' }
    KV 'credential.helper' $(try { git config --global credential.helper 2>&1 } catch { 'UNKNOWN' })
}

# ---------------------------------------------------------------- 06 DOCKER
Section '06' 'DOCKER / DOCKER COMPOSE'
Probe-Cmd 'docker'; Probe-Cmd 'docker-compose'; Probe-Cmd 'podman'
Note 'Docker desktop/daemon state (checked BEFORE any docker CLI call, so a stopped daemon is never woken):'
$dockerProc = Get-Process -Name 'com.docker.backend','Docker Desktop','dockerd' -ErrorAction SilentlyContinue
$dockerSvc  = Get-Service -Name 'com.docker.service','docker' -ErrorAction SilentlyContinue
KV 'docker processes running' $(if ($dockerProc) { ($dockerProc | Select-Object -ExpandProperty Name -Unique) -join ', ' } else { 'NONE' })
foreach ($s in $dockerSvc) { KV "service $($s.Name)" "$($s.Status) / startup=$($s.StartType)" }
$DockerUp = [bool]($dockerProc -or ($dockerSvc | Where-Object { $_.Status -eq 'Running' }))
KV 'daemon appears up' $DockerUp
if (-not $DockerUp) { Note 'Docker daemon not running - skipping all docker queries (nothing was started).' }

# ---------------------------------------------------------------- 07 N8N
Section '07' 'N8N'
Probe-Cmd 'n8n'
$n8nHome = Join-Path $env:USERPROFILE '.n8n'
Probe-Path 'n8n home' $n8nHome -Count
$n8nFound = Test-Path -LiteralPath $n8nHome
Probe-Path 'n8n database'      (Join-Path $n8nHome 'database.sqlite')
Probe-Path 'n8n config file'   (Join-Path $n8nHome 'config')
Probe-Path 'n8n nodes dir'     (Join-Path $n8nHome 'nodes')
Probe-Path 'n8n custom dir'    (Join-Path $n8nHome 'custom')
Probe-EnvPresence @('N8N_PORT','N8N_HOST','N8N_PROTOCOL','N8N_ENCRYPTION_KEY','N8N_USER_FOLDER','WEBHOOK_URL','N8N_BASIC_AUTH_ACTIVE','DB_TYPE')
Note 'n8n installed globally via npm?'
try { (npm ls -g --depth=0 2>&1 | Select-String -Pattern 'n8n') | ForEach-Object { Line $_ } } catch { }
Note 'port 5678 (n8n default) listening?'
$p5678 = Get-NetTCPConnection -LocalPort 5678 -State Listen -ErrorAction SilentlyContinue
KV 'n8n port 5678' $(if ($p5678) { 'LISTENING' } else { 'not listening' })

# ---------------------------------------------------------------- 08 PLAYWRIGHT
Section '08' 'PLAYWRIGHT / CHROMIUM'
Probe-Cmd 'playwright'
Probe-EnvPresence @('PLAYWRIGHT_BROWSERS_PATH','PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD','PLAYWRIGHT_DOWNLOAD_HOST')
$pwCache = Join-Path $env:LOCALAPPDATA 'ms-playwright'
Probe-Path 'playwright browser cache' $pwCache
if (Test-Path -LiteralPath $pwCache) {
    Get-ChildItem -LiteralPath $pwCache -Directory -ErrorAction SilentlyContinue |
        Select-Object -First 20 | ForEach-Object {
            $sz = 0
            try { $sz = [math]::Round((Get-ChildItem -LiteralPath $_.FullName -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum/1MB,0) } catch {}
            Line "$($_.Name)  (${sz}MB)  modified=$($_.LastWriteTime)"
        }
}
Probe-Path 'repo node_modules/playwright' (Join-Path $RepoRoot 'node_modules\playwright')
Probe-Path 'repo node_modules present'    (Join-Path $RepoRoot 'node_modules')

# ---------------------------------------------------------------- 09 BROWSERS
Section '09' 'CHROME / EDGE / OTHER BROWSERS'
$browsers = @{
    'Chrome (x64)'      = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
    'Chrome (x86)'      = "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
    'Edge'              = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
    'Edge (x64)'        = "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
    'Firefox'           = "$env:ProgramFiles\Mozilla Firefox\firefox.exe"
    'Brave'             = "$env:ProgramFiles\BraveSoftware\Brave-Browser\Application\brave.exe"
}
foreach ($b in $browsers.GetEnumerator()) {
    if (Test-Path -LiteralPath $b.Value) {
        $v = (Get-Item -LiteralPath $b.Value).VersionInfo.ProductVersion
        KV $b.Key "PRESENT  ver=$v"
    } else { KV $b.Key 'ABSENT' }
}

# ---------------------------------------------------------------- 10 CLAUDE
Section '10' 'CLAUDE CODE / CLAUDE DESKTOP'
Probe-Cmd 'claude'
$claudeHome = Join-Path $env:USERPROFILE '.claude'
Probe-Path 'user .claude dir'        $claudeHome -Count
Probe-Path 'user .claude.json'       (Join-Path $env:USERPROFILE '.claude.json')
Probe-Path 'user settings.json'      (Join-Path $claudeHome 'settings.json')
Probe-Path 'CLAUDE.md (user)'        (Join-Path $claudeHome 'CLAUDE.md')
Probe-Path 'project .claude dir'     (Join-Path $RepoRoot '.claude') -Count
Probe-Path 'project settings.json'   (Join-Path $RepoRoot '.claude\settings.json')
Probe-Path 'project settings.local'  (Join-Path $RepoRoot '.claude\settings.local.json')
Probe-Path 'project CLAUDE.md'       (Join-Path $RepoRoot 'CLAUDE.md')
Probe-Path 'Claude Desktop config'   (Join-Path $env:APPDATA 'Claude\claude_desktop_config.json')
Probe-Path 'Claude Desktop dir'      (Join-Path $env:APPDATA 'Claude') -Count
Note 'contents of ~/.claude (top level):'
Get-ChildItem -LiteralPath $claudeHome -Force -ErrorAction SilentlyContinue |
    Select-Object -First 40 | ForEach-Object {
        $tag = if ($_.PSIsContainer) { 'DIR ' } else { 'FILE' }
        Line "$tag $($_.Name)"
    }
Note 'user settings.json structure (values protected):'
try {
    $sp = Join-Path $claudeHome 'settings.json'
    if (Test-Path -LiteralPath $sp) { Show-JsonSafe (Get-Content -LiteralPath $sp -Raw | ConvertFrom-Json) }
    else { Line 'ABSENT' }
} catch { Line "unparseable: $($_.Exception.Message)" }

# ---------------------------------------------------------------- 11 GEMINI
Section '11' 'GEMINI TOOLING'
Probe-Cmd 'gemini'
Probe-Path 'user .gemini dir'   (Join-Path $env:USERPROFILE '.gemini') -Count
Probe-Path 'gemini settings'    (Join-Path $env:USERPROFILE '.gemini\settings.json')
Probe-Path 'GEMINI.md (user)'   (Join-Path $env:USERPROFILE '.gemini\GEMINI.md')
Probe-Path 'project .gemini'    (Join-Path $RepoRoot '.gemini') -Count
Probe-Path 'gcloud config dir'  (Join-Path $env:APPDATA 'gcloud') -Count
Probe-Cmd 'gcloud'
Probe-EnvPresence @('GEMINI_API_KEY','GOOGLE_API_KEY','GOOGLE_APPLICATION_CREDENTIALS','GOOGLE_CLOUD_PROJECT','GEMINI_BASE_URL')
Note 'gemini settings.json structure (values protected):'
try {
    $gp = Join-Path $env:USERPROFILE '.gemini\settings.json'
    if (Test-Path -LiteralPath $gp) { Show-JsonSafe (Get-Content -LiteralPath $gp -Raw | ConvertFrom-Json) } else { Line 'ABSENT' }
} catch { Line 'unparseable' }

# ---------------------------------------------------------------- 12 OPENAI
Section '12' 'OPENAI TOOLING'
Probe-Cmd 'openai'; Probe-Cmd 'codex'; Probe-Cmd 'chatgpt'
Probe-Path 'user .openai dir'   (Join-Path $env:USERPROFILE '.openai') -Count
Probe-Path 'user .codex dir'    (Join-Path $env:USERPROFILE '.codex') -Count
Probe-Path 'codex config'       (Join-Path $env:USERPROFILE '.codex\config.toml')
Probe-Path 'AGENTS.md (project)' (Join-Path $RepoRoot 'AGENTS.md')
Probe-EnvPresence @('OPENAI_API_KEY','OPENAI_BASE_URL','OPENAI_ORG_ID','OPENAI_PROJECT','AZURE_OPENAI_API_KEY','AZURE_OPENAI_ENDPOINT')

# ---------------------------------------------------------------- 13 ANTIGRAVITY
Section '13' 'ANTIGRAVITY'
Note 'No file in the BusinessForge repository references Antigravity. Searching the machine for it.'
Probe-Cmd 'antigravity'; Probe-Cmd 'ag'
foreach ($p in @(
    "$env:LOCALAPPDATA\Antigravity", "$env:APPDATA\Antigravity",
    "$env:ProgramFiles\Antigravity", "${env:ProgramFiles(x86)}\Antigravity",
    "$env:USERPROFILE\.antigravity", "$env:USERPROFILE\.gravity",
    "$env:LOCALAPPDATA\Programs\Antigravity"
)) { Probe-Path "path" $p -Count }
Note 'registry uninstall entries matching antigravity/gravity:'
try {
    Get-ItemProperty 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
                     'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
                     'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue |
        Where-Object { $_.DisplayName -match '(?i)antigravity|gravity' } |
        Select-Object DisplayName, DisplayVersion, InstallLocation |
        ForEach-Object { Line "$($_.DisplayName) $($_.DisplayVersion) -> $($_.InstallLocation)" }
} catch { }
Note 'bounded directory search (depth 2) under %LOCALAPPDATA%, %APPDATA%, %USERPROFILE%:'
Find-Dirs @($env:LOCALAPPDATA, $env:APPDATA, $env:USERPROFILE) '*ntigravit*' 2 10 | ForEach-Object { Line $_.FullName }

# ---------------------------------------------------------------- 14 HERMES
Section '14' 'HERMES'
Note 'No file in the BusinessForge repository references Hermes. Searching the machine for it.'
Probe-Cmd 'hermes'
foreach ($p in @(
    "$env:LOCALAPPDATA\Hermes", "$env:APPDATA\Hermes",
    "$env:ProgramFiles\Hermes", "${env:ProgramFiles(x86)}\Hermes",
    "$env:USERPROFILE\.hermes", "$env:LOCALAPPDATA\Programs\Hermes"
)) { Probe-Path "path" $p -Count }
Note 'registry uninstall entries matching hermes:'
try {
    Get-ItemProperty 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
                     'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
                     'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue |
        Where-Object { $_.DisplayName -match '(?i)hermes' } |
        Select-Object DisplayName, DisplayVersion, InstallLocation |
        ForEach-Object { Line "$($_.DisplayName) $($_.DisplayVersion) -> $($_.InstallLocation)" }
} catch { }
Find-Dirs @($env:LOCALAPPDATA, $env:APPDATA, $env:USERPROFILE) '*ermes*' 2 10 | ForEach-Object { Line $_.FullName }

# ---------------------------------------------------------------- 15 OTHER AI AGENTS
Section '15' 'OTHER AI CODING AGENTS / EDITORS'
foreach ($c in @('cursor','windsurf','aider','cline','continue','copilot','zed','codeium','ollama','lmstudio','llm','goose','opencode','crush','amp')) { Probe-Cmd $c }
foreach ($p in @(
    "$env:LOCALAPPDATA\Programs\cursor",  "$env:APPDATA\Cursor",       "$env:USERPROFILE\.cursor",
    "$env:LOCALAPPDATA\Programs\Windsurf","$env:APPDATA\Windsurf",     "$env:USERPROFILE\.windsurf",
    "$env:APPDATA\Code\User",             "$env:USERPROFILE\.vscode",  "$env:USERPROFILE\.aider",
    "$env:USERPROFILE\.ollama",           "$env:USERPROFILE\.continue","$env:USERPROFILE\.config\github-copilot"
)) { Probe-Path 'path' $p -Count }
Note 'installed programs matching AI/editor keywords (registry, read-only):'
try {
    Get-ItemProperty 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
                     'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
                     'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue |
        Where-Object { $_.DisplayName -match '(?i)claude|cursor|windsurf|copilot|openai|chatgpt|gemini|anthropic|ollama|lm studio|zed|codeium|jetbrains|visual studio code|node|python|docker|git' } |
        Select-Object DisplayName, DisplayVersion |
        Sort-Object DisplayName -Unique |
        ForEach-Object { Line "$($_.DisplayName)  $($_.DisplayVersion)" }
} catch { Note 'registry probe failed' }

# ---------------------------------------------------------------- 16/17 MCP
Section '16' 'MCP CONFIGURATION FILES'
$mcpCandidates = @(
    (Join-Path $env:APPDATA      'Claude\claude_desktop_config.json'),
    (Join-Path $env:USERPROFILE  '.claude.json'),
    (Join-Path $env:USERPROFILE  '.claude\settings.json'),
    (Join-Path $env:USERPROFILE  '.claude\mcp.json'),
    (Join-Path $RepoRoot         '.mcp.json'),
    (Join-Path $RepoRoot         '.claude\settings.json'),
    (Join-Path $RepoRoot         '.claude\settings.local.json'),
    (Join-Path $env:USERPROFILE  '.cursor\mcp.json'),
    (Join-Path $RepoRoot         '.cursor\mcp.json'),
    (Join-Path $env:APPDATA      'Code\User\settings.json'),
    (Join-Path $env:APPDATA      'Windsurf\User\settings.json'),
    (Join-Path $env:USERPROFILE  '.codex\config.toml'),
    (Join-Path $env:USERPROFILE  '.gemini\settings.json')
)
$mcpPresent = @()
foreach ($m in $mcpCandidates) {
    Probe-Path 'mcp candidate' $m
    if (Test-Path -LiteralPath $m) { $mcpPresent += $m }
}
Note 'bounded search for any other mcp*.json (depth 3):'
try {
    Get-ChildItem -LiteralPath $env:USERPROFILE -Recurse -Depth 3 -Filter 'mcp*.json' -File -Force -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notmatch '\\node_modules\\' } |
        Select-Object -First 20 | ForEach-Object { Line $_.FullName; $script:extra = $_.FullName }
} catch { }

Section '17' 'MCP SERVERS DECLARED (names / transport / command only - env values redacted)'
foreach ($m in $mcpPresent) {
    if ($m -like '*.toml') { Note "$m is TOML; showing non-secret lines only:";
        try { Get-Content -LiteralPath $m -ErrorAction SilentlyContinue | Select-Object -First 60 | ForEach-Object {
            $l = $_
            if ($l -match '^\s*([A-Za-z_][\w\-]*)\s*=\s*(.+)$') { Line "$($Matches[1]) = $(Protect-Value $Matches[1] $Matches[2])" }
            else { Line $l }
        } } catch { }
        continue
    }
    Write-Output ''
    Note "FILE: $m"
    try {
        $j = Get-Content -LiteralPath $m -Raw -ErrorAction Stop | ConvertFrom-Json
        $found = $false
        foreach ($prop in @('mcpServers','servers','mcp')) {
            if ($j.PSObject.Properties.Name -contains $prop -and $j.$prop) {
                $found = $true
                Line "[$prop]"
                foreach ($s in $j.$prop.PSObject.Properties) {
                    Line "  server: $($s.Name)"
                    $cfg = $s.Value
                    foreach ($f in @('type','transport','url','endpoint','command')) {
                        if ($cfg.PSObject.Properties.Name -contains $f) { Line "    ${f}: $(Protect-Value $f $cfg.$f)" }
                    }
                    if ($cfg.PSObject.Properties.Name -contains 'args') { Line "    args: $((@($cfg.args) | ForEach-Object { Protect-Value '' $_ }) -join ' ')" }
                    if ($cfg.PSObject.Properties.Name -contains 'env')  {
                        $names = @($cfg.env.PSObject.Properties.Name)
                        Line "    env keys: $($names -join ', ')   [ALL VALUES REDACTED]"
                    }
                    if ($cfg.PSObject.Properties.Name -contains 'headers') {
                        Line "    header keys: $(@($cfg.headers.PSObject.Properties.Name) -join ', ')   [ALL VALUES REDACTED]"
                    }
                    if ($cfg.PSObject.Properties.Name -contains 'disabled') { Line "    disabled: $($cfg.disabled)" }
                }
            }
        }
        # Claude Code stores per-project MCP + permissions under "projects".
        if ($j.PSObject.Properties.Name -contains 'projects') {
            Line '[projects] - per-project MCP / tool policy:'
            foreach ($pr in $j.projects.PSObject.Properties) {
                Line "  project: $($pr.Name)"
                $pv = $pr.Value
                foreach ($f in @('mcpServers','enabledMcpjsonServers','disabledMcpjsonServers','allowedTools','hasTrustDialogAccepted')) {
                    if ($pv.PSObject.Properties.Name -contains $f) {
                        $val = $pv.$f
                        if ($null -eq $val) { Line "    ${f}: null" }
                        elseif ($val -is [System.Collections.IEnumerable] -and $val -isnot [string]) {
                            if ($f -eq 'mcpServers') { Line "    ${f}: $(@($val.PSObject.Properties.Name) -join ', ')" }
                            else { Line "    ${f}: [$((@($val)) -join ', ')]" }
                        }
                        elseif ($val -is [pscustomobject]) { Line "    ${f}: $(@($val.PSObject.Properties.Name) -join ', ')" }
                        else { Line "    ${f}: $val" }
                    }
                }
            }
            $found = $true
        }
        if (-not $found) { Line 'no mcpServers / servers / projects key in this file' }
    } catch { Line "unparseable or unreadable: $($_.Exception.Message)" }
}
if ($mcpPresent.Count -eq 0) { Note 'No MCP configuration file found at any known location.' }

# ---------------------------------------------------------------- 18 CLAUDE SKILLS
Section '18' 'CLAUDE SKILLS / PLUGINS / AGENTS / COMMANDS'
foreach ($d in @('skills','plugins','agents','commands','hooks','mcp','projects','todos','statsig','shell-snapshots')) {
    $p = Join-Path $claudeHome $d
    Probe-Path "~/.claude/$d" $p -Count
    if (Test-Path -LiteralPath $p) {
        Get-ChildItem -LiteralPath $p -Force -ErrorAction SilentlyContinue | Select-Object -First 30 | ForEach-Object {
            $tag = if ($_.PSIsContainer) { 'DIR ' } else { 'FILE' }
            Line "$tag $($_.Name)"
        }
    }
}
Note 'skill definitions found (SKILL.md files, name + description line only):'
foreach ($root in @((Join-Path $claudeHome 'skills'), (Join-Path $RepoRoot '.claude\skills'), (Join-Path $claudeHome 'plugins'))) {
    if (-not (Test-Path -LiteralPath $root)) { continue }
    Get-ChildItem -LiteralPath $root -Recurse -Depth 3 -Filter 'SKILL.md' -File -Force -ErrorAction SilentlyContinue |
        Select-Object -First 60 | ForEach-Object {
            $rel = $_.FullName.Replace($env:USERPROFILE,'~')
            $nm  = (Select-String -LiteralPath $_.FullName -Pattern '^name:\s*(.+)$'        -List).Matches.Groups[1].Value
            $ds  = (Select-String -LiteralPath $_.FullName -Pattern '^description:\s*(.+)$' -List).Matches.Groups[1].Value
            Line "$rel"
            Line "    name: $nm"
            if ($ds) { Line "    desc: $($ds.Substring(0,[Math]::Min(140,$ds.Length)))" }
        }
}
Note 'project-level agent / command definitions:'
foreach ($p in @((Join-Path $RepoRoot '.claude\agents'), (Join-Path $RepoRoot '.claude\commands'), (Join-Path $RepoRoot '.claude\skills'))) {
    if (Test-Path -LiteralPath $p) {
        Get-ChildItem -LiteralPath $p -Recurse -File -Force -ErrorAction SilentlyContinue | Select-Object -First 30 | ForEach-Object { Line $_.FullName.Replace($RepoRoot,'.') }
    } else { Line "ABSENT $p" }
}

# ---------------------------------------------------------------- 19 ANTIGRAVITY SKILLS
Section '19' 'ANTIGRAVITY SKILLS / EXTENSIONS'
$agRoots = @("$env:USERPROFILE\.antigravity", "$env:APPDATA\Antigravity", "$env:LOCALAPPDATA\Antigravity")
$agAny = $false
foreach ($r in $agRoots) {
    if (Test-Path -LiteralPath $r) {
        $agAny = $true
        Note "tree under $r (depth 2):"
        Get-ChildItem -LiteralPath $r -Recurse -Depth 2 -Force -ErrorAction SilentlyContinue | Select-Object -First 60 | ForEach-Object {
            $tag = if ($_.PSIsContainer) { 'DIR ' } else { 'FILE' }
            Line "$tag $($_.FullName.Replace($env:USERPROFILE,'~'))"
        }
    }
}
if (-not $agAny) { KV 'Antigravity config roots' 'ABSENT - no skills/extensions to enumerate' }

# ---------------------------------------------------------------- 20 HERMES SKILLS
Section '20' 'HERMES SKILLS / TOOLS'
$hRoots = @("$env:USERPROFILE\.hermes", "$env:APPDATA\Hermes", "$env:LOCALAPPDATA\Hermes")
$hAny = $false
foreach ($r in $hRoots) {
    if (Test-Path -LiteralPath $r) {
        $hAny = $true
        Note "tree under $r (depth 2):"
        Get-ChildItem -LiteralPath $r -Recurse -Depth 2 -Force -ErrorAction SilentlyContinue | Select-Object -First 60 | ForEach-Object {
            $tag = if ($_.PSIsContainer) { 'DIR ' } else { 'FILE' }
            Line "$tag $($_.FullName.Replace($env:USERPROFILE,'~'))"
        }
    }
}
if (-not $hAny) { KV 'Hermes config roots' 'ABSENT - no skills/tools to enumerate' }

# ---------------------------------------------------------------- 21 ENV PRESENCE
Section '21' 'ENVIRONMENT VARIABLES - PRESENCE ONLY, VALUES NEVER READ'
Note 'Every BusinessForge variable from .env.example, plus common AI/dev vars.'
Note 'Secret-named variables report PRESENT/ABSENT only; the value is never accessed for output.'
Probe-EnvPresence @(
    'AI_PROVIDER','ANTHROPIC_API_KEY','ANTHROPIC_BASE_URL','OPENAI_API_KEY','OPENAI_BASE_URL',
    'GEMINI_API_KEY','GEMINI_BASE_URL','OPENROUTER_API_KEY','OPENROUTER_BASE_URL',
    'OPENROUTER_REFERER','OPENROUTER_TITLE',
    'ANALYST_MODEL','ANALYST_EFFORT','ANALYST_MAX_OUTPUT_TOKENS','ANALYST_MAX_PAGE_CHARS',
    'WRITER_MODEL','WRITER_EFFORT','WRITER_MAX_OUTPUT_TOKENS','WRITER_MAX_PAGE_CHARS',
    'LOVABLE_API_KEY','LOVABLE_BASE_URL','LOVABLE_PROJECT_ID','LOVABLE_DEPLOY_TIMEOUT_MS',
    'BROWSER_HEADLESS','BROWSER_TIMEOUT_MS','BROWSER_LOCALE','BROWSER_USER_AGENT','BROWSER_PROXY_URL',
    'COLLECTOR_MAX_PAGES','COLLECTOR_MAX_IMAGES','COLLECTOR_ASSET_DIR',
    'OUTPUT_DIR','LOG_LEVEL','FEATURE_FLAGS','SKILLS_DIR','SKILLS_ENABLED','SKILLS_DISABLED',
    'MCP_SERVERS','MCP_ENABLED','MCP_DISABLED','TELEMETRY_ENABLED',
    'GOOGLE_MAPS_API_KEY','FIRECRAWL_API_KEY','CMS_API_KEY','EMAIL_API_KEY','PAYMENTS_API_KEY',
    'CALENDAR_API_KEY','SOCIAL_API_KEY','SEARCH_API_KEY','DATABASE_URL','GITHUB_TOKEN',
    'HTTP_PROXY','HTTPS_PROXY','NO_PROXY','CLAUDE_CODE_OAUTH_TOKEN','VERCEL_TOKEN','NETLIFY_AUTH_TOKEN'
)
Note 'any OTHER environment variable whose NAME matches a design-direction feature flag:'
Get-ChildItem Env: -ErrorAction SilentlyContinue | Where-Object { $_.Name -like 'FEATURE_*' } |
    ForEach-Object { KV $_.Name "PRESENT  = $(Protect-Value $_.Name $_.Value)" }

# ---------------------------------------------------------------- 22 PORTS
Section '22' 'LISTENING TCP PORTS (localhost-relevant)'
try {
    $conns = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue
    if (-not $conns) { Note 'no listening TCP sockets found (or insufficient privilege)' }
    $rows = foreach ($c in $conns) {
        $pr = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
        [pscustomobject]@{
            Port    = $c.LocalPort
            Address = $c.LocalAddress
            PID     = $c.OwningProcess
            Process = if ($pr) { $pr.ProcessName } else { 'UNKNOWN' }
            Path    = if ($pr) { $pr.Path } else { '' }
        }
    }
    $rows | Sort-Object Port -Unique | Select-Object -First 80 | ForEach-Object {
        Line ("{0,-6} {1,-14} pid={2,-7} {3,-22} {4}" -f $_.Port, $_.Address, $_.PID, $_.Process, $_.Path)
    }
    Note 'ports of specific interest:'
    foreach ($pp in @(3000,3001,4000,5000,5173,5678,8000,8080,8081,8888,9000,11434,1234,6333,7474)) {
        $hit = $rows | Where-Object { $_.Port -eq $pp } | Select-Object -First 1
        if ($hit) { KV "port $pp" "LISTENING  $($hit.Process) (pid $($hit.PID))" }
    }
} catch { Note "port probe failed: $($_.Exception.Message)" }

# ---------------------------------------------------------------- 23 SERVICES
Section '23' 'RELEVANT LOCAL SERVICES'
try {
    Get-Service -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '(?i)docker|n8n|postgres|mysql|mariadb|mongo|redis|nginx|apache|iis|w3svc|mssql|ollama|elastic|rabbit' } |
        Select-Object -First 40 | ForEach-Object {
            Line ("{0,-30} {1,-10} startup={2}" -f $_.Name, $_.Status, $_.StartType)
        }
    Note 'if nothing listed above, no matching service is installed'
} catch { Note 'service probe failed' }

# ---------------------------------------------------------------- 24 PROCESSES
Section '24' 'WEBSITEAGENT / RELEVANT PROCESSES'
try {
    $procs = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '(?i)^(node|npm|chrome|msedge|python|claude|docker|n8n)' -or $_.CommandLine -match '(?i)websiteagent|businessforge|playwright|n8n' }
    if (-not $procs) { Note 'no matching processes running' }
    foreach ($p in ($procs | Select-Object -First 40)) {
        # Command lines can embed secrets; protect them.
        $cl = if ($p.CommandLine) { Protect-Value '' $p.CommandLine } else { '' }
        Line ("pid={0,-7} {1,-14} {2}" -f $p.ProcessId, $p.Name, $cl)
    }
} catch { Note "process probe failed: $($_.Exception.Message)" }

# ---------------------------------------------------------------- 25 WA CONFIG
Section '25' 'WEBSITEAGENT CONFIGURATION'
KV 'repo root' $RepoRoot
Probe-Path 'package.json'      (Join-Path $RepoRoot 'package.json')
Probe-Path 'package-lock.json' (Join-Path $RepoRoot 'package-lock.json')
Probe-Path '.env'              (Join-Path $RepoRoot '.env')
Probe-Path '.env.local'        (Join-Path $RepoRoot '.env.local')
Probe-Path '.env.example'      (Join-Path $RepoRoot '.env.example')
Probe-Path 'tsconfig.json'     (Join-Path $RepoRoot 'tsconfig.json')
Probe-Path 'dist/'             (Join-Path $RepoRoot 'dist') -Count
Probe-Path '.github/'          (Join-Path $RepoRoot '.github') -Count

Note '.env VARIABLE NAMES ONLY - values are never read into this report:'
$envFile = Join-Path $RepoRoot '.env'
if (Test-Path -LiteralPath $envFile) {
    try {
        Get-Content -LiteralPath $envFile -ErrorAction Stop | ForEach-Object {
            $l = $_.Trim()
            if ($l.Length -eq 0 -or $l.StartsWith('#')) { return }
            $i = $l.IndexOf('=')
            if ($i -lt 1) { return }
            $k = $l.Substring(0,$i).Trim()
            $hasVal = ($l.Substring($i+1).Trim().Length -gt 0)
            if ($k -match $SecretNameRx) { Line "$k = $(if ($hasVal) { 'PRESENT [REDACTED]' } else { 'ABSENT (empty)' })" }
            else { Line "$k = $(if ($hasVal) { 'SET (non-secret name; value withheld for safety)' } else { 'empty' })" }
        }
    } catch { Line "unreadable: $($_.Exception.Message)" }
} else { Line '.env ABSENT - stages 4 and 5 cannot run' }

Note 'git state:'
try {
    Line "branch    : $(git rev-parse --abbrev-ref HEAD 2>&1)"
    Line "HEAD      : $(git rev-parse --short HEAD 2>&1)"
    Line "remote    : $(git config --get remote.origin.url 2>&1)"
    Line "dirty     : $(@(git status --porcelain 2>&1).Count) changed path(s)"
    Note 'last 12 commits:'
    (git log --oneline -12 2>&1) | ForEach-Object { Line $_ }
    Note 'local branches:'
    (git branch 2>&1) | ForEach-Object { Line $_ }
} catch { Line 'git probe failed' }

# ---------------------------------------------------------------- 26 OUTPUT DIRS
Section '26' 'WEBSITEAGENT OUTPUT DIRECTORIES + RUN MANIFEST'
$outRoot = Join-Path $RepoRoot 'output'
if (-not (Test-Path -LiteralPath $outRoot)) {
    KV 'output/' 'ABSENT'
} else {
    $runs = Get-ChildItem -LiteralPath $outRoot -Directory -Force -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
    KV 'output/ run directories' @($runs).Count
    Note 'RUN MANIFEST - one block per run directory. This is the highest-value section:'
    foreach ($r in ($runs | Select-Object -First 60)) {
        Write-Output ''
        Line "RUN: $($r.Name)    modified=$($r.LastWriteTime)"
        $files = Get-ChildItem -LiteralPath $r.FullName -Force -ErrorAction SilentlyContinue
        Line "  files: $((@($files | Where-Object { -not $_.PSIsContainer } | Select-Object -ExpandProperty Name)) -join ', ')"
        Line "  dirs : $((@($files | Where-Object { $_.PSIsContainer } | Select-Object -ExpandProperty Name)) -join ', ')"

        # Which stage artifacts exist?
        foreach ($a in @('1-discovery.json','2-collected.json','3-profile.json','4-strategy.json','5-content.json','5b-design.json','6-deployment.json','result.json','run.log.ndjson')) {
            $ap = Join-Path $r.FullName $a
            if (Test-Path -LiteralPath $ap) {
                $sz = (Get-Item -LiteralPath $ap).Length
                Line "  [x] $a  ${sz}B"
            } else { Line "  [ ] $a" }
        }
        $siteIdx = Join-Path $r.FullName 'site\index.html'
        if (Test-Path -LiteralPath $siteIdx) {
            $sz = (Get-Item -LiteralPath $siteIdx).Length
            $nAssets = @(Get-ChildItem -LiteralPath (Join-Path $r.FullName 'site') -Recurse -File -ErrorAction SilentlyContinue).Count
            Line "  [x] site/index.html  ${sz}B   site files total: $nAssets"
        } else { Line "  [ ] site/index.html" }
        $assetDir = Join-Path $r.FullName 'assets'
        if (Test-Path -LiteralPath $assetDir) {
            Line "  [x] assets/  $(@(Get-ChildItem -LiteralPath $assetDir -File -ErrorAction SilentlyContinue).Count) files"
        }

        # Identity + which model actually served stage 4/5 + what the design decided.
        try {
            $dp = Join-Path $r.FullName '1-discovery.json'
            if (Test-Path -LiteralPath $dp) {
                $d = Get-Content -LiteralPath $dp -Raw | ConvertFrom-Json
                Line "  business : $($d.name)"
                Line "  category : $($d.category)"
                Line "  address  : $($d.address)"
                Line "  website  : $($d.website)"
                Line "  rating   : $($d.rating)  reviews=$($d.reviewCount)  hoursEntries=$(@($d.hours).Count)"
                Line "  sourceUrl: $($d.sourceUrl)"
            }
        } catch { Line '  (1-discovery.json unparseable)' }
        try {
            $sp2 = Join-Path $r.FullName '4-strategy.json'
            if (Test-Path -LiteralPath $sp2) {
                $s = Get-Content -LiteralPath $sp2 -Raw | ConvertFrom-Json
                Line "  STAGE4 MODEL SERVED: $($s.model)      generatedAt=$($s.generatedAt)"
                Line "  strategy counts: goals=$(@($s.goals).Count) pages=$(@($s.pages).Count) features=$(@($s.features).Count) backend=$(@($s.backendModules).Count) frontend=$(@($s.frontendModules).Count) seo=$(@($s.seoPriorities).Count) openQ=$(@($s.openQuestions).Count)"
            }
        } catch { Line '  (4-strategy.json unparseable)' }
        try {
            $cp = Join-Path $r.FullName '5-content.json'
            if (Test-Path -LiteralPath $cp) {
                $c = Get-Content -LiteralPath $cp -Raw | ConvertFrom-Json
                $words = 0; $imgs = 0
                foreach ($sec in $c.sections) {
                    $words += (($sec.heading + ' ' + $sec.subheading + ' ' + $sec.body + ' ' + ($sec.bullets -join ' ')) -split '\s+' | Where-Object { $_ }).Count
                    $imgs  += @($sec.images).Count
                }
                Line "  content  : sections=$(@($c.sections).Count) words~$words images=$imgs gaps=$(@($c.unresolvedGaps).Count)"
                Line "  sectionKinds: $((@($c.sections | ForEach-Object { $_.kind })) -join ' -> ')"
                Line "  tagline  : $($c.tagline)"
                Line "  fonts    : heading=$($c.voice.typography.heading) body=$($c.voice.typography.body)  tone=$($c.voice.tone)"
            }
        } catch { Line '  (5-content.json unparseable)' }
        try {
            $gp2 = Join-Path $r.FullName '5b-design.json'
            if (Test-Path -LiteralPath $gp2) {
                $g = Get-Content -LiteralPath $gp2 -Raw | ConvertFrom-Json
                Line "  DESIGN   : industry=$($g.industry.id) basis=$($g.industry.basis) direction=$($g.personality.direction) density=$($g.personality.density)"
                Line "  design   : hero=$($g.layout.hero) footer=$($g.layout.footer) scheme=$($g.tokens.color.scheme) brand=$($g.tokens.color.semantic.brand) accent=$($g.tokens.color.semantic.accent)"
                $vlist = @()
                foreach ($sd in $g.layout.sections) { $vlist += ($sd.kind + ':' + $sd.variant) }
                Line "  variants : $($vlist -join ', ')"
                $flist = @()
                foreach ($sd in $g.layout.sections) { $flist += ($sd.kind + ':' + $sd.frame + '/' + $sd.background + '/' + $sd.emphasis) }
                Line "  frames   : $($flist -join ', ')"
                Line "  notes    : $(@($g.notes).Count)"
                foreach ($nt in (@($g.notes) | Select-Object -First 6)) { Line "     note: $nt" }
            }
        } catch { Line '  (5b-design.json unparseable)' }
    }
    Note 'non-run entries directly under output/:'
    Get-ChildItem -LiteralPath $outRoot -File -Force -ErrorAction SilentlyContinue | Select-Object -First 20 | ForEach-Object { Line "$($_.Name)  $($_.Length)B  $($_.LastWriteTime)" }
    foreach ($special in @('batch.json','scores.json','review','examples')) {
        Probe-Path "output/$special" (Join-Path $outRoot $special)
    }
}

# ---------------------------------------------------------------- 27/28 NAMED RUNS
# Shared helper for sections 27 and 28. Searches the repo for a business name
# and prints file + a short snippet. Extension-filtered with Where-Object
# rather than -Include, which behaves inconsistently with -LiteralPath.
function Find-BusinessName {
    param([string]$Label, [string]$Regex, [string]$DirGlob)

    $exts = @('.json','.md','.ts','.html','.ndjson','.css','.txt')

    # Enumerate top level first and skip node_modules / .git / dist entirely,
    # so the scan never walks the ~30k files Playwright installs.
    $roots = @($RepoRoot)
    $roots += Get-ChildItem -LiteralPath $RepoRoot -Directory -Force -ErrorAction SilentlyContinue |
              Where-Object { $_.Name -notin @('node_modules','.git','dist') } |
              Select-Object -ExpandProperty FullName

    $files = @()
    foreach ($r in $roots) {
        $files += Get-ChildItem -LiteralPath $r -Recurse -File -Force -ErrorAction SilentlyContinue |
                  Where-Object {
                      $exts -contains $_.Extension -and
                      $_.FullName -notmatch '\\node_modules\\' -and
                      $_.FullName -notmatch '\\\.git\\'
                  }
    }
    $files = $files | Sort-Object FullName -Unique

    $hits = @()
    try {
        if ($files) {
            $hits = $files | Select-String -Pattern $Regex -List -ErrorAction SilentlyContinue | Select-Object -First 25
        }
    } catch { Note "search failed: $($_.Exception.Message)" }
    Note "scanned $(@($files).Count) text files (node_modules/.git/dist excluded)"

    if ($hits) {
        KV "$Label in repository" "FOUND - $(@($hits).Count) file(s)"
        foreach ($h in $hits) {
            $snip = ($h.Line -replace '\s+',' ').Trim()
            if ($snip.Length -gt 120) { $snip = $snip.Substring(0,120) + '...' }
            Line "$($h.Path)"
            Line "    line $($h.LineNumber): $snip"
        }
    } else {
        KV "$Label in repository" 'ABSENT - no file contains this name'
    }

    Note "bounded directory-name search under %USERPROFILE% (depth 3):"
    $dirs = Find-Dirs @($env:USERPROFILE) $DirGlob 3 10
    if ($dirs) { foreach ($d in $dirs) { Line $d.FullName } } else { Line 'no matching directory name' }
}

Section '27' 'GO SWEET RUN ARTIFACTS'
Find-BusinessName 'Go Sweet' 'go\s*[-_]?\s*sweet' '*sweet*'

Section '28' 'RIVER PARK RUN ARTIFACTS'
Find-BusinessName 'River Park' 'river\s*[-_]?\s*park' '*river*'

# ---------------------------------------------------------------- 29 N8N WORKFLOWS
Section '29' 'N8N WORKFLOWS / CONFIGURATION DETAIL'
if (-not $n8nFound) {
    KV 'n8n data directory' 'ABSENT - no workflows to inventory'
} else {
    Note 'workflow JSON files found (names + node types only; credentials are referenced by id, never printed):'
    Get-ChildItem -LiteralPath $n8nHome -Recurse -Depth 3 -Filter '*.json' -File -Force -ErrorAction SilentlyContinue |
        Select-Object -First 40 | ForEach-Object {
            Line "FILE: $($_.FullName.Replace($env:USERPROFILE,'~'))  $($_.Length)B  $($_.LastWriteTime)"
            try {
                $w = Get-Content -LiteralPath $_.FullName -Raw | ConvertFrom-Json
                if ($w.name)   { Line "  workflow name : $($w.name)" }
                if ($null -ne $w.active) { Line "  active        : $($w.active)" }
                if ($w.nodes) {
                    Line "  nodes         : $(@($w.nodes).Count)"
                    foreach ($n in ($w.nodes | Select-Object -First 30)) {
                        $credNames = ''
                        if ($n.credentials) { $credNames = " credentials:[$(@($n.credentials.PSObject.Properties.Name) -join ',')] (REDACTED)" }
                        Line "    - $($n.name)  type=$($n.type)$credNames"
                    }
                }
            } catch { Line '  (not a parseable workflow JSON)' }
        }
    Note 'n8n config file keys (values protected):'
    $n8nCfg = Join-Path $n8nHome 'config'
    if (Test-Path -LiteralPath $n8nCfg) {
        try { Show-JsonSafe (Get-Content -LiteralPath $n8nCfg -Raw | ConvertFrom-Json) } catch { Line 'unparseable' }
    } else { Line 'ABSENT' }
    Note 'database.sqlite present means workflows live in SQLite, not JSON files:'
    Probe-Path 'database.sqlite' (Join-Path $n8nHome 'database.sqlite')
    Note 'If workflows are in SQLite, they cannot be read without a sqlite client. Reported as UNKNOWN rather than guessed.'
}

# ---------------------------------------------------------------- 30 DOCKER DETAIL
Section '30' 'DOCKER CONTAINERS / IMAGES / VOLUMES / NETWORKS'
if (-not $DockerUp) {
    KV 'docker queries' 'SKIPPED - daemon not running (deliberately not started)'
    Note 'Compose files found in the repo and common project roots (file discovery only):'
    try {
        Get-ChildItem -LiteralPath $RepoRoot -Recurse -Depth 3 -Include 'docker-compose*.yml','docker-compose*.yaml','compose.yml','compose.yaml','Dockerfile*' -File -Force -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -notmatch '\\node_modules\\' } | Select-Object -First 20 | ForEach-Object { Line $_.FullName }
    } catch { }
} else {
    Note 'docker version:'
    try { (docker version --format '{{.Server.Version}} / client {{.Client.Version}}' 2>&1) | ForEach-Object { Line $_ } } catch { Line 'probe failed' }
    Note 'containers (docker ps -a):'
    try { (docker ps -a --format '{{.Names}} | {{.Image}} | {{.Status}} | {{.Ports}}' 2>&1) | Select-Object -First 40 | ForEach-Object { Line $_ } } catch { Line 'probe failed' }
    Note 'images:'
    try { (docker images --format '{{.Repository}}:{{.Tag}} | {{.Size}} | {{.CreatedSince}}' 2>&1) | Select-Object -First 40 | ForEach-Object { Line $_ } } catch { Line 'probe failed' }
    Note 'volumes:'
    try { (docker volume ls --format '{{.Name}} | {{.Driver}}' 2>&1) | Select-Object -First 40 | ForEach-Object { Line $_ } } catch { Line 'probe failed' }
    Note 'networks:'
    try { (docker network ls --format '{{.Name}} | {{.Driver}} | {{.Scope}}' 2>&1) | Select-Object -First 20 | ForEach-Object { Line $_ } } catch { Line 'probe failed' }
    Note 'compose projects (labels only):'
    try { (docker ps -a --filter 'label=com.docker.compose.project' --format '{{.Names}} | {{.Label "com.docker.compose.project"}}' 2>&1) | Select-Object -First 30 | ForEach-Object { Line $_ } } catch { }
    Note 'NOTE: container environment variables are NOT inspected, because they commonly hold credentials.'
}

# ---------------------------------------------------------------- 31 AI CONFIG DIRS
Section '31' 'AI / APPLICATION CONFIGURATION DIRECTORIES'
$cfgDirs = @(
    "$env:USERPROFILE\.claude", "$env:APPDATA\Claude", "$env:USERPROFILE\.gemini",
    "$env:USERPROFILE\.codex", "$env:USERPROFILE\.openai", "$env:USERPROFILE\.cursor",
    "$env:APPDATA\Cursor\User", "$env:USERPROFILE\.windsurf", "$env:APPDATA\Code\User",
    "$env:USERPROFILE\.aider", "$env:USERPROFILE\.continue", "$env:USERPROFILE\.ollama",
    "$env:USERPROFILE\.n8n", "$env:USERPROFILE\.docker", "$env:USERPROFILE\.config",
    "$env:USERPROFILE\.npm", "$env:USERPROFILE\.cache", "$env:USERPROFILE\.ssh",
    "$env:USERPROFILE\.aws", "$env:USERPROFILE\.azure", "$env:APPDATA\npm"
)
foreach ($d in $cfgDirs) {
    if (Test-Path -LiteralPath $d) {
        $n = @(Get-ChildItem -LiteralPath $d -Force -ErrorAction SilentlyContinue).Count
        $lw = (Get-Item -LiteralPath $d).LastWriteTime
        KV ($d.Replace($env:USERPROFILE,'~')) "PRESENT  entries=$n  modified=$lw"
    } else { KV ($d.Replace($env:USERPROFILE,'~')) 'ABSENT' }
}
Note 'NOTE: .ssh / .aws / .azure are reported as PRESENT/ABSENT only. No file inside them is opened.'

# ---------------------------------------------------------------- 32 OTHER PROJECTS
Section '32' 'PROJECT DIRECTORIES OUTSIDE WEBSITEAGENT'
$projRoots = @(
    $env:USERPROFILE,
    (Join-Path $env:USERPROFILE 'Documents'),
    (Join-Path $env:USERPROFILE 'Desktop'),
    (Join-Path $env:USERPROFILE 'source'),
    (Join-Path $env:USERPROFILE 'source\repos'),
    (Join-Path $env:USERPROFILE 'repos'),
    (Join-Path $env:USERPROFILE 'projects'),
    (Join-Path $env:USERPROFILE 'dev'),
    (Join-Path $env:USERPROFILE 'code'),
    'C:\dev','C:\projects','C:\src','C:\repos'
)
Note 'git repositories found (bounded: depth 3, node_modules excluded):'
$repos = Find-Dirs $projRoots '.git' 3 60
if ($repos) {
    foreach ($g in $repos) {
        $proj = Split-Path $g.FullName -Parent
        $remote = ''
        try { $remote = (git -C $proj config --get remote.origin.url 2>&1) } catch { }
        $br = ''
        try { $br = (git -C $proj rev-parse --abbrev-ref HEAD 2>&1) } catch { }
        Line "$proj"
        Line "    remote=$remote  branch=$br  modified=$((Get-Item -LiteralPath $proj).LastWriteTime)"
    }
} else { Line 'none found in the searched roots' }
Note 'package.json projects found (depth 3, node_modules excluded) - name + description only:'
foreach ($r in $projRoots) {
    if (-not (Test-Path -LiteralPath $r)) { continue }
    Get-ChildItem -LiteralPath $r -Recurse -Depth 3 -Filter 'package.json' -File -Force -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notmatch '\\node_modules\\' } |
        Select-Object -First 30 | ForEach-Object {
            try {
                $pj = Get-Content -LiteralPath $_.FullName -Raw | ConvertFrom-Json
                Line "$($_.DirectoryName)   name=$($pj.name)  ver=$($pj.version)"
            } catch { Line "$($_.DirectoryName)   (unparseable package.json)" }
        }
}

# ===========================================================================
Write-Output ''
Write-Output '############################################################################'
Write-Output "# END OF REPORT"
Write-Output "# sections emitted : $script:SectionCount  (expected 32)"
Write-Output "# completed        : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Output '# Nothing was installed, started, stopped, modified or deleted.'
Write-Output '# No credential value appears above. Paste this entire file back.'
Write-Output '############################################################################'
