const fs = require('fs');
const path = require('path');
const dir = path.join(process.cwd(), 'frontend', 'src', 'routes');
const files = fs.readdirSync(dir).filter(f => f.startsWith('_app.') && f.endsWith('.tsx') && f !== '_app.tsx');

files.forEach(f => {
  const filePath = path.join(dir, f);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // 1. Replace the outer wrapper
  content = content.replace(/className="flex h-\[calc\(100vh-4rem\)\] overflow-hidden/g, 'className="flex min-h-full flex-col');
  
  // 2. Replace <main className="flex-1 overflow-y-auto..."> with <div className="flex-1...">
  content = content.replace(/<main className="flex-1 overflow-y-auto/g, '<div className="flex-1');
  content = content.replace(/<\/main>/g, '</div>');
  
  fs.writeFileSync(filePath, content);
  console.log('Updated ' + f);
});
