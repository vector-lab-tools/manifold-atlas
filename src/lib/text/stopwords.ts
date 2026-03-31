/**
 * Manifold Atlas — Text Tokenisation
 * Stop word list and text tokeniser for Text Vectorisation.
 */

export const STOP_WORDS = new Set([
  // Articles & determiners
  "a", "an", "the", "this", "that", "these", "those",
  // Pronouns
  "i", "me", "my", "mine", "myself",
  "you", "your", "yours", "yourself",
  "he", "him", "his", "himself",
  "she", "her", "hers", "herself",
  "it", "its", "itself",
  "we", "us", "our", "ours", "ourselves",
  "they", "them", "their", "theirs", "themselves",
  "who", "whom", "whose", "which", "what",
  // Prepositions
  "in", "on", "at", "to", "for", "of", "with", "by",
  "from", "up", "about", "into", "through", "during",
  "before", "after", "above", "below", "between",
  "out", "off", "over", "under", "again", "further",
  "then", "once", "upon", "within", "without", "against",
  "along", "among", "around", "behind", "beyond", "towards",
  // Conjunctions
  "and", "but", "or", "nor", "so", "yet", "both", "either",
  "neither", "not", "only", "than", "whether", "while",
  // Be verbs
  "am", "is", "are", "was", "were", "be", "been", "being",
  // Have verbs
  "have", "has", "had", "having",
  // Do verbs
  "do", "does", "did", "doing",
  // Modal verbs
  "will", "would", "shall", "should", "may", "might",
  "can", "could", "must",
  // Common verbs
  "get", "got", "gets", "getting",
  // Adverbs & misc
  "here", "there", "when", "where", "why", "how",
  "all", "each", "every", "any", "few", "more", "most",
  "other", "some", "such", "no", "own", "same", "too",
  "very", "just", "also", "now", "even", "still",
  "already", "always", "never", "often", "sometimes",
  "well", "back", "much", "many", "quite", "rather",
  "really", "almost", "enough", "however", "therefore",
  "thus", "hence", "moreover", "furthermore", "although",
  "though", "because", "since", "unless", "until",
  "whereas", "whereby", "indeed", "perhaps", "certainly",
  // Common function words
  "if", "else", "as", "like", "such",
  "one", "two", "first", "last",
  "new", "old", "long", "way",
  // Contractions (partial)
  "don't", "doesn't", "didn't", "won't", "wouldn't",
  "can't", "couldn't", "shouldn't", "isn't", "aren't",
  "wasn't", "weren't", "hasn't", "haven't", "hadn't",
  "let", "let's",
]);

/**
 * Tokenise a block of text into unique content words and a reading-order sequence.
 *
 * @param text  Raw input text
 * @param maxUnique  Maximum unique words to return (default 100)
 * @returns uniqueWords (deduplicated, for embedding), textSequence (reading order),
 *          wordFrequency (count per unique word), truncated (true if capped)
 */
export interface AnnotatedWord {
  /** The original token as it appeared in the text */
  original: string;
  /** Lowercased, trimmed version */
  normalised: string;
  /** Whether this is a content word (not a stop word, length >= 2) */
  isContent: boolean;
  /** Index into textSequence (only set if isContent) */
  sequenceIndex: number;
}

export function tokeniseText(text: string, maxUnique = 100, filterStopWords = false): {
  uniqueWords: string[];
  textSequence: string[];
  wordFrequency: Map<string, number>;
  allWords: AnnotatedWord[];
  truncated: boolean;
} {
  // Extract words with their original form, preserving order
  const raw = text.match(/[a-z''\-]+/gi) || [];

  const seen = new Set<string>();
  const uniqueWords: string[] = [];
  const textSequence: string[] = [];
  const wordFrequency = new Map<string, number>();
  const allWords: AnnotatedWord[] = [];
  let seqIdx = 0;

  for (const token of raw) {
    const word = token.toLowerCase().replace(/^['\-]+|['\-]+$/g, "");
    if (word.length < 2) {
      allWords.push({ original: token, normalised: word, isContent: false, sequenceIndex: -1 });
      continue;
    }
    if (filterStopWords && STOP_WORDS.has(word)) {
      allWords.push({ original: token, normalised: word, isContent: false, sequenceIndex: -1 });
      continue;
    }

    allWords.push({ original: token, normalised: word, isContent: true, sequenceIndex: seqIdx });
    textSequence.push(word);
    seqIdx++;
    wordFrequency.set(word, (wordFrequency.get(word) || 0) + 1);

    if (!seen.has(word) && uniqueWords.length < maxUnique) {
      seen.add(word);
      uniqueWords.push(word);
    }
  }

  return {
    uniqueWords,
    textSequence,
    wordFrequency,
    allWords,
    truncated: seen.size > maxUnique,
  };
}
