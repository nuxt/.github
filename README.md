# Nuxt Shared GitHub Configuration

This repository contains shared GitHub Actions workflows used across the Nuxt organization.

> [!NOTE]
> AI-powered issue triage (categorisation, translation, reproduction analysis, spam transfer) is handled by Carpenter, the Nuxt GitHub App, and no longer lives in this repository.

## Reusable Workflows

| Workflow | Trigger | Description |
|----------|---------|-------------|
| `needs-reproduction.yml` | `issues: [labeled]` | Comment when the `needs reproduction` label is added |
| `possible-bot.yml` | `issues`/`pull_request: [labeled]` | Comment when the `possible bot` label is added |
| `dependency-review.yml` | `pull_request` | Dependency review with provenance checks |
| `reusable-release.yml` | `workflow_call` | npm staged release with OIDC trusted publishing |

## Usage

Example caller for the label-comment workflows:

```yaml
name: needs reproduction

on:
  issues:
    types: [labeled]

jobs:
  comment:
    if: github.event.label.name == 'needs reproduction'
    uses: nuxt/.github/.github/workflows/needs-reproduction.yml@main
    with:
      comment: 'Please provide a minimal reproduction.'
    permissions:
      issues: write
```

## Version Pinning

For production use, pin to a specific commit or tag:

```yaml
uses: nuxt/.github/.github/workflows/needs-reproduction.yml@v1.0.0
# or
uses: nuxt/.github/.github/workflows/needs-reproduction.yml@abc1234
```
