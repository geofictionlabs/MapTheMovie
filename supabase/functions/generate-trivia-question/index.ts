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
      return 'Use a fact anyone who has seen the film once would already know without trying to recall it -- something the story itself puts front and center: a number central to the plot\'s own premise, a detail repeated more than once, the headline fact the film is known for. Crucially, this still requires having SEEN the film, not merely knowing OF it -- someone who has only heard of the film, or knows its title and premise secondhand, should not be able to answer. Example: Booksmart\'s answer of 8 (hours the two friends have left) passes this test -- you have to have watched the film to know it. A fact like "how old is the 40-Year-Old Virgin" fails it -- the title alone gives away the answer, no viewing required. No wordplay, no obscure angle -- if it takes any real thought to recall, it\'s not casual.';
    case 'classic':
      return 'Use a fact a regular fan would know but a one-time, inattentive viewer would likely have missed or forgotten -- something the film states clearly, but doesn\'t repeat or foreground the way a casual-tier fact would; it takes either paying attention the first time or having seen the film more than once. Example: Dodgeball\'s answer of 50000 (the tournament\'s prize money) is stated plainly in the film and matters to the plot, but isn\'t hammered home the way a casual-tier number would be -- you have to have been listening.';
    case 'expert':
      return 'Use a fact only a genuine fan would know -- someone who watched closely or rewatched -- that a one-time viewer would not retain even if they enjoyed the film. Obscurity must come from WITHIN the story itself: a detail visible or audible on screen that a casual viewer wouldn\'t register, something stated once in passing and never repeated, a background number a camera happens to catch. Do NOT reach for behind-the-scenes detail, production trivia, or how the film was made, shot, or marketed -- this pool explicitly rejects any fact a viewer could only know from reading about the film rather than watching it, no matter how obscure or fan-only that production fact might be. Example: Coming to America\'s answer of 1003 (a background building/address number) fits -- a fan who watched closely would know it, a one-time viewer almost certainly would not, and it\'s something the film itself shows, not something reported about the film afterward.';
    case 'cipher':
      return 'Write a cryptic, puzzle-like clue requiring decoding or wordplay. The clue must obscure the underlying FACT, not just the phrasing -- do not name iconic, instantly-identifying specifics (e.g. a famous number, an exact character name, a signature object) directly, even in flowery language. A solver who knows the film should still have to actually decode the clue, not just recognise familiar details dressed up poetically. This means choosing a fact that isn\'t instantly recognisable even once decoded -- it does NOT mean inventing or distorting the fact itself. The CLUE is what gets obscured; the FACT never is. There must be a real, stated number the film actually contains -- a count, an age, a time, a quantity, a year spoken aloud -- that the clue points to obliquely; decoding the clue should lead a solver to a fact the film genuinely states, not one the riddle itself manufactures. An answer that only exists as the solution to the puzzle -- a count of something the film says is absent or doesn\'t exist, a number arrived at by interpreting a scene rather than one the film actually states -- is a fabrication no matter how well-written the clue is. (A real failure: a Pete\'s Dragon clue answered 0, reasoning that the villagers don\'t believe dragons exist -- clever phrasing, but 0 is not a number the film ever states; it\'s an interpretation invented to answer the riddle, not a fact extracted from it.)';
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
// round-trip to catch. "actually,"/"wait," are punctuation-anchored
// (comma-adjacent only) AND require a self-correction continuation right
// after (addressing the model's own drafting process -- "actually, let
// me", "wait, no") rather than matching bare "wait,"/"actually," anywhere
// in prose. A real false positive: a Ghostbusters question (answer 5000)
// rejected because ordinary prose happened to contain "wait," as a plain
// clause break, not self-correction -- ordinary content routinely puts a
// comma after either word ("the wait staff", "Actually, this detail is
// often overlooked") without it meaning anything. The continuation
// requirement narrows this to the actual leak pattern without losing
// recall on every real leak seen so far -- each of those also matches one
// of the other, more specific markers below (clean restart / let's go
// with / etc.), confirmed before narrowing these two. This list is
// inherently incomplete (same limitation this file's own comment already
// notes about the earlier, now-replaced SELF_CORRECTION_PATTERN regex) --
// novel phrasing this list doesn't anticipate is verifyTextHygiene's job,
// not this gate's.
const SELF_CORRECTION_MARKERS = [
  /,\s*actually\b/i,
  /\bactually,\s*(?:wait|let me|no|that's|i should|hold on)\b/i,
  /\bwait,\s*(?:actually|let me|no|that's|i should|hold on)\b/i,
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

// Mirrors the SQL formula used by promote_question_to_pool and
// promote_bulk_question_to_pool: ARRAY(SELECT DISTINCT unnest(string_to_
// array(abs(x)::text, NULL))::int ORDER BY 1). Display-only here -- the
// RPC recomputes this itself, server-side, at actual insert time; this
// copy is never trusted for anything but showing the review UI which
// digits a candidate would cover.
function computeAvailableDigits(value: number): number[] {
  const digits = new Set(Math.abs(value).toString().split('').map((d) => parseInt(d, 10)));
  return Array.from(digits).sort((a, b) => a - b);
}

// Shared JSON-extraction logic -- used by both generation modes below and
// by both verification calls further down. Finds the first "{" (stripping
// any leading prose/reasoning before it -- the model reasons before
// answering, so real JSON is often preceded by explanatory text) and
// walks forward from there, tracking brace depth while respecting string
// literals and escape sequences (so a brace inside a quoted string, e.g.
// inside question_text, never miscounts), to find that opening brace's
// actual matching close. Replaces a lastIndexOf('{')/lastIndexOf('}')
// heuristic that only worked for a single flat object: for a NESTED
// response (an object containing an array of objects, e.g. batch mode's
// {"questions": [...]} wrapper), the last "{" belongs to the final inner
// object and the last "}" belongs to the outer wrapper -- sliced
// together, that's an unbalanced fragment that never parses.
// Depth-tracking handles arbitrary nesting and still strips leading
// preamble, which is the actual thing the old heuristic was reaching for.
// Single-question mode's flat-object response also parses correctly
// under this (a single top-level "{" with no nested "{" inside, since
// other_films_mentioned is an array, not an object, so depth simply
// reaches 0 at that object's own closing brace).
function extractLastJsonObject(text: string): any | null {
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }

  return null; // never closed -- truncated (see stop_reason check at the batch call site) or genuinely malformed
}

type VerifierCallResult = { ok: true; data: any } | { ok: false; reason: string };

// One attempt at the verifier call -- separated from callVerifier itself so
// the retry below is a second, independent attempt rather than a loop
// wrapped around shared mutable state. Distinguishes the two ways this can
// fail (HTTP-level vs unparseable JSON) instead of collapsing both into a
// bare null -- a rejection reason quoting the actual status/body or the
// actual unparseable text is directly actionable; "network error or
// unparseable response" told you nothing about which one happened or why.
async function attemptVerifierCall(prompt: string): Promise<VerifierCallResult> {
  let response: Response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
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
  } catch (err) {
    return { ok: false, reason: `verifier request threw: ${err instanceof Error ? err.message : String(err)}` };
  }

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '(could not read response body)');
    return { ok: false, reason: `verifier HTTP ${response.status}: ${bodyText.slice(0, 300)}` };
  }

  const data = await response.json();
  const text = (data.content as any[]).map((b: any) => b.text || '').join('\n');
  const parsed = extractLastJsonObject(text);
  if (!parsed) {
    return { ok: false, reason: `verifier response did not contain a parseable JSON object (last 300 chars): "${text.slice(-300)}"` };
  }
  return { ok: true, data: parsed };
}

// One retry, specifically for the verifier call -- failing closed (which
// this file does deliberately everywhere else) means a bare network blip
// here discards an otherwise-good, already-fully-validated candidate. A
// single retry catches the transient case without weakening the fail-
// closed discipline for a genuinely broken verifier (two failures in a
// row still rejects, with the second attempt's reason reported).
async function callVerifier(prompt: string): Promise<VerifierCallResult> {
  const first = await attemptVerifierCall(prompt);
  if (first.ok) return first;
  return await attemptVerifierCall(prompt);
}

// Call A: factual/provenance judgment -- does correct_answer genuinely mean
// what the question claims. Given movieTitle and correctAnswer explicitly
// (not inferred from prose) because checks (4)/(5) below are meaningless
// without knowing exactly which film and which number are in play. Split
// out from the former single verifyQuestion call (see Call B below) so
// this factual judgment doesn't compete for attention with the separate
// text-hygiene judgment in one response -- five simultaneous checks in one
// call risked each getting less scrutiny than a focused two-call split.
// Returns a { failureReason } object on failure (network error, non-JSON
// response, one retry already attempted inside callVerifier) -- treated
// as a rejection by the caller: fail closed, never pass an unverified
// question through because verification itself broke. failureReason
// carries the actual HTTP status/body or unparseable text, not a generic
// message, so a rejection like this is distinguishable from a genuine
// content rejection and actionable on its own.
async function verifyFactualAccuracy(
  questionText: string,
  extractionNote: string,
  movieTitle: string,
  correctAnswer: number
): Promise<
  | { topicMismatch: boolean; contrivedAnswer: boolean; nonDiegeticFact: boolean; evidence: string }
  | { failureReason: string }
> {
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

  const result = await callVerifier(factualPrompt);
  if (!result.ok) return { failureReason: result.reason };
  const parsed = result.data;
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
// Fails closed the same way as Call A -- see verifyFactualAccuracy's
// comment for why failure returns { failureReason } rather than null.
async function verifyTextHygiene(
  questionText: string,
  extractionNote: string,
  hintText: string
): Promise<{ hedgingFound: boolean; evidence: string } | { failureReason: string }> {
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

  const result = await callVerifier(hygienePrompt);
  if (!result.ok) return { failureReason: result.reason };
  const parsed = result.data;
  return {
    hedgingFound: parsed.hedging_found === true,
    evidence: String(parsed.evidence ?? ''),
  };
}

// Builds the batch-mode generation prompt: no digit framing at all (that's
// the whole point -- see handleBatchMode below), asking instead for N
// genuinely distinct real facts across N different approved films, with
// an explicit push toward varied fact KINDS (not just varied films) and a
// preference for multi-digit answers. filmSection is buildFilmSection from
// the enclosing request handler, called with existingTitles -- films
// already banked in trivia_pool for this genre+difficulty -- as the
// exclusion list, same role exclude_movies plays for single-question mode.
// Without this, every batch got an empty exclusion list and the model kept
// re-proposing the same handful of iconic titles regardless of the rest of
// the allowlist; buildFilmSection's own existing safety net (present the
// full list if every title is excluded) is unchanged and still applies.
// The prompt text itself also now states the breadth goal explicitly (this
// batch is one contribution to an ongoing pool, not a self-contained set)
// and pushes back on the specific bias that caused the clustering in the
// first place -- asking for a "numeric fact" naturally pulls toward films
// where a number IS the famous thing (Spinal Tap's eleven, Home Alone's
// address, a quoted price), so the prompt now says most films have SOME
// usable number even without one being iconic.
function buildBatchPrompt(
  count: number,
  tier: string,
  existingTitles: string[],
  preferredDigits: number[],
  filmSection: (attemptedTitles: string[]) => { instruction: string; hasConstraint: boolean }
): string {
  const { instruction: genreInstruction } = filmSection(existingTitles);

  // Soft preference only -- deliberately never a validation gate. Single-
  // question mode's HARD digit requirement is what caused the contrived-
  // arithmetic fabrication problem (platform 9¾ written as "934", a
  // school year of 4 multiplied by 10 to give "40" -- see the digit-as-
  // filter prompt reframing and verifyFactualAccuracy's contrived-answer
  // check elsewhere in this file). Batch mode must not reintroduce that
  // pressure, so this is worded as a preference among genuine facts, with
  // an explicit repeat of the anti-fabrication rule right where the
  // preference is stated, and no code anywhere checks whether a survivor
  // actually contains one of these digits. Omitted entirely when there's
  // nothing meaningful to say: an empty list (nothing missing) or all 10
  // digits (an empty pool, where "prefer any of these 10" is a no-op
  // dressed as guidance) both carry zero real signal.
  const digitPreference = preferredDigits.length > 0 && preferredDigits.length < 10
    ? `\nThe pool currently lacks facts whose answers contain the digit(s) ${preferredDigits.join(', ')}. Where a genuine, unmodified fact naturally contains one of these, favour it -- but ONLY where such a fact genuinely exists. Never transform, pad, or reformat a fact to produce a preferred digit, and never skip a good question because its answer lacks one. Questions without a preferred digit are still wanted.\n`
    : '';

  return `Generate ${count} DISTINCT movie trivia questions for a treasure-hunt trivia pool. Each question must be about a different approved film -- do not repeat a film across this batch. This batch is one contribution to a larger, ongoing pool for this genre and difficulty, not a self-contained set -- the actual goal is breadth across the full approved list over many batches, not just variety within these ${count} questions. Films already well-represented in the pool have already been excluded from the list below; among what remains, favour titles you would not otherwise reach for first, rather than defaulting to the same few most iconic ones whenever several approved films would work equally well.

Don't limit yourself to films whose number is already a famous, oft-quoted detail (an amplifier that goes to eleven, a suite number in a film's own title, a specific price). Most approved films contain a genuinely usable number somewhere even without one being iconic -- a count of characters or objects, a quantity mentioned once, a street or room number, a running time or countdown, an age stated in dialogue. Look for one of these before assuming a film has nothing to offer.
Difficulty tier: ${tier}
Guidance: ${tierGuidance(tier)}

Beyond varying the films, vary the KIND of numeric fact across the batch -- do not let every question be a street number, room number, address, or age (that pattern is over-represented already). Films are full of other rich material: a count of objects or characters, how many times an event repeats in the story, a quantity of something acquired or needed, a score or ranking, a countdown or time limit, a year spoken aloud in dialogue, a distance, a speed, an amount of money. Aim for a genuine mix of these categories across the batch, not a single repeated pattern. Prefer facts with multi-digit answers (3-4 digits) where a genuine, real fact naturally has that many digits -- a single well-chosen multi-digit fact covers as many future coordinate slots as 3-4 separate single-digit questions would, so it's worth deliberately favoring over an equally-valid 1-2 digit fact when both are genuinely true.

Each fact must be a genuine, independently-verifiable fact from the film -- something true regardless of this task, that a fan would already know or could look up. Never invent, transform, multiply, recompute, or reformat a real fact to produce a different number. correct_answer must be the fact itself, stated exactly as it exists in the real world.
${digitPreference}${genreInstruction}
Your extraction_note for each question must clearly document the real fact behind correct_answer (e.g. "The tens digit of 88 is 8" style phrasing is fine, but is no longer required to target any specific digit -- just document the real fact clearly and correctly).

Do not include any reasoning or thinking before the JSON. Return ONLY the JSON object, nothing else. Each correct_answer field must contain ONLY the final integer -- no reasoning, no working, no explanation. question_text, extraction_note, and hint_text must be completely free of reasoning, self-correction, or alternate attempts -- never "wait", "actually", "let's go with", or any visible sign you reconsidered mid-question.

Each question must be about exactly one film: movie_title. Before finalising each question, check its question_text, extraction_note, and hint_text for any OTHER film title mentioned -- list every such title in that question's other_films_mentioned. This must be an empty array unless the question deliberately and coherently discusses two named films (rare).

For each question, also classify the kind of numeric fact using fact_category: one of "count", "quantity", "score", "countdown", "year", "distance", "speed", "money", "age", "address_or_room_or_platform", "other".

Return ONLY valid JSON with no markdown fences and no preamble:
{
  "questions": [
    {
      "question_text": "...",
      "movie_title": "...",
      "movie_year": 1985,
      "movie_emoji": "...",
      "correct_answer": 88,
      "extraction_note": "...",
      "hint_text": "...",
      "other_films_mentioned": [],
      "fact_category": "count"
    }
  ]
}`;
}

// Runs `fn` over `items` with at most `limit` in flight at once, preserving
// each result at its original index. No external dependency -- a simple
// worker-pool: each worker pulls the next unclaimed index until none
// remain. Used to bound the concurrent Anthropic verification calls in
// batch mode (see handleBatchMode below) so a 10-candidate batch's ~20
// sequential verifier calls (the actual cause of batches hitting
// Supabase's 150s wall-clock limit) don't have to run one at a time,
// without firing all of them at once and risking rate limits.
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const i = nextIndex++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

// Batch mode: one Anthropic call generates up to `count` candidate
// questions with no required_digit at all -- which digits each survivor
// covers is computed afterward (computeAvailableDigits), never demanded
// upfront. Every existing per-question gate still runs, EXCEPT the
// digit-inclusion check (nothing to check it against). No per-question
// retry-with-feedback (that's what single mode does) -- a candidate
// either passes every gate or it's reported in `rejected` with a reason;
// the caller decides what to do about a partial batch. The only retry
// here is a small outer one (BATCH_MAX_ATTEMPTS) for the case where the
// ENTIRE call fails outright -- network error, or the top-level JSON
// never parses at all -- since a single transient failure shouldn't
// waste the whole admin request.
//
// Deterministic gates (allowlist, format, answer-in-title, answer-in-
// question, other-films, calculation-derivation, self-correction, dedup)
// run sequentially, in candidate order, exactly as before -- dedup via
// seenPairs is order-dependent (each surviving candidate claims its fact
// immediately, so a later duplicate in the same batch is caught). Only
// the two verifier API calls per candidate -- independent of every other
// candidate -- run concurrently afterward, capped at
// VERIFICATION_CONCURRENCY so a full batch doesn't run ~20 sequential
// ~5-7s Anthropic calls and exceed the wall-clock limit, without firing
// all of them at once and risking rate limits. The two calls WITHIN one
// candidate (factual, then hygiene) stay sequential rather than also
// parallelised against each other -- at a concurrency of 5, a 10-candidate
// batch is already comfortably under the limit (2 rounds x ~14s), and
// doubling the simultaneous request count to shave off the remaining
// time wasn't worth the added rate-limit exposure.
async function handleBatchMode(
  supabase: any,
  genre: string,
  tier: string,
  rawCount: unknown,
  rawPreferredDigits: unknown,
  buildFilmSectionFn: (attemptedTitles: string[]) => { instruction: string; hasConstraint: boolean }
): Promise<Response> {
  const count = Number.isInteger(rawCount) && (rawCount as number) > 0 ? (rawCount as number) : 10;
  const BATCH_MAX_ATTEMPTS = 2;

  // Sanitised, never trusted as-is -- client-supplied, soft preference
  // only (see buildBatchPrompt's own comment on why this must never
  // become a validation gate). Anything not a clean 0-9 integer is
  // dropped rather than passed through.
  const preferredDigits: number[] = Array.isArray(rawPreferredDigits)
    ? rawPreferredDigits.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 9)
    : [];

  // trivia_pool.difficulty is capped at 3 (see CommandCenter.jsx's
  // TIER_TO_INT comment -- there's no question-level "4", only a
  // puzzle-level one). Mirrored here rather than imported since this is a
  // separate Deno runtime from the client app; same fallback (|| 2) and
  // cap as fetchQuestionFor/the Question Pool tab use.
  const difficulty = Math.min({ casual: 1, classic: 2, expert: 3, cipher: 4 }[tier] || 2, 3);

  // Existing trivia_pool rows for this genre+difficulty, fetched BEFORE
  // generation this time, not just after for post-hoc dedup -- also
  // feeds buildBatchPrompt's film-exclusion list below. Without this, the
  // prompt was built with an empty exclusion list every batch (unlike
  // single-question mode, which excludes other waypoints' films via
  // exclude_movies), so the model had no way to know which films were
  // already well-represented in the pool and kept gravitating to the
  // same handful of iconic titles (Home Alone, Spinal Tap, Ghostbusters,
  // Ferris Bueller, The Hangover) regardless of what the rest of a
  // 50-title allowlist actually offers. Fetched via the service-role
  // client already in scope (bypasses RLS, same client used for the
  // auth/admin checks above it). Authoritative, live state -- not a
  // client-supplied list that could be stale.
  const { data: existingPoolRows } = await supabase
    .from('trivia_pool')
    .select('movie_title, correct_answer')
    .eq('genre', genre)
    .eq('difficulty', difficulty);

  const existingTitles = (existingPoolRows ?? []).map((r: any) => String(r.movie_title));

  const seenPairs = new Set(
    (existingPoolRows ?? []).map((r: any) => `${String(r.movie_title).trim().toLowerCase()}::${r.correct_answer}::${difficulty}`)
  );

  let batchFailureReason = 'unknown';
  let candidates: any[] | null = null;

  for (let attempt = 1; attempt <= BATCH_MAX_ATTEMPTS; attempt++) {
    const prompt = buildBatchPrompt(count, tier, existingTitles, preferredDigits, buildFilmSectionFn);

    // 900/question (raised from 600 -- see comment below on why 600 was
    // suspect, not confirmed insufficient). Not empirically verified
    // against a real successful batch run (batch mode has not yet
    // completed end to end) -- if this is still too low, the stop_reason
    // check right below will now say so explicitly instead of presenting
    // as an identical, unexplained "malformed response" failure.
    const maxTokens = 900 * count;

    const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!aiResponse.ok) {
      batchFailureReason = `AI request failed: ${await aiResponse.text()}`;
      continue;
    }

    const aiData = await aiResponse.json();
    const text = (aiData.content as any[]).map((b) => b.text || '').join('\n');
    const obj = extractLastJsonObject(text);

    if (!obj || !Array.isArray(obj.questions)) {
      // Anthropic sets stop_reason: 'max_tokens' when a response is cut
      // off by the token budget, distinct from the model genuinely
      // finishing (stop_reason: 'end_turn') with malformed output. Without
      // this check, a truncated response (mid-JSON, so extractLastJsonObject
      // correctly fails to find a balanced object) presents identically to
      // a genuinely malformed one -- this distinguishes them using the
      // authoritative signal instead of guessing from the text alone.
      batchFailureReason = aiData.stop_reason === 'max_tokens'
        ? `Response truncated at max_tokens (${maxTokens} tokens for ${count} questions) before a complete JSON object could be parsed -- raise max_tokens or reduce count`
        : 'Could not locate a valid questions array in the AI response';
      continue;
    }

    candidates = obj.questions;
    break;
  }

  if (!candidates) {
    return new Response(
      JSON.stringify({ error: `Batch generation failed after ${BATCH_MAX_ATTEMPTS} attempts`, lastFailureReason: batchFailureReason }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // handleBatchMode is a top-level function, not a closure inside
  // Deno.serve -- recomputed locally rather than reused from the request
  // handler's own copy, which is out of scope here.
  const allowlistFilms = GENRE_FILM_ALLOWLIST[genre];

  const survivors: any[] = [];
  const rejected: any[] = [];

  // Phase 1 -- deterministic gates only, sequential, in candidate order.
  // Candidates that pass are queued for verification (Phase 2, concurrent)
  // rather than verified inline here.
  type PendingVerification = {
    q: any;
    correctAnswer: number;
    questionText: string;
    extractionNote: string;
    hintText: string;
  };
  const pendingVerification: PendingVerification[] = [];

  for (const q of candidates) {
    const reject = (reason: string) => rejected.push({ ...q, rejection_reason: reason });

    if (allowlistFilms && allowlistFilms.length > 0) {
      const normalizedTitle = String(q?.movie_title ?? '').trim().toLowerCase();
      const isAllowed = allowlistFilms.some((f) => f.trim().toLowerCase() === normalizedTitle);
      if (!isAllowed) {
        reject(`movie_title "${q?.movie_title}" is not in the approved ${genre} allowlist`);
        continue;
      }
    }

    const rawAnswer = String(q?.correct_answer ?? '').trim();
    if (!/^\d+$/.test(rawAnswer)) {
      reject(`correct_answer was not a clean integer: "${rawAnswer}"`);
      continue;
    }
    const correctAnswer = parseInt(rawAnswer, 10);

    const titleNumbers = extractNumbers(String(q?.movie_title ?? ''));
    if (titleNumbers.has(correctAnswer)) {
      reject(`correct_answer (${correctAnswer}) appears directly in movie_title "${q?.movie_title}" -- answerable without seeing the film`);
      continue;
    }

    const extractionNote = String(q?.extraction_note ?? '');
    const questionText = String(q?.question_text ?? '');
    const hintText = String(q?.hint_text ?? '');

    if (containsExactNumber(questionText, correctAnswer)) {
      reject(`question_text contains the literal correct_answer (${correctAnswer}) -- answerable without deriving it`);
      continue;
    }

    const otherFilms = Array.isArray(q?.other_films_mentioned)
      ? q.other_films_mentioned.filter((f: unknown) => typeof f === 'string' && f.trim())
      : [];
    if (otherFilms.length > 0) {
      reject(`question referenced other film title(s) besides movie_title: ${otherFilms.join(', ')}`);
      continue;
    }

    if (impliesCalculation(questionText) && !hasDerivationSignal(extractionNote)) {
      reject('question_text implies a calculation but extraction_note does not show a derivation');
      continue;
    }

    const questionCorrection = findSelfCorrectionMarker(questionText);
    const hintCorrection = findSelfCorrectionMarker(hintText);
    if (questionCorrection || hintCorrection) {
      const field = questionCorrection ? 'question_text' : 'hint_text';
      const marker = questionCorrection ?? hintCorrection;
      reject(`${field} contains a self-correction marker: "${marker}"`);
      continue;
    }

    // Duplicate check (batch-specific): rejects a candidate matching an
    // existing trivia_pool row for this genre+difficulty on BOTH
    // movie_title and correct_answer, and also matching an earlier
    // candidate that already claimed this fact in this same batch.
    // difficulty is included in the key explicitly (not just relied on
    // via the query scoping above) so this stays correct if this function
    // is ever called for more than one difficulty at a time.
    const pairKey = `${String(q?.movie_title ?? '').trim().toLowerCase()}::${correctAnswer}::${difficulty}`;
    if (seenPairs.has(pairKey)) {
      reject(`duplicate: movie_title "${q?.movie_title}" with correct_answer ${correctAnswer} already exists in trivia_pool for genre "${genre}" at this difficulty (or earlier in this batch)`);
      continue;
    }

    // Claimed here, before verification, not after -- required for
    // correctness now that verification (Phase 2) runs concurrently and
    // can no longer be relied on to resolve in candidate order. Real
    // consequence, flagged rather than silently accepted: a candidate
    // that clears the deterministic gates but later fails verification
    // still "used up" this fact -- a later duplicate in the same batch
    // will be rejected as a duplicate rather than getting its own
    // independent shot at verification, which is what happened before
    // this change.
    seenPairs.add(pairKey);
    pendingVerification.push({ q, correctAnswer, questionText, extractionNote, hintText });
  }

  // Phase 2 -- the two verifier calls per candidate are independent of
  // every other candidate, so this is the part that actually parallelises.
  // Capped rather than firing all of them at once (see VERIFICATION_CONCURRENCY
  // comment on handleBatchMode above).
  const VERIFICATION_CONCURRENCY = 5;

  const verificationResults = await mapWithConcurrency(
    pendingVerification,
    VERIFICATION_CONCURRENCY,
    async (item) => {
      const factualCheck = await verifyFactualAccuracy(
        item.questionText,
        item.extractionNote,
        String(item.q?.movie_title ?? ''),
        item.correctAnswer
      );
      if ('failureReason' in factualCheck) {
        return { item, rejectionReason: `Factual verification pass failed: ${factualCheck.failureReason}` };
      }
      if (factualCheck.topicMismatch || factualCheck.contrivedAnswer || factualCheck.nonDiegeticFact) {
        const reasons = [
          factualCheck.topicMismatch ? 'topic mismatch' : null,
          factualCheck.contrivedAnswer ? 'contrived/fabricated answer' : null,
          factualCheck.nonDiegeticFact ? 'non-diegetic (production/marketing) fact' : null,
        ].filter(Boolean).join(' and ');
        return { item, rejectionReason: `Factual verification rejected (${reasons}): ${factualCheck.evidence || 'no evidence quoted'}` };
      }

      const hygieneCheck = await verifyTextHygiene(item.questionText, item.extractionNote, item.hintText);
      if ('failureReason' in hygieneCheck) {
        return { item, rejectionReason: `Text-hygiene verification pass failed: ${hygieneCheck.failureReason}` };
      }
      if (hygieneCheck.hedgingFound) {
        return { item, rejectionReason: `Text-hygiene verification rejected (hedging/self-correction): ${hygieneCheck.evidence || 'no evidence quoted'}` };
      }

      return { item, rejectionReason: null as string | null };
    }
  );

  for (const { item, rejectionReason } of verificationResults) {
    if (rejectionReason) {
      rejected.push({ ...item.q, rejection_reason: rejectionReason });
      continue;
    }
    survivors.push({
      question_text: item.q.question_text,
      movie_title: item.q.movie_title,
      movie_year: item.q.movie_year ?? null,
      movie_emoji: item.q.movie_emoji || '🎬',
      correct_answer: item.correctAnswer,
      extraction_note: item.q.extraction_note,
      hint_text: item.q.hint_text,
      fact_category: typeof item.q?.fact_category === 'string' ? item.q.fact_category : null,
      available_digits: computeAvailableDigits(item.correctAnswer),
    });
  }

  return new Response(
    JSON.stringify({ survivors, rejected }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// ============================================================
// Classify mode (Phase 3 of the trivia quality plan) -- blind difficulty
// classification + concern-flagging for EXISTING trivia_pool rows.
//
// TWO separate AI calls per batch, not one, and this split is a hard
// data-visibility gate, not just a prompt instruction:
//   - Tier call: built from a freshly-mapped {id, question_text}-only
//     array. correct_answer, extraction_note, and current difficulty are
//     never read into the objects passed to buildTierClassifyPrompt, so
//     there is no field to accidentally interpolate -- knowing the
//     answer makes any question look easy, which is the confirmed root
//     cause of both the generator's own self-assessment and a prior
//     manual review failing the same way.
//   - Concerns call: built from {id, question_text, correct_answer,
//     extraction_note}. Two of the five concern types
//     (question_answer_mismatch, unverifiable) are structurally
//     undetectable without seeing the answer, so this call gets full
//     context. The other three (ambiguous_input, contested_count,
//     approximation) are properties of the question's own phrasing and
//     would work blind too, but there's no benefit to a third call just
//     to keep them separate from the two that need full context.
// Both calls run concurrently and are merged by id afterward -- never
// trust response order, always correlate by the id echoed back.
// ============================================================

const MAX_CLASSIFY_BATCH = 25;

const VALID_TIERS = ['casual', 'classic', 'expert'] as const;
type ProposedTier = typeof VALID_TIERS[number];

const VALID_CONCERNS = [
  'ambiguous_input',
  'contested_count',
  'question_answer_mismatch',
  'approximation',
  'unverifiable',
] as const;
type Concern = typeof VALID_CONCERNS[number];

type ClassifyBlindItem = { id: string; question_text: string };
type ClassifyFullItem = ClassifyBlindItem & { correct_answer: number; extraction_note: string };

// Deliberately typed to accept ONLY {id, question_text} -- see file
// header. The prompt built here only ever interpolates question_text.
function buildTierClassifyPrompt(items: ClassifyBlindItem[]): string {
  const list = items.map((it, i) => `${i + 1}. [id: ${it.id}] ${it.question_text}`).join('\n');

  return `You are classifying the difficulty of movie trivia questions for a treasure-hunt game. You are given ONLY the question text -- not the correct answer, not any existing difficulty label. Judge purely on what the question asks and how it is phrased, never on how easy the real answer would be to guess if you already knew it.

For each question, ask: "Someone who has watched this film once, and enjoyed it, but hasn't thought about it since. Would they know this?"

- casual: yes, immediately, without effort. The number is one the film is KNOWN for, or is structural to the plot (how many in the Fellowship, how many days you have left, how fast the car must go).
- classic: they'd need to have paid attention the first time, or seen it more than once. The film states it clearly but doesn't hang on it.
- expert: only a genuine fan who watched closely or rewatched would retain it. Stated once in passing, or visible on screen without being drawn attention to.

THE KEY HEURISTIC -- this predicts the split better than anything else: is this a number the film is KNOWN for, or a number that merely APPEARS in it?
- Known for -> casual. 88mph. Seven days. Say it three times. Nine walkers.
- Appears in -> classic or expert. A taxi number. A house address. A count of accident reports. An age derived from a timeline.

Addresses, room numbers, and incidental counts are almost never casual, however famous the film. Plot-structural counts usually are.

Questions:
${list}

Return ONLY valid JSON, no markdown fences, no preamble:
{
  "classifications": [
    { "id": "...", "proposed_tier": "casual" }
  ]
}
Include exactly one entry per question listed above, each with its id copied back exactly, and proposed_tier one of "casual", "classic", "expert".`;
}

function buildConcernsClassifyPrompt(items: ClassifyFullItem[]): string {
  const list = items.map((it, i) =>
    `${i + 1}. [id: ${it.id}]\n   question_text: "${it.question_text}"\n   correct_answer: ${it.correct_answer}\n   extraction_note: "${it.extraction_note || '(none provided)'}"`
  ).join('\n');

  return `You are reviewing movie trivia questions for a treasure-hunt game, checking for structural problems independent of difficulty. For each question you are given the question text, the stored correct answer, and the extraction note documenting how that answer was derived. Flag any of the following that apply -- a question can have zero, one, or several concerns. Do not invent concern types not listed here.

- ambiguous_input: unclear what the player would type. Example: Groundhog Day's alarm reads 6:00 -- would a player enter 600, 6, or 6:00?
- contested_count: reasonable people would count differently. Examples: how many people are killed in Scream; peak group size in 28 Days Later.
- question_answer_mismatch: the question asks for one kind of thing and the answer is another. Example: Terminator 2 asks "on what DATE" and the answer is 1997, a year.
- approximation: the question or the underlying fact is hedged with approximately/roughly/about.
- unverifiable: reads like a figure derived or inferred rather than stated in the film. Example: Interstellar, Murph living to 124.

Questions:
${list}

Return ONLY valid JSON, no markdown fences, no preamble:
{
  "classifications": [
    { "id": "...", "concerns": [] }
  ]
}
Include exactly one entry per question listed above, each with its id copied back exactly, and concerns as an array containing only the exact keys listed above (empty array if none apply).`;
}

type ClassifierCallResult<T> = { ok: true; byId: Map<string, T> } | { ok: false; reason: string };

// One attempt + one retry, same discipline as callVerifier above -- fail
// closed on a genuinely broken call (two failures in a row), but a single
// transient network/parse blip doesn't discard an entire batch.
async function attemptClassifyCall(prompt: string, maxTokens: number): Promise<
  | { ok: true; parsed: any; stopReason: string }
  | { ok: false; reason: string }
> {
  let response: Response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
  } catch (err) {
    return { ok: false, reason: `classifier request threw: ${err instanceof Error ? err.message : String(err)}` };
  }

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '(could not read response body)');
    return { ok: false, reason: `classifier HTTP ${response.status}: ${bodyText.slice(0, 300)}` };
  }

  const data = await response.json();
  const text = (data.content as any[]).map((b: any) => b.text || '').join('\n');
  const parsed = extractLastJsonObject(text);
  if (!parsed || !Array.isArray(parsed.classifications)) {
    const reason = data.stop_reason === 'max_tokens'
      ? `Response truncated at max_tokens (${maxTokens}) before a complete JSON object could be parsed`
      : `classifier response did not contain a parseable classifications array (last 300 chars): "${text.slice(-300)}"`;
    return { ok: false, reason };
  }
  return { ok: true, parsed, stopReason: data.stop_reason };
}

async function callTierClassifier(items: ClassifyBlindItem[]): Promise<ClassifierCallResult<ProposedTier>> {
  if (items.length === 0) return { ok: true, byId: new Map() };
  const prompt = buildTierClassifyPrompt(items);
  const maxTokens = 60 * items.length + 200;

  let result = await attemptClassifyCall(prompt, maxTokens);
  if (!result.ok) result = await attemptClassifyCall(prompt, maxTokens);
  if (!result.ok) return { ok: false, reason: result.reason };

  const byId = new Map<string, ProposedTier>();
  for (const entry of result.parsed.classifications) {
    const id = String(entry?.id ?? '');
    const tier = String(entry?.proposed_tier ?? '');
    if (id && (VALID_TIERS as readonly string[]).includes(tier)) {
      byId.set(id, tier as ProposedTier);
    }
  }
  return { ok: true, byId };
}

async function callConcernsClassifier(items: ClassifyFullItem[]): Promise<ClassifierCallResult<Concern[]>> {
  if (items.length === 0) return { ok: true, byId: new Map() };
  const prompt = buildConcernsClassifyPrompt(items);
  const maxTokens = 100 * items.length + 200;

  let result = await attemptClassifyCall(prompt, maxTokens);
  if (!result.ok) result = await attemptClassifyCall(prompt, maxTokens);
  if (!result.ok) return { ok: false, reason: result.reason };

  const byId = new Map<string, Concern[]>();
  for (const entry of result.parsed.classifications) {
    const id = String(entry?.id ?? '');
    if (!id) continue;
    const rawConcerns = Array.isArray(entry?.concerns) ? entry.concerns : [];
    const concerns = rawConcerns.filter((c: unknown): c is Concern =>
      typeof c === 'string' && (VALID_CONCERNS as readonly string[]).includes(c)
    );
    byId.set(id, concerns);
  }
  return { ok: true, byId };
}

async function handleClassifyMode(rawQuestions: any): Promise<Response> {
  if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
    return new Response(
      JSON.stringify({ error: 'questions must be a non-empty array' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  if (rawQuestions.length > MAX_CLASSIFY_BATCH) {
    return new Response(
      JSON.stringify({ error: `questions array too large (${rawQuestions.length}) -- max ${MAX_CLASSIFY_BATCH} per call, chunk the request` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const failed: { id: string | null; reason: string }[] = [];
  const seenIds = new Set<string>();
  const validItems: ClassifyFullItem[] = [];

  for (const raw of rawQuestions) {
    const id = typeof raw?.id === 'string' ? raw.id : null;
    const questionText = typeof raw?.question_text === 'string' ? raw.question_text.trim() : '';
    const correctAnswer = raw?.correct_answer;

    if (!id) { failed.push({ id: null, reason: 'missing id' }); continue; }
    if (seenIds.has(id)) { failed.push({ id, reason: 'duplicate id in request' }); continue; }
    if (!questionText) { failed.push({ id, reason: 'missing or empty question_text' }); continue; }
    if (typeof correctAnswer !== 'number' || !Number.isFinite(correctAnswer)) {
      failed.push({ id, reason: 'missing or non-numeric correct_answer' });
      continue;
    }

    seenIds.add(id);
    validItems.push({
      id,
      question_text: questionText,
      correct_answer: correctAnswer,
      extraction_note: typeof raw?.extraction_note === 'string' ? raw.extraction_note : '',
    });
  }

  if (validItems.length === 0) {
    return new Response(
      JSON.stringify({ classifications: [], failed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Tier call is built from a freshly-mapped {id, question_text}-only
  // array, not validItems itself -- see file header on why this needs to
  // be a real data-visibility gate, not just prompt discipline.
  const blindItems: ClassifyBlindItem[] = validItems.map((it) => ({ id: it.id, question_text: it.question_text }));

  const [tierResult, concernsResult] = await Promise.all([
    callTierClassifier(blindItems),
    callConcernsClassifier(validItems),
  ]);

  if (!tierResult.ok) {
    return new Response(
      JSON.stringify({ error: `Tier classification failed: ${tierResult.reason}` }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  if (!concernsResult.ok) {
    return new Response(
      JSON.stringify({ error: `Concern classification failed: ${concernsResult.reason}` }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const classifications: { id: string; proposed_tier: ProposedTier; concerns: Concern[] }[] = [];
  for (const item of validItems) {
    const tier = tierResult.byId.get(item.id);
    if (!tier) {
      failed.push({ id: item.id, reason: 'tier classifier did not return a valid entry for this id' });
      continue;
    }
    // Concerns are supplementary -- a missing concerns entry for an id
    // that DID get a valid tier is treated as "no concerns flagged"
    // (empty array), not a failure, so one call's hiccup doesn't discard
    // an otherwise-good tier classification.
    const concerns = concernsResult.byId.get(item.id) ?? [];
    classifications.push({ id: item.id, proposed_tier: tier, concerns });
  }

  return new Response(
    JSON.stringify({ classifications, failed }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
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
  const { locationName, tier, required_digit, genre, exclude_movies, mode, count, preferred_digits, questions } = body;
  const isBatch = mode === 'batch';
  const isClassify = mode === 'classify';

  // Classify mode has an entirely different request shape (a `questions`
  // array of existing pool rows; it PRODUCES a tier, it doesn't take one)
  // -- dispatched before any of the single/batch-mode field checks below,
  // none of which apply to it.
  if (isClassify) {
    return await handleClassifyMode(questions);
  }

  if (!tier) {
    return new Response(JSON.stringify({ error: 'tier is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // locationName ties a question to one specific waypoint -- batch mode
  // isn't building one waypoint's question, it's stocking the pool, so
  // there's no single location to tie it to.
  if (!isBatch && !locationName) {
    return new Response(JSON.stringify({ error: 'locationName is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // required_digit doesn't apply to batch mode at all -- that's the whole
  // point (see buildBatchPrompt below): which digits a batch's questions
  // cover is computed afterward from whatever real facts the model finds,
  // never demanded upfront.
  if (!isBatch && (
    required_digit === undefined ||
    required_digit === null ||
    !Number.isInteger(required_digit) ||
    required_digit < 0 ||
    required_digit > 9
  )) {
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

  if (isBatch) {
    return await handleBatchMode(supabase, genre, tier, count, preferred_digits, buildFilmSection);
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

    // Shared with batch mode -- see extractLastJsonObject's own comment for
    // why a depth-tracking scan replaced the previous lastIndexOf('{')/
    // lastIndexOf('}') heuristic used here directly (that heuristic broke
    // on nested JSON; it happened to work for this flat single-question
    // schema, but was a duplicate of the same flawed logic, not a
    // deliberately different implementation).
    const parsed = extractLastJsonObject(text);
    if (!parsed) {
      lastFailureReason = 'Could not parse a JSON object from the AI response';
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
    if ('failureReason' in factualCheck) {
      lastFailureReason = `Factual verification pass failed: ${factualCheck.failureReason}`;
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
    if ('failureReason' in hygieneCheck) {
      lastFailureReason = `Text-hygiene verification pass failed: ${hygieneCheck.failureReason}`;
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
