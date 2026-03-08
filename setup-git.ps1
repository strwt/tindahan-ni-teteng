# Prince-Project Git Setup Script
Set-Location "C:\Users\DELL\Downloads\my-tailwind-vite-app"

# Add header to README
"# Prince-Project" | Out-File -FilePath "README.md" -Encoding utf8 -Append

# Initialize git if not already initialized
if (-not (Test-Path ".git")) {
    git init
}

git add README.md
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/strwt/TindahanNiTeteng.git
git push -u origin main
