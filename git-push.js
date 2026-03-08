const { execSync } = require('child_process');
const path = require('path');

const repoPath = 'C:\\Users\\DELL\\Downloads\\my-tailwind-vite-app';

try {
  process.chdir(repoPath);
  
  // Add header to README
  const fs = require('fs');
  const readmePath = path.join(repoPath, 'README.md');
  let content = fs.readFileSync(readmePath, 'utf8');
  if (!content.startsWith('# Prince-Project')) {
    content = '# Prince-Project\n' + content;
    fs.writeFileSync(readmePath, content);
  }
  
  // Initialize git
  execSync('git init', { stdio: 'inherit' });
  execSync('git add README.md', { stdio: 'inherit' });
  execSync('git commit -m "first commit"', { stdio: 'inherit' });
  execSync('git branch -M main', { stdio: 'inherit' });
  execSync('git remote add origin https://github.com/montanoprincelaurence-crypto/TindahanNiTeteng.git', { stdio: 'inherit' });
  execSync('git push -u origin main', { stdio: 'inherit' });
  
  console.log('Successfully pushed to GitHub!');
} catch (error) {
  console.error('Error:', error.message);
}
