const BLOCKED_TERMS = [
  'child porn',
  'cp',
  'bestiality',
  'rape',
  'gore',
  'beheading',
  'execution',
  'terrorism',
  'bomb tutorial',
  'how to make a bomb',
  'meth recipe',
  'cocaine for sale',
  'kill yourself',
  'nazi propaganda',
  'extremist manifesto',
];

const WORD_PATTERN = new RegExp(
  `\\b(${BLOCKED_TERMS.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
  'i',
);

export function moderateUploadText(input: {
  title: string;
  description: string;
  tags: string[];
}) {
  const merged = `${input.title}\n${input.description}\n${input.tags.join(' ')}`.toLowerCase();
  const matched = merged.match(WORD_PATTERN);

  if (!matched) {
    return { flagged: false as const };
  }

  return {
    flagged: true as const,
    reason: `Contains blocked term: "${matched[0]}"`,
  };
}
