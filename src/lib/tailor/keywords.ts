/**
 * Keyword & skill extraction.
 *
 * All analysis is performed on REAL job-description text and the user's REAL
 * profile. Nothing is invented: tailoring only re-weights and selects existing
 * content. The extractor uses stop-word filtering, a curated technical-skill
 * lexicon, and frequency-weighted uni/bi-gram scoring.
 */

const STOPWORDS = new Set([
  "the","and","for","are","but","not","you","all","any","can","had","her","was",
  "one","our","out","day","get","has","him","his","how","man","new","now","old",
  "see","two","way","who","boy","did","its","let","put","say","she","too","use",
  "with","that","this","have","from","they","will","would","there","their","what",
  "about","which","when","make","like","time","just","know","take","into","your",
  "some","could","them","than","then","look","only","come","over","also","back",
  "after","work","first","well","year","work","such","because","through","being",
  "while","should","these","those","other","every","under","within","across",
  "able","more","most","much","very","each","both","here","were","been","does",
  "doing","done","etc","per","via","upon","onto","off","yet","may","might","must",
  "shall","role","team","teams","company","companies","candidate","candidates",
  "looking","join","help","including","include","includes","strong","ability",
  "experience","experiences","experienced","years","plus","etc.","required",
  "preferred","responsibilities","requirements","qualifications","skills","skill",
  "job","position","opportunity","apply","applicant","we","us","our","you","your",
]);

/**
 * Curated multi-word technical terms that must be detected as single keywords.
 * Order matters only for readability; matching is case-insensitive.
 */
const SKILL_PHRASES = [
  "machine learning","deep learning","natural language processing","computer vision",
  "data science","data engineering","data analysis","big data","data pipeline",
  "software engineering","software development","full stack","front end","back end",
  "object oriented","unit testing","integration testing","test automation",
  "continuous integration","continuous deployment","ci/cd","version control",
  "rest api","graphql api","micro services","microservices","event driven",
  "distributed systems","cloud computing","infrastructure as code","site reliability",
  "agile","scrum","kanban","project management","product management","stakeholder",
  "react","next.js","node.js","express","typescript","javascript","python","java",
  "golang","rust","ruby","rails","django","flask","spring","kotlin","swift",
  "postgresql","mysql","mongodb","redis","elasticsearch","kafka","rabbitmq",
  "docker","kubernetes","terraform","ansible","jenkins","github actions","gitlab",
  "aws","azure","gcp","google cloud","lambda","s3","ec2","dynamodb","bigquery",
  "tensorflow","pytorch","scikit-learn","pandas","numpy","spark","hadoop","airflow",
  "html","css","tailwind","sass","webpack","vite","redux","graphql","grpc",
  "sql","nosql","etl","oauth","jwt","saml","ldap","rbac","sso",
  "linux","bash","powershell","git","jira","confluence","figma",
  "communication","leadership","collaboration","problem solving","analytical",
] as const;

export interface WeightedTerm {
  term: string;
  weight: number;
}

function normalizeToken(token: string): string {
  // Strip surrounding punctuation but preserve internal characters such as the
  // dot in "node.js" or the "+" in "c++". Trailing dots (e.g. "experience.")
  // are removed so they don't pollute the keyword set.
  return token.toLowerCase().replace(/^[^a-z0-9+#]+|[^a-z0-9+#]+$/g, "");
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/i)
    .map(normalizeToken)
    .filter((t) => t.length >= 2 && t.length <= 30);
}

/**
 * Extract weighted keywords from job-description text. Returns terms sorted by
 * descending weight. Multi-word skill phrases are credited higher because they
 * are more specific signals.
 */
export function extractKeywords(text: string, limit = 40): WeightedTerm[] {
  const lower = text.toLowerCase();
  const weights = new Map<string, number>();

  // 1. Curated multi-word phrases (high signal).
  for (const phrase of SKILL_PHRASES) {
    if (lower.includes(phrase)) {
      const occurrences = lower.split(phrase).length - 1;
      weights.set(phrase, (weights.get(phrase) ?? 0) + occurrences * 3);
    }
  }

  // 2. Single-token frequency, stop-word filtered.
  const tokens = tokenize(text);
  const freq = new Map<string, number>();
  for (const tok of tokens) {
    if (STOPWORDS.has(tok)) continue;
    if (/^\d+$/.test(tok)) continue;
    freq.set(tok, (freq.get(tok) ?? 0) + 1);
  }
  for (const [tok, count] of freq) {
    // Skip tokens already covered by a captured phrase.
    if ([...weights.keys()].some((p) => p.includes(tok) && p.includes(" "))) {
      continue;
    }
    weights.set(tok, (weights.get(tok) ?? 0) + count);
  }

  return [...weights.entries()]
    .map(([term, weight]) => ({ term, weight }))
    .sort((a, b) => b.weight - a.weight || a.term.localeCompare(b.term))
    .slice(0, limit);
}

/** Build a searchable keyword set from arbitrary profile text + skills. */
export function profileKeywordSet(parts: string[]): Set<string> {
  const set = new Set<string>();
  const blob = parts.join(" ").toLowerCase();
  for (const phrase of SKILL_PHRASES) {
    if (blob.includes(phrase)) set.add(phrase);
  }
  for (const tok of tokenize(blob)) {
    if (!STOPWORDS.has(tok) && !/^\d+$/.test(tok)) set.add(tok);
  }
  return set;
}

/** Count how many JD keyword terms appear in a single text fragment. */
export function relevanceOf(fragment: string, terms: WeightedTerm[]): number {
  const lower = ` ${fragment.toLowerCase()} `;
  let score = 0;
  for (const { term, weight } of terms) {
    if (term.includes(" ")) {
      if (lower.includes(term)) score += weight * 1.5;
    } else if (lower.includes(` ${term} `) || lower.includes(`${term}`)) {
      // word-boundary-ish match
      const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
      if (re.test(lower)) score += weight;
    }
  }
  return score;
}
