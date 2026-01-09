<#
.SYNOPSIS
    Docker development helper script for Portal Essencia Feliz

.DESCRIPTION
    Provides convenient commands for managing the Docker development environment.

.PARAMETER Command
    The command to execute: up, down, logs, shell, rebuild, install, migrate, studio, clean, status

.PARAMETER Service
    Optional service name for logs command (default: dev)

.EXAMPLE
    .\docker-dev.ps1 up
    Starts the development environment

.EXAMPLE
    .\docker-dev.ps1 logs api
    Shows logs for the api service

.EXAMPLE
    .\docker-dev.ps1 shell
    Opens a shell in the dev container
#>

param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet("up", "down", "logs", "shell", "rebuild", "install", "migrate", "studio", "clean", "status")]
    [string]$Command,

    [Parameter(Position = 1)]
    [string]$Service = "dev"
)

$ComposeFile = "docker-compose.dev.yml"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

# Change to project root
Push-Location $ProjectRoot

try {
    switch ($Command) {
        "up" {
            Write-Host "Starting development environment..." -ForegroundColor Cyan
            docker compose -f $ComposeFile up -d
            Write-Host ""
            Write-Host "Development environment started!" -ForegroundColor Green
            Write-Host ""
            Write-Host "Services available at:" -ForegroundColor Yellow
            Write-Host "  Home:         http://localhost:3006"
            Write-Host "  Login:        http://localhost:3003"
            Write-Host "  Usuarios:     http://localhost:3004"
            Write-Host "  Escolas:      http://localhost:3005"
            Write-Host "  Planejamento: http://localhost:3007"
            Write-Host "  API:          http://localhost:3001"
            Write-Host ""
            Write-Host "View logs: .\scripts\docker-dev.ps1 logs" -ForegroundColor Gray
        }

        "down" {
            Write-Host "Stopping development environment..." -ForegroundColor Cyan
            docker compose -f $ComposeFile down
            Write-Host "Development environment stopped." -ForegroundColor Green
        }

        "logs" {
            Write-Host "Showing logs for $Service..." -ForegroundColor Cyan
            docker compose -f $ComposeFile logs -f $Service
        }

        "shell" {
            Write-Host "Opening shell in dev container..." -ForegroundColor Cyan
            docker compose -f $ComposeFile exec dev sh
        }

        "rebuild" {
            Write-Host "Rebuilding development container..." -ForegroundColor Cyan
            docker compose -f $ComposeFile build --no-cache dev
            docker compose -f $ComposeFile up -d
            Write-Host "Container rebuilt and started." -ForegroundColor Green
        }

        "install" {
            Write-Host "Installing dependencies in container..." -ForegroundColor Cyan
            docker compose -f $ComposeFile exec dev pnpm install
            Write-Host "Dependencies installed." -ForegroundColor Green
        }

        "migrate" {
            Write-Host "Running database migrations..." -ForegroundColor Cyan
            docker compose -f $ComposeFile exec dev pnpm db:migrate
            Write-Host "Migrations completed." -ForegroundColor Green
        }

        "studio" {
            Write-Host "Starting Drizzle Studio..." -ForegroundColor Cyan
            Write-Host "Access at: https://local.drizzle.studio" -ForegroundColor Yellow
            docker compose -f $ComposeFile exec dev pnpm db:studio
        }

        "clean" {
            Write-Host "Cleaning containers and volumes..." -ForegroundColor Cyan
            docker compose -f $ComposeFile down -v
            docker system prune -f
            Write-Host "Cleanup completed." -ForegroundColor Green
        }

        "status" {
            Write-Host "Container status:" -ForegroundColor Cyan
            docker compose -f $ComposeFile ps
        }
    }
}
finally {
    Pop-Location
}
