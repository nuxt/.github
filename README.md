# Nuxt Shared GitHub Configuration

This repository contains shared GitHub Actions workflows and scripts used across the Nuxt organization.

## Reusable Workflows

### Issue Triage Workflows

AI-powered issue triage using GitHub Models. These workflows automatically:

- Categorize issues (bug, enhancement, documentation, spam)
- Add appropriate labels
- Translate non-English issues
- Check for reproduction information
- Reopen issues when new evidence is provided

#### Available Workflows

| Workflow | Trigger | Description |
|----------|---------|-------------|
| `triage-opened.yml` | `issues: [opened]` | Triage newly opened issues |
| `triage-comment.yml` | `issue_comment: [created]` | Analyze comments for reproductions |
| `triage-edited.yml` | `issues: [edited]` | Check edited issues for reproductions |
| `triage-spam-transfer.yml` | `issues: [labeled]` | Transfer spam-labeled issues |

## Usage

### Basic Setup

Create workflow files in your repository's `.github/workflows/` directory:

#### `triage-issue-opened.yml`

```yaml
name: triage

on:
  issues:
    types: [opened]

concurrency:
  group: issue-triage-${{ github.event.issue.number }}
  cancel-in-progress: true

jobs:
  triage:
    uses: nuxt/.github/.github/workflows/triage-opened.yml@main
    with:
      enable-translation: true
      enable-body-translation: true
      spam-repo-id: ${{ vars.TRIAGE_SPAM_REPO_ID }}
      project-name: 'Your Project Name'
    permissions:
      contents: read
      issues: write
      models: read
```

#### `triage-issue-comment.yml`

```yaml
name: triage

on:
  issue_comment:
    types: [created]

concurrency:
  group: llm-triage-comment-${{ github.event.issue.number }}
  cancel-in-progress: false

jobs:
  triage:
    uses: nuxt/.github/.github/workflows/triage-comment.yml@main
    permissions:
      contents: read
      issues: write
      models: read
```

#### `triage-issue-edited.yml`

```yaml
name: triage

on:
  issues:
    types: [edited]

concurrency:
  group: llm-triage-edit-${{ github.event.issue.number }}
  cancel-in-progress: false

jobs:
  triage:
    uses: nuxt/.github/.github/workflows/triage-edited.yml@main
    permissions:
      contents: read
      issues: write
      models: read
```

#### `triage-spam-transfer.yml`

```yaml
name: triage

on:
  issues:
    types: [labeled]

jobs:
  transfer-spam:
    if: |
      github.event.label.name == 'spam' &&
      vars.TRIAGE_SPAM_REPO_ID != ''
    uses: nuxt/.github/.github/workflows/triage-spam-transfer.yml@main
    with:
      spam-repo-id: ${{ vars.TRIAGE_SPAM_REPO_ID }}
    permissions:
      contents: read
      issues: write
```

## Configuration

### Repository Variables

Set these in your repository's Settings > Secrets and variables > Actions > Variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TRIAGE_SPAM_REPO_ID` | No | - | Node ID of spam repository for issue transfers |

### Workflow Inputs

#### `triage-opened.yml`

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `enable-translation` | boolean | `true` | Translate non-English issue titles |
| `enable-body-translation` | boolean | `true` | Also translate issue body |
| `spam-repo-id` | string | `''` | Node ID for spam transfer target |
| `scripts-ref` | string | `'main'` | Git ref for scripts |
| `add-pending-label` | boolean | `true` | Add 'pending triage' to new issues |
| `project-name` | string | `'Nuxt.js framework'` | Project name for AI context |

#### `triage-comment.yml` / `triage-edited.yml`

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `scripts-ref` | string | `'main'` | Git ref for scripts |

#### `triage-spam-transfer.yml`

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| `spam-repo-id` | string | Yes | Node ID of spam repository |

## Required Permissions

All triage workflows require:

```yaml
permissions:
  contents: read  # To checkout shared scripts
  issues: write   # To add labels, update issues
  models: read    # To use GitHub Models AI
```

## Labels

The workflows use these labels (create them in your repository):

| Label | Description |
|-------|-------------|
| `pending triage` | Issue awaiting review |
| `needs reproduction` | Bug report missing reproduction |
| `possible regression` | May be a regression from upgrade |
| `nitro` | Related to deployment/Nitro |
| `spam` | Spam content |
| `duplicate` | Duplicate issue |

## How It Works

### Issue Opened (`triage-opened.yml`)

1. Adds `pending triage` label to new issues without labels
2. Uses AI to categorize the issue
3. For bugs without reproduction, adds `needs reproduction` label
4. For possible regressions, adds `possible regression` label
5. Translates non-English issues (optional)
6. Transfers spam to dedicated repository (optional)

### Comment Analysis (`triage-comment.yml`)

1. Checks if comment provides reproduction for `needs reproduction` issues
2. For closed issues, analyzes if new evidence warrants reopening
3. Removes `needs reproduction` when valid reproduction is provided
4. Reopens issues when regression or new evidence is found

### Issue Edited (`triage-edited.yml`)

1. Only runs on issues with `needs reproduction` label
2. Checks if edited content now includes reproduction
3. Removes label and reopens issue if applicable

### Spam Transfer (`triage-spam-transfer.yml`)

1. Triggers when `spam` label is added
2. Transfers issue to dedicated spam repository
3. Keeps main repository clean

## Getting the Spam Repository Node ID

To find a repository's Node ID for spam transfers:

```bash
gh api graphql -f query='
  query {
    repository(owner: "nuxt", name: "spam") {
      id
    }
  }
'
```

## Version Pinning

For production use, pin to a specific commit or tag:

```yaml
uses: nuxt/.github/.github/workflows/triage-opened.yml@v1.0.0
# or
uses: nuxt/.github/.github/workflows/triage-opened.yml@abc1234
```
