import process from 'node:process'

export interface ContentNormalizationConfig {
  /** Section title for feature requests (default: '### Describe the feature') */
  featureRequestTitle: string
  /** Section title for bug reproductions (default: '### Reproduction') */
  bugReportReproductionTitle: string
  /** Section title for logs to exclude (default: '### Logs') */
  bugReportLogsTitle: string
  /** Maximum content length to process (default: 5000) */
  maxContentLength: number
  /** Regex patterns to remove from content (e.g., starter template links) */
  removePatterns: RegExp[]
}

/** Default configuration - works with standard GitHub issue templates */
export const defaultContentConfig: ContentNormalizationConfig = {
  featureRequestTitle: '### Describe the feature',
  bugReportReproductionTitle: '### Reproduction',
  bugReportLogsTitle: '### Logs',
  maxContentLength: 5000,
  removePatterns: [
    // Nuxt starter template links - can be extended per-repo
    /https:\/\/stackblitz\.com\/github\/nuxt\/\S*/g,
  ],
}

/**
 * Get content normalization config from environment or use defaults
 */
export function getContentConfig(): ContentNormalizationConfig {
  return {
    featureRequestTitle: process.env.TRIAGE_FEATURE_TITLE || defaultContentConfig.featureRequestTitle,
    bugReportReproductionTitle: process.env.TRIAGE_REPRODUCTION_TITLE || defaultContentConfig.bugReportReproductionTitle,
    bugReportLogsTitle: process.env.TRIAGE_LOGS_TITLE || defaultContentConfig.bugReportLogsTitle,
    maxContentLength: process.env.TRIAGE_MAX_CONTENT_LENGTH
      ? Number.parseInt(process.env.TRIAGE_MAX_CONTENT_LENGTH, 10)
      : defaultContentConfig.maxContentLength,
    removePatterns: defaultContentConfig.removePatterns,
  }
}

/**
 * Normalize issue content by removing comments, starter links, diacritics, and trimming
 */
export function normalizeContent(text: string, config: ContentNormalizationConfig = getContentConfig()): string {
  let normalized = text
    // Remove HTML comments
    .replace(/<!--.*?-->/gs, ' ')
    // Normalize Unicode diacritics
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')
    .trim()

  // Apply configurable removal patterns
  for (const pattern of config.removePatterns) {
    normalized = normalized.replace(pattern, '')
  }

  // Trim feature requests to relevant section
  const featureRequestStart = normalized.indexOf(config.featureRequestTitle)
  if (featureRequestStart !== -1) {
    return normalized.slice(featureRequestStart, featureRequestStart + config.maxContentLength).trim()
  }

  // Trim bug reports to reproduction section (excluding logs)
  const bugReportStart = normalized.indexOf(config.bugReportReproductionTitle)
  if (bugReportStart !== -1) {
    const logsStart = normalized.indexOf(config.bugReportLogsTitle)
    if (logsStart !== -1 && logsStart > bugReportStart) {
      return normalized.slice(bugReportStart, Math.min(logsStart, bugReportStart + config.maxContentLength)).trim()
    }
    return normalized.slice(bugReportStart, bugReportStart + config.maxContentLength).trim()
  }

  return normalized.slice(0, config.maxContentLength).trim()
}

/**
 * Normalize language code to ISO 639-1 format
 */
export function normalizeLanguage(lang: string | null | undefined): string {
  if (!lang) { return 'en' }
  const language = lang.toLowerCase().split('-')[0]
  return /^[a-z]{2}$/.test(language) ? language : 'en'
}

export function isCollaboratorOrHigher(authorAssociation: string): boolean {
  return ['OWNER', 'MEMBER', 'COLLABORATOR'].includes(authorAssociation)
}

export function toXML(obj: Record<string, unknown>, rootElement: string = 'schema'): string {
  let xml = `<${rootElement}>`
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object' && value !== null) {
      xml += toXML(value as Record<string, unknown>, key)
    } else {
      xml += `<${key}>${value}</${key}>`
    }
  }
  xml += `</${rootElement}>`
  return xml
}

// AI Response Schemas for prompts
export const schemas = {
  newIssue: {
    title: 'Issue Categorisation',
    type: 'object',
    properties: {
      issueType: {
        type: 'string',
        enum: ['bug', 'enhancement', 'documentation', 'spam'],
        description: 'The type of issue. Use "enhancement" for feature requests.',
      },
      reproductionProvided: {
        type: 'boolean',
        description: 'Whether a reproduction is provided (GitHub repo, StackBlitz, CodeSandbox, or full code example).',
      },
      spokenLanguage: {
        type: 'string',
        description: 'The language of the title in ISO 639-1 format (2-letter code only, no country codes).',
      },
      possibleRegression: {
        type: 'boolean',
        description: 'True if the issue appeared after upgrading to a new version.',
      },
      nitro: {
        type: 'boolean',
        description: 'True if the issue is specific to a single deployment provider (Vercel, Netlify, Cloudflare, etc.).',
      },
    },
  },

  commentAnalysis: {
    title: 'Comment Analysis',
    type: 'object',
    properties: {
      reproductionProvided: {
        type: 'boolean',
        description: 'Whether this comment provides a reproduction (GitHub repo, StackBlitz, CodeSandbox, or full code example).',
      },
      possibleRegression: {
        type: 'boolean',
        description: 'True if this comment indicates the bug reappeared after an upgrade.',
      },
    },
  },

  enhancedAnalysis: {
    title: 'Enhanced Issue Analysis',
    type: 'object',
    properties: {
      reproductionProvided: {
        type: 'boolean',
        description: 'Whether a reproduction is provided in the issue or recent comments.',
      },
      possibleRegression: {
        type: 'boolean',
        description: 'True if evidence suggests a bug reappeared after an upgrade.',
      },
      shouldReopen: {
        type: 'boolean',
        description: 'Whether the closed issue should be reopened based on new evidence.',
      },
      isDifferentFromDuplicate: {
        type: 'boolean',
        description: 'For issues marked as duplicate, whether evidence suggests this is actually a different issue.',
      },
      confidence: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
        description: 'Confidence level in the analysis based on available context.',
      },
    },
  },

  translation: {
    title: 'Translation',
    type: 'object',
    properties: {
      translatedTitle: {
        type: 'string',
        description: 'The translated title in English.',
      },
      translatedBody: {
        type: 'string',
        description: 'The translated body in English. Keep markdown formatting intact.',
      },
    },
  },
} as const

/** Label configuration type */
export interface LabelsConfig {
  NEEDS_REPRODUCTION: string
  POSSIBLE_REGRESSION: string
  PENDING_TRIAGE: string
  NITRO: string
  SPAM: string
  DUPLICATE: string
}

export const labels: LabelsConfig = {
  NEEDS_REPRODUCTION: 'needs reproduction',
  POSSIBLE_REGRESSION: 'possible regression',
  PENDING_TRIAGE: 'pending triage',
  NITRO: 'nitro',
  SPAM: 'spam',
  DUPLICATE: 'duplicate',
}

/**
 * Get labels configuration from environment or use defaults
 * Environment variables: TRIAGE_LABEL_NEEDS_REPRODUCTION, TRIAGE_LABEL_PENDING_TRIAGE, etc.
 */
export function getLabels(): LabelsConfig {
  return {
    NEEDS_REPRODUCTION: process.env.TRIAGE_LABEL_NEEDS_REPRODUCTION || labels.NEEDS_REPRODUCTION,
    POSSIBLE_REGRESSION: process.env.TRIAGE_LABEL_POSSIBLE_REGRESSION || labels.POSSIBLE_REGRESSION,
    PENDING_TRIAGE: process.env.TRIAGE_LABEL_PENDING_TRIAGE || labels.PENDING_TRIAGE,
    NITRO: process.env.TRIAGE_LABEL_NITRO || labels.NITRO,
    SPAM: process.env.TRIAGE_LABEL_SPAM || labels.SPAM,
    DUPLICATE: process.env.TRIAGE_LABEL_DUPLICATE || labels.DUPLICATE,
  }
}

// Issue types (GitHub issue type feature)
export const issueTypes = {
  BUG: 'bug',
  ENHANCEMENT: 'enhancement',
  DOCUMENTATION: 'documentation',
} as const
