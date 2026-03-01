# Contributing to Smart City Resource Optimization System

Thank you for considering contributing to this project! We welcome contributions from the community.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)

## Code of Conduct

This project follows a code of conduct that we expect all contributors to adhere to:
- Be respectful and inclusive
- Focus on what is best for the community
- Show empathy towards other community members

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues. When you create a bug report, include:
- A clear and descriptive title
- Steps to reproduce the problem
- Expected vs actual behavior
- Screenshots if applicable
- Your environment (OS, Python version, browser)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, include:
- A clear and descriptive title
- Detailed description of the proposed functionality
- Why this enhancement would be useful
- Possible implementation approach

### Code Contributions

1. **Fork the repository** and create your branch from `main`
2. **Make your changes** following our coding standards
3. **Test your changes** thoroughly
4. **Update documentation** if needed
5. **Submit a pull request**

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/sic.git
cd sic

# Create a virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example backend/.env
# Edit backend/.env with your settings

# Generate sample data
python backend/data/generate_data.py

# Run the server
cd backend && python app.py
```

## Pull Request Process

1. **Update the README.md** with details of changes if applicable
2. **Update requirements.txt** if you add new dependencies
3. **Ensure all tests pass** (if tests exist)
4. **Follow the coding standards** outlined below
5. **Write clear commit messages**
6. **Reference related issues** in your PR description

### Commit Message Format

```
<type>: <subject>

<body>

<footer>
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks

Example:
```
feat: Add water leak prediction algorithm

Implemented a new Random Forest-based leak detection
system that improves accuracy by 15%.

Closes #123
```

## Coding Standards

### Python (Backend)

- Follow **PEP 8** style guide
- Use meaningful variable and function names
- Add docstrings to all functions and classes
- Keep functions focused and single-purpose
- Maximum line length: 100 characters

```python
def calculate_water_demand(zone_data: dict, time_period: str) -> float:
    """
    Calculate predicted water demand for a given zone.
    
    Args:
        zone_data: Dictionary containing zone information
        time_period: Time period for prediction ('daily', 'weekly', 'monthly')
        
    Returns:
        Predicted demand in liters
    """
    # Implementation
    pass
```

### JavaScript (Frontend)

- Use **ES6+** syntax
- Use `const` and `let` instead of `var`
- Use camelCase for variable names
- Add comments for complex logic
- Keep code modular and reusable

```javascript
/**
 * Fetch and display water data for all zones
 * @async
 * @returns {Promise<void>}
 */
async function loadWaterData() {
    try {
        const response = await fetch(`${API_BASE}/water/status`);
        const data = await response.json();
        displayWaterStatus(data);
    } catch (error) {
        console.error('Error loading water data:', error);
    }
}
```

### CSS

- Use meaningful class names
- Follow BEM naming convention when appropriate
- Keep specificity low
- Use CSS variables for theme colors
- Mobile-first approach for responsive design

## Areas We're Looking For Help

- 🧪 **Testing**: Unit tests, integration tests
- 📱 **Mobile Responsiveness**: Improve mobile experience
- ♿ **Accessibility**: WCAG 2.1 compliance
- 🌍 **Internationalization**: Multi-language support
- 📊 **Visualizations**: New chart types and interactive elements
- 🤖 **AI/ML**: Advanced algorithms and models
- 📝 **Documentation**: Tutorials, guides, API docs
- 🐳 **DevOps**: Docker, CI/CD pipelines

## Questions?

Feel free to open an issue with your question or reach out to the maintainers.

---

**Thank you for contributing to making cities smarter! 🏙️**
