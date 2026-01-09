const { spawn } = require('child_process');

const child = spawn('npx', ['drizzle-kit', 'push'], {
  stdio: ['pipe', 'inherit', 'inherit'],
  shell: true
});

// Aguarda um pouco e envia "Yes"
setTimeout(() => {
  child.stdin.write('\n'); // Pressiona Enter para selecionar "Yes"
  child.stdin.end();
}, 2000);

child.on('exit', (code) => {
  console.log(`Processo finalizado com código: ${code}`);
  process.exit(code);
});
