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
    'Moana',
    'Encanto',
    'Coco',
    'Inside Out',
    'Zootopia',
    'Ratatouille',
    'Monsters, Inc.',
    'Despicable Me',
    'The Little Mermaid',
    'Beauty and the Beast',
    'Cinderella',
    'Snow White and the Seven Dwarfs',
    'The Jungle Book',
    'Matilda',
    'The Sound of Music',
    'The Parent Trap',
    'Paddington 2',
    'Homeward Bound: The Incredible Journey',
    'The Lego Movie',
    'How to Train Your Dragon',
    'Finding Dory',
    'Toy Story 3',
    'The Incredibles 2',
    'Wreck-It Ralph',
    'Big Hero 6',
    'Kung Fu Panda',
    'Madagascar',
    'Ice Age',
    'Trolls',
    'Sing',
    'The Princess Bride',
    'Willy Wonka & the Chocolate Factory',
    'Chitty Chitty Bang Bang',
    'The NeverEnding Story',
    'Hook',
    'Free Willy',
    'Babe',
  ],
  horror: [
    'The Shining',
    'Halloween',
    'A Nightmare on Elm Street',
    'The Exorcist',
    'Poltergeist',
    'Scream',
    'The Conjuring',
    'Get Out',
    'It',
    'Psycho',
    'Carrie',
    'Rosemary\'s Baby',
    'The Ring',
    'Hereditary',
    'A Quiet Place',
    'The Babadook',
    'Child\'s Play',
    'Insidious',
    'The Others',
    'The Witch',
    'Friday the 13th',
    'The Texas Chain Saw Massacre',
    'Saw',
    'Sinister',
    'The Sixth Sense',
    'Paranormal Activity',
    'It Follows',
    '28 Days Later',
    'Dawn of the Dead',
    'Evil Dead',
    'Pet Sematary',
    'Misery',
    'The Amityville Horror',
    'Trick \'r Treat',
    'Nosferatu',
    'Candyman',
    'The Blair Witch Project',
    'The Cabin in the Woods',
    'Us',
    'The Fly',
    'Midsommar',
    'The Invisible Man',
    'Talk to Me',
    'Smile',
    'Barbarian',
    'Nope',
    'M3GAN',
    'Longlegs',
    'Late Night with the Devil',
    'The Black Phone',
  ],
  scifi: [
    'Jurassic Park',
    'The Matrix',
    'Back to the Future',
    'Alien',
    'Star Wars: A New Hope',
    'Blade Runner',
    'The Terminator',
    'Terminator 2: Judgment Day',
    'Inception',
    'Interstellar',
    'Close Encounters of the Third Kind',
    '2001: A Space Odyssey',
    'Independence Day',
    'Men in Black',
    'Jurassic World',
    'War of the Worlds',
    'District 9',
    'Edge of Tomorrow',
    'Minority Report',
    'Arrival',
    'Star Wars: The Empire Strikes Back',
    'Star Wars: Return of the Jedi',
    'Planet of the Apes',
    'The Fifth Element',
    'Total Recall',
    'RoboCop',
    'Predator',
    'Gattaca',
    'A Clockwork Orange',
    'The Day the Earth Stood Still',
    'Forbidden Planet',
    'Star Trek II: The Wrath of Khan',
    'Contact',
    'Escape from New York',
    'THX 1138',
    'Metropolis',
    'The Iron Giant',
    'WALL-E',
    'Starship Troopers',
    'The Thing',
    'Dune',
    'Dune: Part Two',
    'Blade Runner 2049',
    'Ex Machina',
    'The Martian',
    'Everything Everywhere All at Once',
    'Godzilla Minus One',
    'Tenet',
    'Spider-Man: Into the Spider-Verse',
    'Guardians of the Galaxy',
  ],
  action: [
    'Gladiator',
    'Raiders of the Lost Ark',
    'Die Hard',
    'Mad Max: Fury Road',
    'John Wick',
    'Mission: Impossible - Fallout',
    'The Dark Knight',
    'Speed',
    'Lethal Weapon',
    'Point Break',
    'The Bourne Identity',
    'Casino Royale',
    'Skyfall',
    'Top Gun',
    'Top Gun: Maverick',
    'Kill Bill: Volume 1',
    'The Rock',
    'Con Air',
    'Face/Off',
    'True Lies',
    'Heat',
    'The Fugitive',
    'Air Force One',
    'Commando',
    'First Blood',
    'Enter the Dragon',
    'The Italian Job',
    'Ocean\'s Eleven',
    'The Expendables',
    'Taken',
    'Kingsman: The Secret Service',
    'Atomic Blonde',
    'The Equalizer',
    'Baby Driver',
    'Fast Five',
    'Léon: The Professional',
    'Man on Fire',
    'Kill Bill: Volume 2',
    'The Transporter',
    'Bad Boys',
    'John Wick: Chapter 4',
    'Extraction',
    'The Gray Man',
    'Nobody',
    'Bullet Train',
    'Mission: Impossible - Dead Reckoning Part One',
    'No Time to Die',
    'RRR',
    'Furiosa: A Mad Max Saga',
    'The Beekeeper',
  ],
  romance: [
    'Titanic',
    'The Notebook',
    'Pretty Woman',
    'Dirty Dancing',
    'Ghost',
    'Sleepless in Seattle',
    'When Harry Met Sally',
    'Notting Hill',
    'Love Actually',
    '10 Things I Hate About You',
    'Crazy Rich Asians',
    'La La Land',
    'Casablanca',
    'Roman Holiday',
    'An Affair to Remember',
    'Jerry Maguire',
    'Four Weddings and a Funeral',
    'You\'ve Got Mail',
    'About Time',
    'Pride & Prejudice',
    'Eternal Sunshine of the Spotless Mind',
    'Silver Linings Playbook',
    'Amélie',
    'Before Sunrise',
    'Before Sunset',
    'The Fault in Our Stars',
    'Moulin Rouge!',
    'Romeo + Juliet',
    'West Side Story',
    'A Star Is Born',
    'The Vow',
    'Bridget Jones\'s Diary',
    'Twilight',
    'Brokeback Mountain',
    'The Holiday',
    'Atonement',
    'Out of Africa',
    'The English Patient',
    'Sense and Sensibility',
    'Emma',
    'Past Lives',
    'Anyone But You',
    'The Idea of You',
    'Challengers',
    'To All the Boys I\'ve Loved Before',
    'Red, White & Royal Blue',
    'Materialists',
    'Anatomy of a Fall',
    'One Day',
    'Set It Up',
  ],
  comedy: [
    'Airplane!',
    'The Hangover',
    'Superbad',
    'Anchorman: The Legend of Ron Burgundy',
    'Dumb and Dumber',
    'Bridesmaids',
    'Mean Girls',
    'Legally Blonde',
    'Ferris Bueller\'s Day Off',
    'Groundhog Day',
    'Monty Python and the Holy Grail',
    'Zoolander',
    'Elf',
    'Home Alone',
    'The Grand Budapest Hotel',
    'Napoleon Dynamite',
    'Step Brothers',
    'Tropic Thunder',
    '21 Jump Street',
    'Wedding Crashers',
    'The 40-Year-Old Virgin',
    'Knocked Up',
    'Coming to America',
    'Beverly Hills Cop',
    'Ghostbusters',
    'Ace Ventura: Pet Detective',
    'Dodgeball: A True Underdog Story',
    'Meet the Parents',
    'There\'s Something About Mary',
    'Clueless',
    'School of Rock',
    'Big',
    'Some Like It Hot',
    'Duck Soup',
    'Blazing Saddles',
    'Young Frankenstein',
    'This Is Spinal Tap',
    'Office Space',
    'Best in Show',
    'What We Do in the Shadows',
    'Game Night',
    'Palm Springs',
    'Booksmart',
    'Barbie',
    'Bruce Almighty',
    'Liar Liar',
    'The Mask',
    'Shaun of the Dead',
    'Hot Fuzz',
    'Mrs. Doubtfire',
  ],
  thriller: [
    'Se7en',
    'Zodiac',
    'Gone Girl',
    'Prisoners',
    'No Country for Old Men',
    'The Silence of the Lambs',
    'Shutter Island',
    'Fight Club',
    'The Departed',
    'Memento',
    'North by Northwest',
    'Rear Window',
    'Vertigo',
    'The Girl with the Dragon Tattoo',
    'Nightcrawler',
    'Wind River',
    'Knives Out',
    'Glass Onion',
    'The Talented Mr. Ripley',
    'Rope',
    'Dial M for Murder',
    'Wait Until Dark',
    'Cape Fear',
    'The Usual Suspects',
    'Primal Fear',
    'Basic Instinct',
    'Jagged Edge',
    'The Firm',
    'Enemy of the State',
    'The Bourne Ultimatum',
    'Salt',
    'Unknown',
    'The Girl on the Train',
    'Sicario',
    'Wind Chill',
    'Jaws',
    'Death on the Nile',
    'Murder on the Orient Express',
    'The Boy in the Striped Pyjamas',
    'A Simple Favor',
    'The Invisible Guest',
    'Searching',
    'The Guilty',
    'Bone Tomahawk',
    'Widows',
    'Promising Young Woman',
    'Don\'t Breathe',
    'Panic Room',
    'Flightplan',
    'Nightmare Alley',
  ],
  fantasy: [
    'The Lord of the Rings: The Fellowship of the Ring',
    'The Lord of the Rings: The Two Towers',
    'The Lord of the Rings: The Return of the King',
    'The Hobbit: An Unexpected Journey',
    'Harry Potter and the Philosopher\'s Stone',
    'Harry Potter and the Chamber of Secrets',
    'Harry Potter and the Prisoner of Azkaban',
    'Harry Potter and the Goblet of Fire',
    'The Chronicles of Narnia: The Lion, the Witch and the Wardrobe',
    'Pan\'s Labyrinth',
    'Stardust',
    'Willow',
    'Labyrinth',
    'Legend',
    'Big Fish',
    'Edward Scissorhands',
    'The Shape of Water',
    'Spirited Away',
    'Howl\'s Moving Castle',
    'My Neighbor Totoro',
    'Beetlejuice',
    'Corpse Bride',
    'Coraline',
    'The Nightmare Before Christmas',
    'Fantastic Beasts and Where to Find Them',
    'Doctor Strange',
    'Aquaman',
    'Wonder Woman',
    'The Green Knight',
    'Excalibur',
    'Time Bandits',
    'MirrorMask',
    'Enchanted',
    'Maleficent',
    'Into the Woods',
    'Percy Jackson and the Olympians: The Lightning Thief',
    'Eragon',
    'The Golden Compass',
    'Warcraft',
    'Clash of the Titans',
    'Jason and the Argonauts',
    'Freaky Friday',
    'The Adventures of Baron Munchausen',
    'The Dark Crystal',
    'Pete\'s Dragon',
    'The Sword in the Stone',
    'Peter Pan',
    'Alice in Wonderland',
    'The BFG',
    'Krull',
  ],
  drama: [
    'The Shawshank Redemption',
    'Forrest Gump',
    'The Godfather',
    '12 Angry Men',
    'Schindler\'s List',
    'The Green Mile',
    'A Beautiful Mind',
    'Good Will Hunting',
    'Dead Poets Society',
    'The Pursuit of Happyness',
    'American History X',
    'Requiem for a Dream',
    'There Will Be Blood',
    'Whiplash',
    'Manchester by the Sea',
    'Moonlight',
    'The King\'s Speech',
    '12 Years a Slave',
    'Spotlight',
    'The Social Network',
    'The Wolf of Wall Street',
    'A Few Good Men',
    'Philadelphia',
    'Rain Man',
    'The Elephant Man',
    'One Flew Over the Cuckoo\'s Nest',
    'The Deer Hunter',
    'Apocalypse Now',
    'Platoon',
    'Full Metal Jacket',
    'Saving Private Ryan',
    'Braveheart',
    'The Last King of Scotland',
    'The Theory of Everything',
    'The Imitation Game',
    'Bohemian Rhapsody',
    'Rocketman',
    'Ford v Ferrari',
    'The Blind Side',
    'Hidden Figures',
    'Erin Brockovich',
    'Freedom Writers',
    'Precious',
    'The Help',
    'Lion',
    'Room',
    'Nomadland',
    'CODA',
    'Green Book',
    'Dallas Buyers Club',
  ],
  mystery: [
    'Sherlock Holmes',
    'Sherlock Holmes: A Game of Shadows',
    'Clue',
    'Chinatown',
    'L.A. Confidential',
    'The Maltese Falcon',
    'Rebecca',
    'Gaslight',
    'And Then There Were None',
    'The Da Vinci Code',
    'Angels & Demons',
    'The Nice Guys',
    'Kiss Kiss Bang Bang',
    'Brick',
    'Nancy Drew',
    'The Name of the Rose',
    'Witness for the Prosecution',
    'The Girl Who Played with Fire',
    'Kill the Messenger',
    'Mystic River',
    'Insomnia',
    'Body Heat',
    'The Third Man',
    'Blow-Up',
    'Blow Out',
    'Charade',
    'The Lady Vanishes',
    'Foul Play',
    'The Long Goodbye',
    'Sleuth',
    'Deathtrap',
    'The Last of Sheila',
    'Only Murders in the Building',
    'Big Trouble in Little China',
    'The Pink Panther',
    'Shaft',
    'In the Heat of the Night',
    'The Man Who Knew Too Much',
    'Frenzy',
    'Suspicion',
    'Notorious',
    'Shadow of a Doubt',
    'Strangers on a Train',
    'The 39 Steps',
    'Marnie',
    'The Conversation',
    'Klute',
    'Devil in a Blue Dress',
    'Gosford Park',
    'Zero Effect',
  ],
  general: [
    'Pulp Fiction',
    'Rocky',
    'Rocky II',
    'The Sandlot',
    'Remember the Titans',
    'Miracle',
    'Moneyball',
    'Rudy',
    'Hoosiers',
    'Field of Dreams',
    'A League of Their Own',
    'Cool Runnings',
    'Creed',
    'Unforgiven',
    'The Good, the Bad and the Ugly',
    'True Grit',
    'Tombstone',
    'Butch Cassidy and the Sundance Kid',
    'The Magnificent Seven',
    'Django Unchained',
    '3:10 to Yuma',
    'Dunkirk',
    '1917',
    'Hacksaw Ridge',
    'We Were Soldiers',
    'Black Hawk Down',
    'Letters from Iwo Jima',
    'Grease',
    'Mamma Mia!',
    'The Greatest Showman',
    'Chicago',
    'Hairspray',
    'Singin\' in the Rain',
    'Goodfellas',
    'Scarface',
    'Casino',
    'American Gangster',
    'City of God',
    'The Breakfast Club',
    'Stand By Me',
    'Dazed and Confused',
    'Boyhood',
    'Lady Bird',
    'Lawrence of Arabia',
    'Ben-Hur',
    'Spartacus',
    'Troy',
    'Twister',
    'The Perfect Storm',
    'Sully',
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

// Cheap, phrasing-list first line of defence against visible self-correction
// (e.g. "what is the number of the chamber... No -- let's go with a cleaner
// fact... Actually, clean question:..."), checked before the more expensive
// verifyTextHygiene API call so an obvious leak never needs a second
// round-trip to catch. "actually"/"wait" are punctuation-anchored
// (comma-adjacent only) rather than bare word-boundary matches -- a bare
// /\bactually\b/i or /\bwait\b/i would false-positive on legitimate
// content like "the wait staff" or "actually this was intentional" used
// as plain emphasis. This list is inherently incomplete (same limitation
// this file's own comment already notes about the earlier, now-replaced
// SELF_CORRECTION_PATTERN regex) -- novel phrasing this list doesn't
// anticipate is verifyTextHygiene's job, not this gate's.
const SELF_CORRECTION_MARKERS = [
  /,\s*actually\b/i,
  /\bactually,/i,
  /\bwait,/i,
  /\bno\s*[—-]\s*let'?s go with\b/i,
  /\bclean restart\b/i,
  /\binstead:/i,
  /\blet'?s go with\b/i,
  /\bon second thought\b/i,
  /\bscratch that\b/i,
];

function findSelfCorrectionMarker(text: string): string | null {
  for (const marker of SELF_CORRECTION_MARKERS) {
    const match = text.match(marker);
    if (match) return match[0];
  }
  return null;
}

const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

// Numbers in text, as digit runs AND spelled-out words (single words like
// "forty", plus two-token compounds like "twenty"+"one" -- the [a-z]+
// tokenizer strips both hyphens and spaces the same way, so "Twenty-One"
// and "Twenty One" are handled identically). Deliberately bounded to 0-99:
// movie titles overwhelmingly spell out small numbers ("Ocean's Eleven",
// "The Hateful Eight", "21 Jump Street"), not four-digit years or
// "one hundred"-style compounds. Fixed vocabulary, same caveat as
// SELF_CORRECTION_MARKERS -- forms outside this list won't be caught.
function extractNumbers(text: string): Set<number> {
  const found = new Set<number>();
  for (const m of text.match(/\d+/g) || []) found.add(parseInt(m, 10));

  const tokens = text.toLowerCase().match(/[a-z]+/g) || [];
  for (let i = 0; i < tokens.length; i++) {
    if (NUMBER_WORDS[tokens[i]] !== undefined) found.add(NUMBER_WORDS[tokens[i]]);
    if (i + 1 < tokens.length) {
      const tens = NUMBER_WORDS[tokens[i]];
      const ones = NUMBER_WORDS[tokens[i + 1]];
      if (tens !== undefined && tens >= 20 && tens % 10 === 0 && ones !== undefined && ones < 10) {
        found.add(tens + ones); // "twenty" + "one" -> 21
      }
    }
  }
  return found;
}

// Boundary-aware: correct_answer=8 must not match inside "1988". Digit
// tokens only, deliberately not extended to word-numbers the way
// extractNumbers() is for movie_title -- question_text is prose, and
// prose legitimately uses small number-words ("the two friends") without
// leaking anything; word-number detection here would risk far more false
// positives than value.
function containsExactNumber(text: string, num: number): boolean {
  return new RegExp(`(?<!\\d)${num}(?!\\d)`).test(text);
}

// Shared JSON-extraction logic for both verification calls below -- the
// model reasons before answering, so the clean JSON object is always the
// LAST one in the response (same reasoning as the main generation loop's
// lastOpen/lastClose extraction).
function extractLastJsonObject(text: string): any | null {
  const lastOpen = text.lastIndexOf('{');
  const lastClose = text.lastIndexOf('}');
  if (lastOpen === -1 || lastClose === -1 || lastClose < lastOpen) return null;
  try {
    return JSON.parse(text.slice(lastOpen, lastClose + 1));
  } catch {
    return null;
  }
}

async function callVerifier(prompt: string): Promise<any | null> {
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
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) return null;
  const data = await response.json();
  const text = (data.content as any[]).map((b: any) => b.text || '').join('\n');
  return extractLastJsonObject(text);
}

// Call A: factual/provenance judgment -- does correct_answer genuinely mean
// what the question claims. Given movieTitle and correctAnswer explicitly
// (not inferred from prose) because checks (4)/(5) below are meaningless
// without knowing exactly which film and which number are in play. Split
// out from the former single verifyQuestion call (see Call B below) so
// this factual judgment doesn't compete for attention with the separate
// text-hygiene judgment in one response -- five simultaneous checks in one
// call risked each getting less scrutiny than a focused two-call split.
// Returns null on any failure (network error, non-JSON response) --
// treated as a rejection by the caller: fail closed, never pass an
// unverified question through because verification itself broke.
async function verifyFactualAccuracy(
  questionText: string,
  extractionNote: string,
  movieTitle: string,
  correctAnswer: number
): Promise<{ topicMismatch: boolean; contrivedAnswer: boolean; nonDiegeticFact: boolean; evidence: string } | null> {
  const factualPrompt = `A trivia question and its answer derivation are shown below, for the film "${movieTitle}". Check for three things:

(1) Does the derivation genuinely and directly answer what the question asks -- or is there any mismatch between the question's topic and the answer given?

(4) Is correct_answer (${correctAnswer}) the film's ACTUAL, genuine fact -- the real number exactly as it would naturally be known, stated, or recalled by a fan (e.g. platform nine and three-quarters, a character in their fourth year, amps that go to eleven) -- or has it been arithmetically transformed, multiplied, reformatted, or pre-extracted specifically to manufacture a digit that wouldn't otherwise be there? Reject as contrived if: the real fact was multiplied or combined with an unrelated number to produce a different value (e.g. a school year of 4, multiplied by 10 to give "40"); a non-numeric or fractional real value was re-encoded into a fabricated numeral (e.g. platform 9¾ written as "934"); or the question itself asks the player to perform the digit-extraction step that should only ever happen in extraction_note (e.g. "enter the tens digit of 11" -- the player should be asked for 11 itself, never told to compute a digit from it). A transformed or fabricated correct_answer is a rejection even when the arithmetic shown is internally consistent -- the problem is the fact itself, not whether the shown math adds up.

(5) Is the fact behind correct_answer something that appears WITHIN the film itself -- diegetic content the audience can see or hear on screen (a number shown, a line of dialogue, a count of objects or characters, an in-story date or address, an age stated in the story) -- or is it PRODUCTION or MARKETING metadata: a fact about how the film was made, shot, or marketed, that a viewer could only know from reading about the film, never from watching it (runtime, budget, box office, number of takes or cuts, technical specs like screen reflectivity or film stock, shooting schedule, release date, awards, off-screen crew counts)? Reject as non-diegetic if it's the latter.

Quote the exact problematic phrase or value for any check that fires. Respond with structured JSON: { topic_mismatch: boolean, contrived_answer: boolean, non_diegetic_fact: boolean, evidence: string }.

Question: ${questionText}
Derivation: ${extractionNote}

Return ONLY valid JSON, no markdown fences, no preamble:
{
  "topic_mismatch": false,
  "contrived_answer": false,
  "non_diegetic_fact": false,
  "evidence": ""
}`;

  const parsed = await callVerifier(factualPrompt);
  if (!parsed) return null;
  return {
    topicMismatch: parsed.topic_mismatch === true,
    contrivedAnswer: parsed.contrived_answer === true,
    nonDiegeticFact: parsed.non_diegetic_fact === true,
    evidence: String(parsed.evidence ?? ''),
  };
}

// Call B: text-hygiene judgment -- self-correction/hedging language, kept
// as its own call so it doesn't compete with Call A's factual judgment.
// Replaces the old SELF_CORRECTION_PATTERN regex (could only ever catch
// phrasing already seen -- it missed "actually, let's go with..." and
// later "reconsidering", two different real leaks never in its list).
// Fails closed the same way as Call A.
async function verifyTextHygiene(
  questionText: string,
  extractionNote: string,
  hintText: string
): Promise<{ hedgingFound: boolean; evidence: string } | null> {
  const hygienePrompt = `A trivia question and its answer derivation are shown below. Check for two things:

(2) Does the derivation itself contain hedging, uncertainty, self-correction, or revised reasoning (e.g. phrases like "wait," "actually," "reconsidering," or any indication the answer was changed mid-thought)?

(3) Separately from (2): does the QUESTION TEXT itself show any visible deliberation, false start, or self-correction -- e.g. proposing one fact then abandoning it for "a cleaner one," narrating indecision over which detail to use, or any sign the writer reconsidered mid-question? A question can leak this even when its derivation is completely clean, so judge it independently, not as an afterthought to (2).

Quote the exact problematic phrase if either is found. Respond with structured JSON: { hedging_found: boolean, evidence: string } -- set hedging_found to true if EITHER (2) or (3) applies.

Question: ${questionText}
Derivation: ${extractionNote}
Hint: ${hintText}

Return ONLY valid JSON, no markdown fences, no preamble:
{
  "hedging_found": false,
  "evidence": ""
}`;

  const parsed = await callVerifier(hygienePrompt);
  if (!parsed) return null;
  return {
    hedgingFound: parsed.hedging_found === true,
    evidence: String(parsed.evidence ?? ''),
  };
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

  // Builds the approved-film-list section fresh per attempt so titles that
  // already failed THIS call (attemptedTitles, reset per generation
  // request, distinct from excludeList which is other waypoints in the
  // same hunt) get removed from the menu on retries, on top of the
  // existing hunt-level exclusion. Same "fall back to the full list rather
  // than hand the model nothing" safety net as before if every title ends
  // up excluded. Allowlist genres: present the specific approved list and
  // require an exact match (enforced below, code-side, UNCHANGED). Non-
  // allowlist genres: fall back to genrePhrase()'s free-text instruction,
  // unenforced until that genre gets its own approved list.
  function buildFilmSection(attemptedTitles: string[]): { instruction: string; hasConstraint: boolean } {
    if (allowlistFilms && allowlistFilms.length > 0) {
      const excludeSet = new Set([
        ...excludeList.map((m: string) => m.trim().toLowerCase()),
        ...attemptedTitles.map((m) => m.trim().toLowerCase()),
      ]);
      const available = allowlistFilms.filter((f) => !excludeSet.has(f.trim().toLowerCase()));
      const presentedList = available.length > 0 ? available : allowlistFilms;
      return {
        instruction: `\nApproved films for this genre -- your numeric fact must come from one of these, copied character-for-character as movie_title:\n${presentedList.map((f) => `- ${f}`).join('\n')}\n`,
        hasConstraint: true,
      };
    }
    if (genreRequirement) {
      return {
        instruction: `\nGenre constraint: the question MUST be about ${genreRequirement}. Do not use movies outside this genre, even if the location name suggests a different theme.\n`,
        hasConstraint: true,
      };
    }
    return { instruction: '', hasConstraint: false };
  }

  // Digit constraint now comes FIRST, before film selection -- the search
  // should be "find a number containing the digit, then see which approved
  // film it naturally belongs to", not "pick a film, then hope a fitting
  // number turns up" (the old ordering, which is what was actually
  // failing: two hard constraints handed to the model in film-first order
  // gave it no structured way to satisfy both at once). Retry feedback
  // (attempt > 1) is prepended ahead of everything else, naming the
  // previous failure reason and the films already tried and rejected this
  // round, so attempts 2+ are genuinely different tries rather than
  // identical dice rolls against an unchanged prompt.
  function buildPrompt(attempt: number, priorFailureReason: string, attemptedTitles: string[]): string {
    const { instruction: genreInstruction, hasConstraint: hasGenreConstraint } = buildFilmSection(attemptedTitles);

    const retryFeedback = attempt > 1
      ? `Your previous attempt failed: ${priorFailureReason}. That film/fact did not work -- choose a DIFFERENT film from the approved list below and a different numeric fact. Films already tried and rejected this round: ${attemptedTitles.length > 0 ? attemptedTitles.join(', ') : 'none yet'}.\n\n`
      : '';

    return `${retryFeedback}Generate one movie trivia question for a GPS treasure hunt waypoint.
Location name: "${locationName}"
Difficulty tier: ${tier}
Guidance: ${tierGuidance(tier)}

CRITICAL CONSTRAINT -- SOLVE THIS FIRST, BEFORE PICKING A FILM: you need a real-world number that is a genuine, independently-verifiable fact from film trivia -- something true regardless of this task, that a fan would already know or could look up (a flight number, room number, a year spoken in dialogue, a count of objects, a character's age, a street address, a vault or locker number, a platform number, a quantity, a date). The digit ${required_digit} requirement is a FILTER applied to facts you already know -- search your existing knowledge of the approved films for a genuine fact that happens to naturally contain ${required_digit}. Do NOT invent, transform, multiply, recompute, or reformat a real fact to manufacture a number containing ${required_digit}: if platform nine and three-quarters doesn't naturally contain your digit, writing it as "934" is fabrication, not a fact; if a character is in year 4, multiplying by 10 to produce "40" is fabrication, not a fact. correct_answer must be the fact itself, stated exactly as it exists in the real world -- never a value produced by doing arithmetic on a real fact, and never the already-extracted single digit itself (that extraction belongs only in extraction_note, describing how the coordinate digit was derived from correct_answer -- never something the question asks the player to compute). If no genuine, unmodified fact among the approved films naturally contains ${required_digit}, choose a different film from the list instead of fabricating one to force a match.
${genreInstruction}${excludeConstraint}
Your extraction_note MUST explain precisely how to get the digit ${required_digit} from correct_answer (e.g. "The tens digit of 88 is 8", "The last digit of 13 is 3", "The hundreds digit of 1994 is 9").

If the question describes a calculation (e.g. subtracting, adding, or combining numbers or facts), extraction_note must show the actual calculation using the specific numbers/facts referenced in question_text, ending in the final digit -- not just assert the answer. Example of a VALID note: "Quota is 6, minus 10 fingers, plus 12 floors = 8, take the units digit." An INVALID note merely states the answer without deriving it from the question's own numbers, e.g. "The answer is 8, satisfying the requirement" -- this must never be produced.

${hasGenreConstraint ? 'Tie the question thematically to the location name only if doing so does not conflict with the constraint above — the film/genre constraint always takes priority.' : 'Tie the question thematically to the location name if a sensible connection exists; otherwise write a strong film trivia question of the right difficulty.'}

Do not include any reasoning or thinking before the JSON. Return ONLY the JSON object, nothing else. The correct_answer field must contain ONLY the final integer — no reasoning, no working, no intermediate attempts, no explanation. Just the number itself. extraction_note and question_text must also be completely free of reasoning, self-correction, or alternate attempts. Do not write "wait", "but", "actually", "let me reconsider", "correcting", or show any alternate digit-checking process. If your first idea doesn't satisfy the digit constraint, work it out silently and only output the final, clean, correct version. Never let the reader see you checking or changing your answer. This applies to every field, not just the digit check: if you reconsider which fact or film to use partway through, that reconsidering must never appear anywhere in question_text, extraction_note, or hint_text. Write only your single, final, clean question — never a first attempt, a correction, or a "let's go with" pivot.

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
  }

  // Up to 5 attempts total (raised from 3 -- only meaningful now that
  // retry feedback and film exclusion between attempts make each retry a
  // genuinely different attempt rather than a repeated identical roll).
  // A generation that fails its own stated constraints (clean fields,
  // digit actually present) is a failed attempt, not a saveable puzzle --
  // retry rather than pass it through.
  const MAX_ATTEMPTS = 5;

  let lastFailureReason = 'unknown';
  const attemptedTitles: string[] = [];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const prompt = buildPrompt(attempt, lastFailureReason, attemptedTitles);

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

    // Record the attempted title (if any) BEFORE any validation below, so
    // a subsequent retry excludes it from the presented list and can name
    // it in the retry-feedback text -- regardless of which check below
    // ends up rejecting this attempt.
    if (typeof parsed.movie_title === 'string' && parsed.movie_title.trim()) {
      attemptedTitles.push(parsed.movie_title.trim());
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

    // ANSWER-IN-TITLE: a question whose own movie_title states
    // correct_answer is answerable without having seen the film -- e.g.
    // "21 Jump Street" asked for the street number 21, "The 40-Year-Old
    // Virgin" asked the character's age, 40. This WILL also reject some
    // legitimate questions (e.g. "Ocean's Eleven" asking a crew count of
    // 11) -- that's accepted, not a bug: a title containing its own
    // answer is exactly the failure mode this gate exists to prevent,
    // regardless of whether the coincidence is "fair" in a given case.
    const titleNumbers = extractNumbers(String(parsed.movie_title ?? ''));
    if (titleNumbers.has(correctAnswer)) {
      lastFailureReason = `correct_answer (${correctAnswer}) appears directly in movie_title "${parsed.movie_title}" -- answerable without seeing the film`;
      continue;
    }

    const extractionNote = String(parsed.extraction_note ?? '');
    const questionText   = String(parsed.question_text ?? '');
    const hintText       = String(parsed.hint_text ?? '');

    // ANSWER-IN-QUESTION: broader than a multiple-choice pattern
    // specifically ("What is the street number -- 14, 55, or 8?") --
    // any literal occurrence of correct_answer in question_text hands
    // the player the answer, whether phrased as options or stated
    // outright. A real multiple-choice question is a strict subset of
    // this (it must list the correct answer among its options to be a
    // valid question at all), so this one check covers both without a
    // separate phrasing-pattern gate. Accepted tradeoff: a legitimate
    // calculation question ("Quota is 6, minus 10 fingers, plus 12
    // floors = 8") states its INPUT numbers in question_text -- this
    // only rejects if the final answer itself coincidentally restates
    // one of those inputs, which should be rare but isn't impossible.
    if (containsExactNumber(questionText, correctAnswer)) {
      lastFailureReason = `question_text contains the literal correct_answer (${correctAnswer}) -- answerable without deriving it`;
      continue;
    }

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

    // Cheap phrasing-list check before the expensive verification calls --
    // catches the same real leak this file was built to prevent elsewhere
    // (a question narrating "No -- let's go with a cleaner fact... Actually,
    // clean question:...") without needing a second API round-trip when the
    // phrasing is already a known pattern. See SELF_CORRECTION_MARKERS above
    // for why "actually"/"wait" are punctuation-anchored, not bare words.
    const questionCorrection = findSelfCorrectionMarker(questionText);
    const hintCorrection = findSelfCorrectionMarker(hintText);
    if (questionCorrection || hintCorrection) {
      const field = questionCorrection ? 'question_text' : 'hint_text';
      const marker = questionCorrection ?? hintCorrection;
      lastFailureReason = `${field} contains a self-correction marker: "${marker}"`;
      continue;
    }

    // Independent verification pass -- the last gate, run only once every
    // other check has already passed. Two separate API calls given just
    // the finished text (see verifyFactualAccuracy/verifyTextHygiene above
    // for why this is stronger than a regex, and why it's two focused
    // calls rather than one call juggling five judgments at once). Fails
    // closed: either call erroring is treated as a rejection, not a
    // pass-through.
    const factualCheck = await verifyFactualAccuracy(
      questionText,
      extractionNote,
      String(parsed.movie_title ?? ''),
      correctAnswer
    );
    if (!factualCheck) {
      lastFailureReason = 'Factual verification pass failed (network error or unparseable response)';
      continue;
    }
    if (factualCheck.topicMismatch || factualCheck.contrivedAnswer || factualCheck.nonDiegeticFact) {
      const reasons = [
        factualCheck.topicMismatch ? 'topic mismatch' : null,
        factualCheck.contrivedAnswer ? 'contrived/fabricated answer' : null,
        factualCheck.nonDiegeticFact ? 'non-diegetic (production/marketing) fact' : null,
      ].filter(Boolean).join(' and ');
      lastFailureReason = `Factual verification rejected (${reasons}): ${factualCheck.evidence || 'no evidence quoted'}`;
      continue;
    }

    const hygieneCheck = await verifyTextHygiene(questionText, extractionNote, hintText);
    if (!hygieneCheck) {
      lastFailureReason = 'Text-hygiene verification pass failed (network error or unparseable response)';
      continue;
    }
    if (hygieneCheck.hedgingFound) {
      lastFailureReason = `Text-hygiene verification rejected (hedging/self-correction): ${hygieneCheck.evidence || 'no evidence quoted'}`;
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
