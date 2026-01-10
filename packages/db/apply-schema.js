const { spawn } = require('child_process');

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const child = spawn(command, ['drizzle-kit', 'push'], {
  stdio: ['pipe', 'inherit', 'inherit']
});

// Aguarda um pouco e envia "Yes"
setTimeout(() => {
  child.stdin.write('\n'); // Pressiona Enter para selecionar "Yes"
  child.stdin.end();
}, 2000);

child.on('exit', (code) => {
  console.log(`Processo finalizado com codigo: ${code}`);
  process.exit(code);
});
