# CI/CD Workflows

This directory contains GitHub Actions workflows for automated testing, building, and deployment.

## Workflows

### 1. Go Services CI/CD (`go-services-ci.yml`)

Automatically tests and builds Go microservices on every push to main or pull request.

**Triggers:**
- Push to `main` branch (paths: `go-services/**`)
- Pull requests to `main` branch

**Jobs:**
- **test-and-build**: Runs tests and builds binaries for both services
  - Memory Exchange Service
  - W-Matrix Marketplace Service
- **swagger-validation**: Validates Swagger documentation is up-to-date
- **lint**: Runs golangci-lint for code quality checks
- **security-scan**: Runs Gosec security scanner
- **deploy-notification**: Notifies when deployment is ready

**Artifacts:**
- `memory-exchange-binary`: Compiled Memory Exchange service
- `w-matrix-marketplace-binary`: Compiled W-Matrix Marketplace service
- Retention: 7 days

### 2. Python SDK CI/CD (`python-sdk-ci.yml`)

Automatically tests, builds, and publishes the Python SDK.

**Triggers:**
- Push to `main` branch (paths: `python-sdk/**`)
- Pull requests to `main` branch
- Publish to PyPI: Commit message must contain `[release]`

**Jobs:**
- **test**: Runs tests on Python 3.8-3.12
- **build**: Builds Python package
- **publish**: Publishes to PyPI (only on `[release]` commits)

**Artifacts:**
- `python-sdk-dist`: Built Python package (.whl and .tar.gz)
- Retention: 7 days

## Setup Instructions

### Required Secrets

Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

1. **PYPI_API_TOKEN**: PyPI API token for publishing Python SDK
   - Get from: https://pypi.org/manage/account/token/
   - Format: `pypi-...`

### Optional Secrets

For production deployment automation (future):

- **DEPLOY_SSH_KEY**: SSH private key for production server
- **DEPLOY_HOST**: Production server hostname
- **DEPLOY_USER**: SSH username for deployment

## Usage

### Automatic Triggers

Workflows run automatically when you push code:

```bash
# Triggers Go services CI
git add go-services/
git commit -m "feat: Add new API endpoint"
git push origin main

# Triggers Python SDK CI
git add python-sdk/
git commit -m "feat: Add new SDK method"
git push origin main

# Triggers Python SDK CI + PyPI publish
git add python-sdk/
git commit -m "[release] Bump version to 1.1.0"
git push origin main
```

### Manual Workflow Runs

You can manually trigger workflows from GitHub Actions tab:

1. Go to **Actions** tab
2. Select the workflow
3. Click **Run workflow**
4. Choose branch and click **Run workflow**

## Monitoring

### Workflow Status

Check workflow status:
- **Actions tab**: https://github.com/everest-an/Awareness-Market/actions
- **Branch protection**: Require status checks before merging

### Build Artifacts

Download build artifacts:
1. Go to **Actions** tab
2. Click on a workflow run
3. Scroll to **Artifacts** section
4. Download the artifact

### Deployment

After successful CI:

1. **Go Services**:
   ```bash
   # Download artifacts
   # Upload to production server
   scp memory-exchange user@server:/opt/awareness/
   scp w-matrix-marketplace user@server:/opt/awareness/
   
   # Restart services
   ssh user@server 'systemctl restart memory-exchange'
   ssh user@server 'systemctl restart w-matrix-marketplace'
   ```

2. **Python SDK**:
   - Automatically published to PyPI on `[release]` commits
   - Users can install with: `pip install awareness-sdk`

## Best Practices

1. **Commit Messages**:
   - Use conventional commits: `feat:`, `fix:`, `docs:`, `chore:`
   - Add `[release]` prefix to trigger PyPI publish

2. **Pull Requests**:
   - All PRs must pass CI checks before merging
   - Review test coverage reports

3. **Versioning**:
   - Update `setup.py` version before `[release]` commit
   - Follow semantic versioning (MAJOR.MINOR.PATCH)

4. **Testing**:
   - Add tests for new features
   - Maintain >80% code coverage

## Troubleshooting

### Workflow Fails

1. Check the workflow logs in Actions tab
2. Common issues:
   - **Go build fails**: Check `go.mod` and dependencies
   - **Python tests fail**: Check Python version compatibility
   - **Swagger validation fails**: Run `swag init` and commit changes
   - **Security scan fails**: Review and fix security issues

### Artifact Download Fails

- Artifacts expire after 7 days
- Re-run the workflow to generate new artifacts

### PyPI Publish Fails

- Check `PYPI_API_TOKEN` secret is set correctly
- Verify version number is incremented
- Ensure package name is available on PyPI

## Future Enhancements

- [ ] Add automated deployment to production server
- [ ] Add integration tests with live services
- [ ] Add performance benchmarks
- [ ] Add Docker image building and publishing
- [ ] Add Kubernetes deployment manifests
- [ ] Add staging environment deployment
