INSERT INTO trivia_pool (genre, difficulty, coordinate_digit, movie_title, movie_year, movie_emoji, question_text, correct_answer, extraction_note, hint_text, placeholder) VALUES

-- DIGIT 0
('comedy', 1, 0, 'Home Alone', 1990, '🏠', 'What year was Home Alone released? Take units digit.', 1990, 'Take the units digit of the year', 'Released in 1990. Take the last digit.', 'e.g. 0'),
('comedy', 1, 0, 'Airplane', 1980, '✈️', 'What year was Airplane released? Take units digit.', 1980, 'Take the units digit of the year', 'Released in 1980. Take the last digit.', 'e.g. 0'),
('comedy', 1, 0, 'Step Brothers', 2008, '🥁', 'How old are Brennan and Dale? Take units digit.', 40, 'Take the units digit', 'They are forty years old. Take the last digit.', 'e.g. 0'),
('comedy', 1, 0, 'Anchorman', 2004, '📺', 'How many letters are in BURGUNDY? Take units digit then subtract 8.', 8, 'Subtract 8 from your answer', 'Eight letters in BURGUNDY. Subtract 8.', 'e.g. 0'),
('comedy', 1, 0, 'The Hangover', 2009, '🐯', 'How many Hangover films are there? Take units digit then subtract 3.', 3, 'Subtract 3 from your answer', 'Three films. Subtract 3.', 'e.g. 0'),

-- DIGIT 1
('comedy', 1, 1, 'Elf', 2003, '🎅', 'How many food groups does Buddy the Elf say there are in his diet? Take units digit.', 4, 'Subtract 3 from your answer', 'Four main food groups for Buddy. Subtract 3.', 'e.g. 1'),
('comedy', 1, 1, 'Groundhog Day', 1993, '🦔', 'How many times does the alarm go off at 6am on the first morning?', 1, 'Your answer is the digit', 'Just once on the very first morning.', 'e.g. 1'),
('comedy', 1, 1, 'Mrs Doubtfire', 1993, '👴', 'How many Doubtfire films are there?', 1, 'Your answer is the digit', 'Just one original film.', 'e.g. 1'),
('comedy', 1, 1, 'The Grand Budapest Hotel', 2014, '🏨', 'How many letters are in the word GRAND? Take units digit then subtract 4.', 5, 'Subtract 4 from your answer', 'Five letters in GRAND. Subtract 4.', 'e.g. 1'),
('comedy', 1, 1, 'Superbad', 2007, '🍺', 'How many main characters are in Superbad? Take units digit then subtract 2.', 3, 'Subtract 2 from your answer', 'Three main characters. Seth, Evan and Fogell. Subtract 2.', 'e.g. 1'),

-- DIGIT 2
('comedy', 1, 2, 'Home Alone 2', 1992, '🗽', 'What number Home Alone film is Lost in New York?', 2, 'Your answer is the digit', 'Home Alone 2. The second film.', 'e.g. 2'),
('comedy', 1, 2, 'Wayne''s World 2', 1993, '🎸', 'What number Wayne''s World film is the sequel?', 2, 'Your answer is the digit', 'Wayne''s World 2. The second film.', 'e.g. 2'),
('comedy', 1, 2, 'Ace Ventura', 1994, '🐾', 'How many Ace Ventura films are there?', 2, 'Your answer is the digit', 'Pet Detective and When Nature Calls. Two films.', 'e.g. 2'),
('comedy', 1, 2, 'Austin Powers', 1997, '🕺', 'How many letters are in the word SPY? Take units digit then subtract 1.', 3, 'Subtract 1 from your answer', 'Three letters in SPY. Subtract 1.', 'e.g. 2'),
('comedy', 1, 2, 'Dumb and Dumber', 1994, '🤪', 'How many Dumb and Dumber films are there?', 2, 'Your answer is the digit', 'Two films. Dumb and Dumber and To.', 'e.g. 2'),

-- DIGIT 3
('comedy', 1, 3, 'The Hangover', 2009, '🐯', 'How many Hangover films are there?', 3, 'Your answer is the digit', 'Three films in the series.', 'e.g. 3'),
('comedy', 1, 3, 'Austin Powers', 1997, '🕺', 'How many Austin Powers films are there?', 3, 'Your answer is the digit', 'Three films in the series.', 'e.g. 3'),
('comedy', 1, 3, 'Shrek', 2001, '🧅', 'How many main Shrek films are there?', 4, 'Subtract 1 from your answer', 'Four Shrek films. Subtract 1.', 'e.g. 3'),
('comedy', 1, 3, 'Night at the Museum', 2006, '🦕', 'How many Night at the Museum films are there?', 3, 'Your answer is the digit', 'Three films in the series.', 'e.g. 3'),
('comedy', 1, 3, 'Ghostbusters', 1984, '👻', 'How many Ghostbusters are in the original team?', 4, 'Subtract 1 from your answer', 'Peter, Ray, Egon and Winston. Subtract 1.', 'e.g. 3'),

-- DIGIT 4
('comedy', 1, 4, 'Ghostbusters', 1984, '👻', 'How many Ghostbusters are in the original team?', 4, 'Your answer is the digit', 'Peter, Ray, Egon and Winston.', 'e.g. 4'),
('comedy', 1, 4, 'Anchorman', 2004, '📺', 'How many members are in Ron Burgundy''s news team?', 4, 'Your answer is the digit', 'Ron, Brian, Champ and Brick.', 'e.g. 4'),
('comedy', 1, 4, 'Shrek', 2001, '🧅', 'How many Shrek films are there?', 4, 'Your answer is the digit', 'Shrek 1 2 3 and 4.', 'e.g. 4'),
('comedy', 1, 4, 'Police Academy', 1984, '🚔', 'How many Police Academy films are there? Take units digit.', 7, 'Subtract 3 from your answer', 'Seven films. Subtract 3.', 'e.g. 4'),
('comedy', 1, 4, 'Hot Shots', 1991, '✈️', 'How many letters are in the word JOKE?', 4, 'Your answer is the digit', 'Count the letters in JOKE.', 'e.g. 4'),

-- DIGIT 5
('comedy', 1, 5, 'The Naked Gun', 1988, '🔫', 'How many Naked Gun films are there? Take units digit then add 2.', 3, 'Add 2 to your answer', 'Three Naked Gun films. Add 2.', 'e.g. 5'),
('comedy', 1, 5, 'Monty Python and the Holy Grail', 1975, '🐇', 'What year was Monty Python and the Holy Grail released? Take units digit.', 1975, 'Take the units digit of the year', 'Released in 1975. Take the last digit.', 'e.g. 5'),
('comedy', 1, 5, 'Bridesmaids', 2011, '👗', 'How many bridesmaids are in the film?', 5, 'Your answer is the digit', 'Count the bridesmaids in the wedding party.', 'e.g. 5'),
('comedy', 1, 5, 'The Inbetweeners Movie', 2011, '🏖️', 'How many main characters go on holiday?', 4, 'Add 1 to your answer', 'Four lads go on holiday. Add 1.', 'e.g. 5'),
('comedy', 1, 5, 'Johnny English', 2003, '🕵️', 'How many Johnny English films are there?', 3, 'Add 2 to your answer', 'Three films. Add 2.', 'e.g. 5'),

-- DIGIT 6
('comedy', 1, 6, 'Ferris Buellers Day Off', 1986, '🚗', 'What year was Ferris Buellers Day Off released? Take units digit.', 1986, 'Take the units digit of the year', 'Released in 1986. Take the last digit.', 'e.g. 6'),
('comedy', 1, 6, 'This Is Spinal Tap', 1984, '🎸', 'What is the highest number on Spinal Tap''s amplifier?', 11, 'Subtract 5 from your answer', 'It goes to eleven. Subtract 5.', 'e.g. 6'),
('comedy', 1, 6, 'Wayne''s World', 1992, '🎸', 'How many letters are in WAYNE?', 5, 'Add 1 to your answer', 'Count the letters in WAYNE. Add 1.', 'e.g. 6'),
('comedy', 1, 6, 'Ace Ventura', 1994, '🐾', 'How many letters are in VENTURA?', 7, 'Subtract 1 from your answer', 'Count the letters in VENTURA. Subtract 1.', 'e.g. 6'),
('comedy', 1, 6, 'The Mask', 1994, '😷', 'How many letters are in COMEDY?', 6, 'Your answer is the digit', 'Count the letters in COMEDY.', 'e.g. 6'),

-- DIGIT 7
('comedy', 1, 7, 'Police Academy', 1984, '🚔', 'How many Police Academy films are there?', 7, 'Your answer is the digit', 'Seven films in the original series.', 'e.g. 7'),
('comedy', 1, 7, 'The Pink Panther', 1963, '🐆', 'How many Pink Panther films featured Peter Sellers?', 5, 'Add 2 to your answer', 'Five films with Sellers. Add 2.', 'e.g. 7'),
('comedy', 1, 7, 'Anchorman', 2004, '📺', 'How many letters are in ANCHORMAN?', 9, 'Subtract 2 from your answer', 'Count the letters in ANCHORMAN. Subtract 2.', 'e.g. 7'),
('comedy', 1, 7, 'Superbad', 2007, '🍺', 'What year was Superbad released? Take units digit.', 2007, 'Take the units digit of the year', 'Released in 2007. Take the last digit.', 'e.g. 7'),
('comedy', 1, 7, 'The Full Monty', 1997, '🩲', 'What year was The Full Monty released? Take units digit.', 1997, 'Take the units digit of the year', 'Released in 1997. Take the last digit.', 'e.g. 7'),

-- DIGIT 8
('comedy', 1, 8, 'Ghostbusters', 1984, '👻', 'What year was Ghostbusters released? Take units digit.', 1984, 'Take the units digit of the year', 'Released in 1984. Take the last digit.', 'e.g. 4'),
('comedy', 1, 8, 'Home Alone', 1990, '🏠', 'How many booby traps does Kevin set? Take units digit.', 8, 'Your answer is the digit', 'Eight traps set for the Wet Bandits.', 'e.g. 8'),
('comedy', 1, 8, 'Mrs Doubtfire', 1993, '👴', 'How many letters are in DOUBTFIRE?', 9, 'Subtract 1 from your answer', 'Count the letters in DOUBTFIRE. Subtract 1.', 'e.g. 8'),
('comedy', 1, 8, 'The Full Monty', 1997, '🩲', 'How many men are in the strip troupe?', 6, 'Add 2 to your answer', 'Six men in the group. Add 2.', 'e.g. 8'),
('comedy', 1, 8, 'Four Weddings and a Funeral', 1994, '💍', 'How many letters are in the word LAUGHTER?', 8, 'Your answer is the digit', 'Count the letters in LAUGHTER.', 'e.g. 8'),

-- DIGIT 9
('comedy', 1, 9, 'The Hangover', 2009, '🐯', 'What year was The Hangover released? Take units digit.', 2009, 'Take the units digit of the year', 'Released in 2009. Take the last digit.', 'e.g. 9'),
('comedy', 1, 9, 'Superbad', 2007, '🍺', 'How many letters are in the word HILARIOUS?', 9, 'Your answer is the digit', 'Count the letters in HILARIOUS.', 'e.g. 9'),
('comedy', 1, 9, 'Monty Python''s Life of Brian', 1979, '🐑', 'What year was Life of Brian released? Take units digit.', 1979, 'Take the units digit of the year', 'Released in 1979. Take the last digit.', 'e.g. 9'),
('comedy', 1, 9, 'Coming to America', 1988, '👑', 'How many letters are in AMERICA?', 7, 'Add 2 to your answer', 'Count the letters in AMERICA. Add 2.', 'e.g. 9'),
('comedy', 1, 9, 'Borat', 2006, '🇰🇿', 'How many letters are in COMEDIAN?', 8, 'Add 1 to your answer', 'Count the letters in COMEDIAN. Add 1.', 'e.g. 9')

ON CONFLICT DO NOTHING;
