type ModerationInput = {
  title?: string;
  description?: string;
  tags?: string[];
  content?: string;
};

type ModerationOptions = {
  surface: 'comment' | 'video';
};

type Rule = {
  label: string;
  reason: string;
  patterns: RegExp[];
  videoOnly?: boolean;
};

const LEET_MAP: Record<string, string> = {
  '@': 'a',
  '4': 'a',
  '3': 'e',
  '1': 'i',
  '!': 'i',
  '|': 'i',
  '0': 'o',
  '$': 's',
  '5': 's',
  '7': 't',
};

const RULES: Rule[] = [
  {
    label: 'child sexual abuse',
    reason: 'Contains child sexual abuse or exploitation language.',
    patterns: [
      /\b(?:child|kid|minor|underage|teen)\s*(?:porn|porno|sex|nude|nudes|explicit|sexual)\b/i,
      /\b(?:cp|csam)\b/i,
      /\b(?:loli|lolicon|shotacon)\b/i,
    ],
  },
  {
    label: 'sexual violence',
    reason: 'Contains sexual violence language.',
    patterns: [
      /\b(?:rape|raping|rapist|molest|molesting|molestation|sexual assault)\b/i,
    ],
  },
  {
    label: 'self-harm encouragement',
    reason: 'Encourages suicide or self-harm.',
    patterns: [
      /\b(?:kill|hurt|cut)\s+yourself\b/i,
      /\bkys\b/i,
      /\byou\s+should\s+(?:die|end yourself|kill yourself)\b/i,
      /\b(?:how to|ways to)\s+(?:commit suicide|kill myself|end my life)\b/i,
    ],
  },
  {
    label: 'credible threats',
    reason: 'Contains violent threats.',
    patterns: [
      /\bi(?:'| a)?m\s+going\s+to\s+(?:kill|shoot|stab|bomb)\s+(?:you|him|her|them|everyone)\b/i,
      /\bi\s+will\s+(?:kill|shoot|stab|bomb)\s+(?:you|him|her|them|everyone)\b/i,
      /\b(?:shoot up|bomb)\s+(?:a|the|my|your)?\s*(?:school|church|store|mall|airport|building)\b/i,
    ],
  },
  {
    label: 'hate or slurs',
    reason: 'Contains hateful slurs or dehumanizing harassment.',
    patterns: [
      /\b(?:nigger|nigga|faggot|tranny|kike|chink|spic|wetback|coon|raghead|gook)\b/i,
      /\b(?:gas|kill|exterminate)\s+(?:all\s+)?(?:jews|muslims|christians|black people|white people|gay people|trans people)\b/i,
    ],
  },
  {
    label: 'extremism',
    reason: 'Promotes terrorism or extremist violence.',
    patterns: [
      /\b(?:isis|islamic state|al qaeda|al-qaeda|kkk)\s+(?:was right|recruit|manifesto|propaganda)\b/i,
      /\bterrorist\s+(?:manifesto|propaganda|recruitment|attack guide)\b/i,
      /\bnazi\s+(?:propaganda|manifesto|recruitment)\b/i,
    ],
  },
  {
    label: 'weapons or explosive instructions',
    reason: 'Contains instructions for weapons, explosives, or dangerous harm.',
    patterns: [
      /\bhow\s+to\s+(?:make|build|create)\s+(?:a\s+)?(?:bomb|pipe bomb|gun|ghost gun|explosive|molotov)\b/i,
      /\b(?:bomb|meth|cocaine|fentanyl)\s+(?:tutorial|recipe|instructions|for sale)\b/i,
      /\b(?:buy|sell)\s+(?:fentanyl|meth|cocaine|heroin)\b/i,
    ],
  },
  {
    label: 'graphic violence',
    reason: 'Contains graphic violence language.',
    patterns: [
      /\b(?:beheading|decapitation|snuff film|gore video|real gore|execution video)\b/i,
    ],
    videoOnly: true,
  },
  {
    label: 'explicit sexual content',
    reason: 'Contains explicit sexual language.',
    patterns: [
      /\b(?:porn|porno|onlyfans leak|nudes leak|sex tape|hardcore sex)\b/i,
    ],
    videoOnly: true,
  },
];

const COMMENT_LANGUAGE_PATTERNS: RegExp[] = [
  /\b(?:fuck you|fucking idiot|dumb bitch|stupid bitch|cunt|whore|slut)\b/i,
  /\b(?:go die|nobody likes you|you are worthless)\b/i,
];

const STRONG_LANGUAGE_PATTERNS: RegExp[] = [
  /\b(?:fuck|fucking|shit|bullshit|bitch|asshole|cunt|whore|slut)\b/i,
];

function normalizeForModeration(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\S\r\n]+/g, ' ')
    .replace(/[^\w\s@!$|.-]/g, ' ')
    .replace(/[@431!|0$57]/g, (char) => LEET_MAP[char] || char)
    .replace(/(.)\1{2,}/g, '$1$1')
    .trim();
}

function getText(input: ModerationInput) {
  return [
    input.title || '',
    input.description || '',
    input.content || '',
    ...(input.tags || []),
  ]
    .join('\n')
    .slice(0, 12000);
}

function matchesAny(patterns: RegExp[], text: string) {
  return patterns.find((pattern) => pattern.test(text));
}

export function moderateText(input: ModerationInput, options: ModerationOptions) {
  const text = getText(input);
  const normalized = normalizeForModeration(text);

  for (const rule of RULES) {
    if (rule.videoOnly && options.surface !== 'video') continue;
    const matched = matchesAny(rule.patterns, normalized);
    if (matched) {
      return {
        flagged: true as const,
        reason: rule.reason,
        category: rule.label,
        matched: matched.source,
      };
    }
  }

  const strongLanguage = matchesAny(STRONG_LANGUAGE_PATTERNS, normalized);
  if (strongLanguage) {
    return {
      flagged: true as const,
      reason: 'Contains strong language. Please keep titles, descriptions, and comments clean.',
      category: 'strong language',
      matched: strongLanguage.source,
    };
  }

  if (options.surface === 'comment') {
    const matched = matchesAny(COMMENT_LANGUAGE_PATTERNS, normalized);
    if (matched) {
      return {
        flagged: true as const,
        reason: 'Contains abusive or inappropriate language.',
        category: 'abusive language',
        matched: matched.source,
      };
    }
  }

  return { flagged: false as const };
}

export function moderateUploadText(input: {
  title: string;
  description: string;
  tags: string[];
}) {
  return moderateText(input, { surface: 'video' });
}

export function moderateVideoMetadata(input: {
  title: string;
  description: string;
  tags?: string[];
}) {
  return moderateText(input, { surface: 'video' });
}

export function moderateCommentText(content: string) {
  return moderateText({ content }, { surface: 'comment' });
}
