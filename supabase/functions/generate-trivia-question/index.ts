// supabase/functions/generate-trivia-question/index.ts
//
// Deploy: supabase functions deploy generate-trivia-question
// Set the key once: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// Re-checks admin status server-side on every call.
// coordinate_digit is INJECTED from required_digit, never trusted from the AI.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function tierGuidance(tier: string) {
  switch (tier) {
    case 'casual':
      return 'Use a well-known, mainstream movie fact a casual fan would get right away. No wordplay.';
    case 'classic':
      return 'Use a moderately well-known fact a regular movie fan would know, but not a casual viewer.';
    case 'expert':
      return 'Use a deep-cut fact: trivia, behind-the-scenes detail, or obscure connection only a film buff would know.';
    case 'cipher':
      return 'Write a cryptic, puzzle-like clue requiring decoding or wordplay. The clue must obscure the underlying FACT, not just the phrasing -- do not name iconic, instantly-identifying specifics (e.g. a famous number, an exact character name, a signature object) directly, even in flowery language. A solver who knows the film should still have to actually decode the clue, not just recognise familiar details dressed up poetically.';
    default:
      return '';
  }
}

// One of the 11 keys in CommandCenter.jsx's GENRES / HuntSelectionScreen's
// THEMES. 'general' (or anything unrecognised) returns null -- no genre
// constraint, same as pre-genre behaviour: thematic-to-location if
// sensible, otherwise any film trivia.
function genrePhrase(genre: string | undefined) {
  switch (genre) {
    case 'horror':
      return 'a horror film (must be a recognised horror movie)';
    case 'scifi':
      return 'a science fiction film (must be a recognised sci-fi movie)';
    case 'action':
      return 'an action film (must be a recognised action movie)';
    case 'romance':
      return 'a romance film (must be a recognised romantic movie)';
    case 'comedy':
      return 'a comedy film (must be a recognised comedy movie)';
    case 'thriller':
      return 'a thriller film (must be a recognised thriller movie)';
    case 'fantasy':
      return 'a fantasy film (must be a recognised fantasy movie)';
    case 'drama':
      return 'a drama film (must be a recognised drama movie)';
    case 'mystery':
      return 'a mystery film (must be a recognised mystery movie)';
    case 'family':
      return 'a family film (must be a recognised family-friendly movie, suitable for all ages -- no horror, graphic violence, or adult themes)';
    case 'evergreen_80s':
      return 'a film released in the 1980s (any genre, must be from the decade 1980-1989)';
    default:
      return null;
  }
}

// Hard membership gate, not a prompt instruction -- genrePhrase() alone
// proved insufficient (a "Family" request with an explicit no-violence
// clause still selected The Dark Knight; the model's own judgment of
// content-appropriateness cannot be trusted the way digit arithmetic
// can). Genres listed here have the model choose from -- and are
// code-level validated (see the allowlist check in the retry loop) to
// have actually chosen from -- this specific, human-approved list
// instead of "any film that fits the genre." Genres not yet listed here
// fall back to genrePhrase()'s free-text instruction, unenforced, same
// as before.
//
// Each list is curated and explicitly approved title-by-title, not
// generated. The family list below deliberately excludes Home Alone
// (slapstick violence) and Matilda (on-screen child abuse is a real
// plot element) despite both being common "family movie" inclusions
// elsewhere. Get the same explicit approval before adding entries to
// an existing list or a new genre key.
const GENRE_FILM_ALLOWLIST: Record<string, string[]> = {
  family: [
    'Toy Story',
    'Finding Nemo',
    'The Lion King',
    'Aladdin',
    'Shrek',
    'Frozen',
    'E.T. the Extra-Terrestrial',
    'Paddington',
    'The Incredibles',
    'Up',
    'Mary Poppins',
    'The Wizard of Oz',
    'Charlie and the Chocolate Factory',
  ],
};

// Weak heuristic, not a real language check: does the question describe a
// calculation the player has to work out? Digit-sequence count deliberately
// stays loose -- Cipher tier is instructed to obscure numbers as wordplay
// ("a rogue's fingers", "the total permitted quarry"), so literal digits in
// question_text are often absent even when a real calculation is implied;
// the operation-word branch is what actually catches that case.
function impliesCalculation(questionText: string): boolean {
  const numberMatches = questionText.match(/\d+/g) || [];
  const hasOperationWord = /\b(subtract|add|multiply|divide|total)\b/i.test(questionText);
  return numberMatches.length >= 2 || hasOperationWord;
}

// Weak signal that extraction_note actually derived the answer rather than
// just asserting it. Distinct-number count (not raw match count) matters --
// "The answer itself is 8, satisfying the digit requirement directly" has
// TWO occurrences of "8" (the exact bug this check exists to catch) and
// would wrongly pass a plain match-count check; a Set collapses that to one
// distinct number, correctly failing it.
function hasDerivationSignal(extractionNote: string): boolean {
  const hasOperatorSymbol = /[+\-*/]/.test(extractionNote);
  const hasOperatorWord = /\b(plus|minus|times|divided)\b/i.test(extractionNote);
  const distinctNumbers = new Set(extractionNote.match(/\d+/g) || []);
  return hasOperatorSymbol || hasOperatorWord || distinctNumbers.size >= 2;
}

// Second, genuinely independent API call, given ONLY the finished
// question_text/extraction_note/hint_text -- no location, tier, genre, or
// digit-requirement context from the original generation. Replaces
// SELF_CORRECTION_PATTERN: that regex could only ever catch phrasing
// already seen (it missed "actually, let's go with..." and later
// "reconsidering" -- two different real leaks, two different words never
// in its list). Asking a fresh call to adversarially judge the finished
// text, rather than pattern-matching prose for words, isn't phrasing-
// dependent the same way. Returns null on any failure (network error,
// non-JSON response) -- treated as a rejection by the caller, same as
// every other failure mode in this file: fail closed, never pass an
// unverified question through because verification itself broke.
async function verifyQuestion(
  questionText: string,
  extractionNote: string,
  hintText: string
): Promise<{ topicMismatch: boolean; hedgingFound: boolean; evidence: string } | null> {
  const verificationPrompt = `A trivia question and its answer derivation are shown below. Check for two things: (1) Does the derivation genuinely and directly answer what the question asks -- or is there any mismatch between the question's topic and the answer given? (2) Does any of this text contain hedging, uncertainty, self-correction, or revised reasoning (e.g. phrases like "wait," "actually," "reconsidering," or any indication the answer was changed mid-thought)? Quote the exact problematic phrase if either is found. Respond with structured JSON: { topic_mismatch: boolean, hedging_found: boolean, evidence: string }.

Question: ${questionText}
Derivation: ${extractionNote}
Hint: ${hintText}

Return ONLY valid JSON, no markdown fences, no preamble:
{
  "topic_mismatch": false,
  "hedging_found": false,
  "evidence": ""
}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      messages: [{ role: 'user', content: verificationPrompt }],
    }),
  });

  if (!response.ok) return null;

  const data = await response.json();
  const text = (data.content as any[]).map((b: any) => b.text || '').join('\n');

  const lastOpen = text.lastIndexOf('{');
  const lastClose = text.lastIndexOf('}');
  if (lastOpen === -1 || lastClose === -1 || lastClose < lastOpen) return null;

  try {
    const parsed = JSON.parse(text.slice(lastOpen, lastClose + 1));
    return {
      topicMismatch: parsed.topic_mismatch === true,
      hedgingFound: parsed.hedging_found === true,
      evidence: String(parsed.evidence ?? ''),
    };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing auth' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
  const token = authHeader.replace('Bearer ', '');

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: adminRow } = await supabase
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (!adminRow) {
    return new Response(JSON.stringify({ error: 'Not authorized' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const body = await req.json();
  const { locationName, tier, required_digit, genre, exclude_movies } = body;

  if (!locationName || !tier) {
    return new Response(JSON.stringify({ error: 'locationName and tier are required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (
    required_digit === undefined ||
    required_digit === null ||
    !Number.isInteger(required_digit) ||
    required_digit < 0 ||
    required_digit > 9
  ) {
    return new Response(
      JSON.stringify({ error: 'required_digit must be an integer 0-9' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const genreRequirement = genrePhrase(genre);
  const allowlistFilms = GENRE_FILM_ALLOWLIST[genre];

  const excludeList = Array.isArray(exclude_movies) ? exclude_movies.filter(Boolean) : [];
  const excludeConstraint = excludeList.length > 0
    ? `\nIMPORTANT: Do not use any of these films in your question: ${excludeList.join(', ')}. Choose a completely different film.\n`
    : '';

  // Allowlist genres: present the specific approved list and require an
  // exact match (enforced below, code-side). Non-allowlist genres: fall
  // back to genrePhrase()'s free-text instruction, same as before this
  // fix -- unenforced until that genre gets its own approved list.
  let genreInstruction = '';
  if (allowlistFilms && allowlistFilms.length > 0) {
    const excludeSet = new Set(excludeList.map((m: string) => m.trim().toLowerCase()));
    const available = allowlistFilms.filter((f) => !excludeSet.has(f.trim().toLowerCase()));
    // If every approved title is already used elsewhere in this hunt,
    // present the full list anyway rather than handing the model nothing
    // to choose from -- a repeated film is a lesser problem than no
    // question at all, and this only happens once a hunt has used most
    // or all of a short list.
    const presentedList = available.length > 0 ? available : allowlistFilms;
    genreInstruction = `\nFilm constraint: movie_title MUST be EXACTLY one of the following titles, copied character-for-character -- do not paraphrase, abbreviate, or substitute a different film even if it seems to fit the location better:\n${presentedList.map((f) => `- ${f}`).join('\n')}\n`;
  } else if (genreRequirement) {
    genreInstruction = `\nGenre constraint: the question MUST be about ${genreRequirement}. Do not use movies outside this genre, even if the location name suggests a different theme.\n`;
  }
  const hasGenreConstraint = genreInstruction !== '';

  const prompt = `Generate one movie trivia question for a GPS treasure hunt waypoint.
Location name: "${locationName}"
Difficulty tier: ${tier}
Guidance: ${tierGuidance(tier)}
${genreInstruction}${excludeConstraint}
CRITICAL CONSTRAINT: The player's correct_answer (a real-world number from film trivia) MUST naturally contain the digit ${required_digit} somewhere in it. This digit fills one GPS coordinate slot. Your extraction_note MUST explain precisely how to get the digit ${required_digit} from correct_answer (e.g. "The tens digit of 88 is 8", "The last digit of 13 is 3", "The hundreds digit of 1994 is 9").

If the question describes a calculation (e.g. subtracting, adding, or combining numbers or facts), extraction_note must show the actual calculation using the specific numbers/facts referenced in question_text, ending in the final digit -- not just assert the answer. Example of a VALID note: "Quota is 6, minus 10 fingers, plus 12 floors = 8, take the units digit." An INVALID note merely states the answer without deriving it from the question's own numbers, e.g. "The answer is 8, satisfying the requirement" -- this must never be produced.

${hasGenreConstraint ? 'Tie the question thematically to the location name only if doing so does not conflict with the constraint above — the film/genre constraint always takes priority.' : 'Tie the question thematically to the location name if a sensible connection exists; otherwise write a strong film trivia question of the right difficulty.'}

Do not include any reasoning or thinking before the JSON. Return ONLY the JSON object, nothing else. The correct_answer field must contain ONLY the final integer — no reasoning, no working, no intermediate attempts, no explanation. Just the number itself. extraction_note and question_text must also be completely free of reasoning, self-correction, or alternate attempts. Do not write "wait", "but", "actually", "let me reconsider", "correcting", or show any alternate digit-checking process. If your first idea doesn't satisfy the digit constraint, work it out silently and only output the final, clean, correct version. Never let the reader see you checking or changing your answer.

The question must be about exactly one film: movie_title. Before finalising your answer, check question_text, extraction_note, and hint_text yourself for any OTHER film title -- one you considered and moved away from while drafting, a comparison, anything. List every such title in other_films_mentioned. This must be an empty array unless the question deliberately and coherently discusses two named films as part of the trivia itself (rare) -- it must never contain a film you were merely deciding between while writing.

Return ONLY valid JSON with no markdown fences and no preamble:
{
  "question_text": "...",
  "movie_title": "...",
  "movie_year": 1985,
  "movie_emoji": "...",
  "correct_answer": 88,
  "extraction_note": "The tens digit of 88 is 8",
  "hint_text": "...",
  "other_films_mentioned": []
}`;

  // Up to 3 attempts total. A generation that fails its own stated
  // constraints (clean fields, digit actually present) is a failed
  // attempt, not a saveable puzzle -- retry rather than pass it through.
  const MAX_ATTEMPTS = 3;

  let lastFailureReason = 'unknown';

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!aiResponse.ok) {
      lastFailureReason = `AI request failed: ${await aiResponse.text()}`;
      continue;
    }

    const aiData = await aiResponse.json();
    const text = (aiData.content as any[]).map((b) => b.text || '').join('\n');

    // The AI reasons before answering, so the clean JSON object is always the
    // LAST one in the response -- a greedy first-{-to-last-} match can span
    // across reasoning text that itself contains braces, leaking reasoning
    // into the parsed fields. Find the last "{" and the last "}" instead,
    // which isolates the final JSON object regardless of what precedes it.
    const lastOpen = text.lastIndexOf('{');
    const lastClose = text.lastIndexOf('}');
    if (lastOpen === -1 || lastClose === -1 || lastClose < lastOpen) {
      lastFailureReason = 'Could not locate a JSON object in the AI response';
      continue;
    }
    const jsonSlice = text.slice(lastOpen, lastClose + 1);

    let parsed: any;
    try {
      parsed = JSON.parse(jsonSlice);
    } catch {
      lastFailureReason = 'AI response was not valid JSON';
      continue;
    }

    // Code-level allowlist membership check -- not model self-report, not
    // a prompt instruction trusted on faith. This is the actual enforcement
    // for allowlist genres; genreInstruction above only tells the model
    // what to do, this verifies it actually did it. Exact match (trimmed,
    // case-insensitive) against the same list presented in the prompt.
    if (allowlistFilms && allowlistFilms.length > 0) {
      const normalizedTitle = String(parsed.movie_title ?? '').trim().toLowerCase();
      const isAllowed = allowlistFilms.some((f) => f.trim().toLowerCase() === normalizedTitle);
      if (!isAllowed) {
        lastFailureReason = `movie_title "${parsed.movie_title}" is not in the approved ${genre} allowlist`;
        continue;
      }
    }

    // Strict correct_answer validation -- reject anything containing a
    // non-digit character rather than relying on parseInt's lenient
    // leading-digits parse, which would silently truncate leaked
    // reasoning text (e.g. "15 -- wait, actually 8" -> 15) instead of
    // catching it.
    const rawAnswer = String(parsed.correct_answer ?? '').trim();
    if (!/^\d+$/.test(rawAnswer)) {
      lastFailureReason = `correct_answer was not a clean integer: "${rawAnswer}"`;
      continue;
    }
    const correctAnswer = parseInt(rawAnswer, 10);

    // The whole point of required_digit is that it must actually be
    // extractable from correct_answer -- verify this instead of trusting
    // the AI's own CRITICAL CONSTRAINT instruction to have been followed.
    if (!rawAnswer.includes(String(required_digit))) {
      lastFailureReason = `correct_answer (${rawAnswer}) does not contain required digit ${required_digit}`;
      continue;
    }

    const extractionNote = String(parsed.extraction_note ?? '');
    const questionText   = String(parsed.question_text ?? '');

    // Phrasing-independent structural check: the AI self-reports any OTHER
    // film title it mentioned anywhere in the text (e.g. one it drifted onto
    // mid-generation before settling on movie_title). A non-empty array
    // means the model itself flagged contamination -- reject regardless of
    // how that drift was phrased.
    const otherFilms = Array.isArray(parsed.other_films_mentioned)
      ? parsed.other_films_mentioned.filter((f: unknown) => typeof f === 'string' && f.trim())
      : [];
    if (otherFilms.length > 0) {
      lastFailureReason = `question referenced other film title(s) besides movie_title: ${otherFilms.join(', ')}`;
      continue;
    }

    // Catches a bare assertion of the answer (e.g. "The answer itself is 8,
    // satisfying the digit requirement directly") that passes every check
    // above but never actually derives the digit from the question's own
    // numbers -- see migration/prompt notes above for a real example found
    // in Cipher-tier testing.
    if (impliesCalculation(questionText) && !hasDerivationSignal(extractionNote)) {
      lastFailureReason = 'question_text implies a calculation but extraction_note does not show a derivation';
      continue;
    }

    // Independent verification pass -- the last gate, run only once every
    // other check has already passed. A second, separate API call given
    // just the finished text (see verifyQuestion above for why this is
    // stronger than a regex). Fails closed: a verification call that
    // itself errors is treated as a rejection, not a pass-through.
    const verification = await verifyQuestion(questionText, extractionNote, String(parsed.hint_text ?? ''));
    if (!verification) {
      lastFailureReason = 'Verification pass failed (network error or unparseable response)';
      continue;
    }
    if (verification.topicMismatch || verification.hedgingFound) {
      const reason = verification.topicMismatch && verification.hedgingFound
        ? 'topic mismatch and hedging/self-correction'
        : verification.topicMismatch
          ? 'topic mismatch'
          : 'hedging/self-correction';
      lastFailureReason = `Verification rejected (${reason}): ${verification.evidence || 'no evidence quoted'}`;
      continue;
    }

    // coordinate_digit is always required_digit — the AI cannot override this value.
    return new Response(
      JSON.stringify({
        question_text:    parsed.question_text,
        movie_title:      parsed.movie_title,
        movie_year:       parsed.movie_year ?? null,
        movie_emoji:      parsed.movie_emoji || '🎬',
        correct_answer:   correctAnswer,
        coordinate_digit: required_digit,
        extraction_note:  parsed.extraction_note,
        hint_text:        parsed.hint_text,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Every attempt failed its own validation -- surface a clear error
  // rather than ever saving a broken or contaminated puzzle.
  return new Response(
    JSON.stringify({
      error: `Trivia generation failed validation after ${MAX_ATTEMPTS} attempts`,
      lastFailureReason,
    }),
    { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
