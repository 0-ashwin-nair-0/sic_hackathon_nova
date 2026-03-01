# 📤 GitHub Upload Guide

Your Smart City project is now ready for GitHub! Here's what has been done and how to upload it.

## ✅ What Was Done

### 🧹 Cleaned Up
- ❌ Removed test files: `check_server.py`, `test_simple.py`, `test_endpoint.py`, `test_citizen_reports.py`, `list_routes.py`
- ❌ Removed dev documentation: `FIXES_SUMMARY.md`, `VERIFICATION_CHECKLIST.md`
- ❌ Removed standalone projects: `electricity/` and `water/` folders
- ❌ Removed virtual environments: `.venv/` and `.venv-1/` (can be recreated)
- ❌ Removed uploaded test data: `backend/uploads/*.csv`
- ❌ Cleaned all `__pycache__/` directories

### 🔒 Security Improvements
- ✅ Created `.gitignore` to exclude sensitive files
- ✅ Moved admin credentials to environment variables
- ✅ Added `python-dotenv` for environment variable management
- ✅ Created `.env.example` template (actual `.env` is git-ignored)
- ✅ Created `SECURITY.md` with security best practices

### 📄 Documentation Added
- ✅ `LICENSE` - MIT License
- ✅ `CONTRIBUTING.md` - Contribution guidelines
- ✅ `CODE_OF_CONDUCT.md` - Community guidelines
- ✅ `SECURITY.md` - Security policy
- ✅ Updated `README.md` with badges and GitHub-specific sections

### 🛠️ GitHub Templates
- ✅ `.github/ISSUE_TEMPLATE/bug_report.md`
- ✅ `.github/ISSUE_TEMPLATE/feature_request.md`
- ✅ `.github/pull_request_template.md`

### ⚙️ Configuration Files
- ✅ `.gitignore` - Files to exclude from Git
- ✅ `.gitattributes` - Line ending and file type handling
- ✅ Updated `requirements.txt` with all dependencies

## 🚀 How to Upload to GitHub

### Step 1: Create a GitHub Repository

1. Go to [GitHub](https://github.com)
2. Click the **+** icon → **New repository**
3. Fill in:
   - **Repository name**: `smart-city-optimization` (or your preferred name)
   - **Description**: "AI-Powered Smart City Resource Optimization System"
   - **Visibility**: Public or Private
   - ⚠️ **DO NOT** initialize with README, .gitignore, or license (we already have them)
4. Click **Create repository**

### Step 2: Configure Your Local Repository

Open PowerShell/Terminal in your project directory:

```powershell
# Initialize git (if not already done)
git init

# Configure your identity (if first time)
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# Check what files will be committed
git status
```

### Step 3: Stage and Commit Files

```powershell
# Add all files (respects .gitignore)
git add .

# Check what's being added
git status

# Commit with a message
git commit -m "Initial commit: AI-Powered Smart City Optimization System"
```

### Step 4: Push to GitHub

```powershell
# Add your GitHub repository as remote (replace with your URL)
git remote add origin https://github.com/YOUR_USERNAME/smart-city-optimization.git

# Verify remote was added
git remote -v

# Push to GitHub
git branch -M main
git push -u origin main
```

### Step 5: Set Up on a New Machine

When someone clones your repository:

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/smart-city-optimization.git
cd smart-city-optimization

# Create virtual environment
python -m venv .venv

# Activate virtual environment
# On Windows:
.venv\Scripts\activate
# On macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file from example
cp .env.example backend/.env

# Edit backend/.env with your API keys and credentials
# Then generate data and run
python backend/data/generate_data.py
python backend/app.py
```

## ⚠️ Important Reminders

### Before Pushing
1. ✅ Make sure `.env` file is NOT in your commit:
   ```powershell
   git status
   # Should NOT show backend/.env
   ```

2. ✅ Review files being committed:
   ```powershell
   git diff --cached
   ```

3. ✅ Change default admin password in your local `.env`:
   - Edit `backend/.env`
   - Change `ADMIN_PASSWORD=Admin@123` to a strong password

### After Pushing
1. ✅ Add repository description and topics on GitHub
2. ✅ Enable Issues and Discussions (in Settings)
3. ✅ Add a `docs/` folder with screenshots (optional)
4. ✅ Consider adding GitHub Actions for CI/CD (optional)
5. ✅ Add a website/demo link if you deploy it

## 🎨 Optional Enhancements

### Add Screenshots to README
1. Take screenshots of your dashboard
2. Upload to `docs/screenshots/` or use GitHub Releases
3. Update README.md with:
   ```markdown
   ## 📸 Screenshots
   
   ### Admin Dashboard
   ![Admin Dashboard](docs/screenshots/admin-dashboard.png)
   
   ### Digital Twin
   ![Digital Twin](docs/screenshots/digital-twin.png)
   
   ### Citizen Portal
   ![Citizen Portal](docs/screenshots/citizen-portal.png)
   ```

### Create a Release
1. Go to your repository → Releases → Create new release
2. Tag: `v1.0.0`
3. Title: `Initial Release - Smart City Optimization System v1.0`
4. Description: List major features
5. Attach compiled assets if needed

### Add Repository Topics
On GitHub, add relevant topics:
- `smart-city`
- `artificial-intelligence`
- `machine-learning`
- `flask`
- `python`
- `data-visualization`
- `sustainability`
- `iot`
- `urban-planning`

## 🔍 Verify Everything Works

After pushing, verify:
- [ ] Repository appears on GitHub
- [ ] README displays correctly
- [ ] License is detected
- [ ] .gitignore is working (no .env, __pycache__, .venv visible)
- [ ] Issue templates appear when creating new issue
- [ ] All documentation files are readable

## 🆘 Troubleshooting

### "Permission denied" when pushing
- Make sure you're logged in: `gh auth login` (if using GitHub CLI)
- Or use SSH keys: https://docs.github.com/en/authentication/connecting-to-github-with-ssh

### "Large files" error
- Check file sizes: `git ls-files -z | xargs -0 du -h | sort -rh | head -20`
- If ML models are large, consider Git LFS or exclude them

### "Nothing to commit"
- Check `.gitignore` isn't excluding too much
- Use `git status` and `git add -f <file>` to force-add if needed

## 📚 Additional Resources

- [GitHub Docs](https://docs.github.com)
- [Git Basics](https://git-scm.com/book/en/v2/Getting-Started-Git-Basics)
- [Writing Good Commits](https://chris.beams.io/posts/git-commit/)
- [GitHub Issues Guide](https://guides.github.com/features/issues/)

---

**Your project is now GitHub-ready! 🎉**

Questions? Check [CONTRIBUTING.md](CONTRIBUTING.md) or open an issue after uploading.
