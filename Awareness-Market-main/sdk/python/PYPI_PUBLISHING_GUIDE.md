# PyPI Publishing Guide for Awareness Network SDK

## Prerequisites

1. **PyPI Account**: Create account at https://pypi.org/account/register/
2. **API Token**: Generate at https://pypi.org/manage/account/token/
3. **Python Environment**: Python 3.8+ with pip

## Step 1: Install Build Tools

```bash
cd sdk/python
python -m pip install --upgrade build twine
```

## Step 2: Build the Package

```bash
# Clean previous builds
rm -rf dist/ build/ *.egg-info

# Build source distribution and wheel
python -m build
```

This creates:
- `dist/awareness-network-sdk-1.0.0.tar.gz` (source distribution)
- `dist/awareness_network_sdk-1.0.0-py3-none-any.whl` (wheel)

## Step 3: Test on TestPyPI (Optional but Recommended)

```bash
# Upload to TestPyPI
python -m twine upload --repository testpypi dist/*

# Test installation
pip install --index-url https://test.pypi.org/simple/ awareness-network-sdk
```

## Step 4: Upload to PyPI

```bash
# Upload to production PyPI
python -m twine upload dist/*
```

When prompted:
- Username: `__token__`
- Password: Your PyPI API token (starts with `pypi-`)

## Step 5: Verify Installation

```bash
# Install from PyPI
pip install awareness-network-sdk

# Test import
python -c "from awareness_network_sdk import AwarenessNetworkClient; print('✓ SDK installed successfully')"
```

## Automated Publishing Script

Save as `publish.sh`:

```bash
#!/bin/bash
set -e

echo "🔨 Building package..."
rm -rf dist/ build/ *.egg-info
python -m build

echo "📦 Package built successfully!"
ls -lh dist/

echo "🔍 Checking package..."
python -m twine check dist/*

read -p "Upload to PyPI? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]
then
    echo "📤 Uploading to PyPI..."
    python -m twine upload dist/*
    echo "✅ Published successfully!"
    echo "Install with: pip install awareness-network-sdk"
fi
```

Make executable: `chmod +x publish.sh`

## Version Management

Update version in three places:
1. `setup.py` - `version="1.0.1"`
2. `pyproject.toml` - `version = "1.0.1"`
3. `awareness_network_sdk/__init__.py` - `__version__ = "1.0.1"`

## Troubleshooting

### Error: "File already exists"
- You cannot re-upload the same version
- Increment version number and rebuild

### Error: "Invalid distribution"
- Run `twine check dist/*` to validate
- Ensure README.md exists and is valid Markdown

### Error: "Authentication failed"
- Verify API token is correct
- Use `__token__` as username, not your PyPI username

## Post-Publication Checklist

- [ ] Verify package page: https://pypi.org/project/awareness-network-sdk/
- [ ] Test installation: `pip install awareness-network-sdk`
- [ ] Update GitHub release with PyPI badge
- [ ] Announce on social media/forums
- [ ] Monitor download stats: https://pypistats.org/packages/awareness-network-sdk

## Continuous Deployment (Optional)

Use GitHub Actions for automated publishing:

```yaml
# .github/workflows/publish.yml
name: Publish to PyPI

on:
  release:
    types: [published]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-python@v4
      with:
        python-version: '3.11'
    - name: Install dependencies
      run: python -m pip install build twine
    - name: Build package
      run: python -m build
    - name: Publish to PyPI
      env:
        TWINE_USERNAME: __token__
        TWINE_PASSWORD: ${{ secrets.PYPI_API_TOKEN }}
      run: python -m twine upload dist/*
```

Add `PYPI_API_TOKEN` to GitHub repository secrets.

## Support

- PyPI Help: https://pypi.org/help/
- Packaging Guide: https://packaging.python.org/
- Twine Docs: https://twine.readthedocs.io/

---

**Ready to publish!** Run `./publish.sh` when ready.
