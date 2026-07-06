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
      return 'Write a cryptic, puzzle-like clue requiring decoding or wordplay, not a direct question.';
    default:
      return '';
  }
}

// One of the 8 HuntSelectionScreen THEMES keys. 'general' (or anything
// unrecognised) returns null -- no genre constraint, same as pre-genre
// behaviour: thematic-to-location if sensible, otherwise any film trivia.
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
    case 'evergreen_80s':
      return 'a film released in the 1980s (any genre, must be from the decade 1980-1989)';
    default:
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

  const excludeList = Array.isArray(exclude_movies) ? exclude_movies.filter(Boolean) : [];
  const excludeConstraint = excludeList.length > 0
    ? `\nIMPORTANT: Do not use any of these films in your question: ${excludeList.join(', ')}. Choose a completely different film.\n`
    : '';

  const prompt = `Generate one movie trivia question for a GPS treasure hunt waypoint.
Location name: "${locationName}"
Difficulty tier: ${tier}
Guidance: ${tierGuidance(tier)}
${genreRequirement ? `\nGenre constraint: the question MUST be about ${genreRequirement}. Do not use movies outside this genre, even if the location name suggests a different theme.\n` : ''}${excludeConstraint}
CRITICAL CONSTRAINT: The player's correct_answer (a real-world number from film trivia) MUST naturally contain the digit ${required_digit} somewhere in it. This digit fills one GPS coordinate slot. Your extraction_note MUST explain precisely how to get the digit ${required_digit} from correct_answer (e.g. "The tens digit of 88 is 8", "The last digit of 13 is 3", "The hundreds digit of 1994 is 9").

${genreRequirement ? 'Tie the question thematically to the location name only if doing so does not conflict with the genre constraint above — the genre constraint always takes priority.' : 'Tie the question thematically to the location name if a sensible connection exists; otherwise write a strong film trivia question of the right difficulty.'}

Do not include any reasoning or thinking before the JSON. Return ONLY the JSON object, nothing else. The correct_answer field must contain ONLY the final integer — no reasoning, no working, no intermediate attempts, no explanation. Just the number itself.

Return ONLY valid JSON with no markdown fences and no preamble:
{
  "question_text": "...",
  "movie_title": "...",
  "movie_year": 1985,
  "movie_emoji": "...",
  "correct_answer": 88,
  "extraction_note": "The tens digit of 88 is 8",
  "hint_text": "..."
}`;

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
    const errText = await aiResponse.text();
    return new Response(JSON.stringify({ error: 'AI generation failed', detail: errText }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
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
    return new Response(
      JSON.stringify({ error: 'Could not parse AI response', raw: text }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  const jsonSlice = text.slice(lastOpen, lastClose + 1);

  let parsed: any;
  try {
    parsed = JSON.parse(jsonSlice);
  } catch {
    return new Response(
      JSON.stringify({ error: 'Could not parse AI response', raw: jsonSlice }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Sanitise correct_answer — must be a plain integer, never AI reasoning text.
  const correctAnswer = parseInt(String(parsed.correct_answer), 10);
  if (isNaN(correctAnswer)) {
    return new Response(
      JSON.stringify({ error: 'AI returned a non-integer correct_answer', raw: parsed.correct_answer }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
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
});
