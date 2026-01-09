# Script para aplicar o schema no banco de dados
# Simula entrada do usuário para aceitar as mudanças

$process = Start-Process -FilePath "npx" -ArgumentList "drizzle-kit","push" -NoNewWindow -PassThru -RedirectStandardInput "input.txt"
"Yes, I want to execute all statements" | Out-File -FilePath "input.txt" -Encoding ASCII
$process.WaitForExit()
Remove-Item "input.txt" -ErrorAction SilentlyContinue
