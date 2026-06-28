INSERT INTO trivia_pool (genre, difficulty, coordinate_digit, movie_title, movie_year, movie_emoji, question_text, correct_answer, extraction_note, hint_text, placeholder) VALUES

-- DIGIT 0
('general', 1, 0, 'Grease', 1978, '🎤', 'How many Pink Ladies are there in Grease?', 50, 'Take the units digit of your answer', 'Count all the Pink Ladies in the gang.', 'e.g. 5'),
('general', 1, 0, 'Home Alone', 1990, '🏠', 'What year was Home Alone released?', 1990, 'Take the units digit of the year', 'Early 90s Christmas classic.', 'e.g. 0'),
('general', 1, 0, 'The Lion King', 1994, '🦁', 'How many letters are in the word ZERO?', 4, 'Take your answer and subtract 4', 'Count the letters. Then subtract 4.', 'e.g. 0'),
('general', 1, 0, 'Toy Story', 1995, '🤠', 'Buzz Lightyear is Space Ranger of what sector? (take units digit)', 100, 'Take the units digit', 'A round number. Take the last digit.', 'e.g. 0'),
('general', 1, 0, 'The Truman Show', 1998, '🌞', 'How many years has Truman been on TV? Take the units digit.', 30, 'Take the units digit', 'A round number. He has been on TV his whole life.', 'e.g. 0'),

-- DIGIT 1
('general', 1, 1, 'The Wizard of Oz', 1939, '🌈', 'How many ruby slippers does Dorothy wear?', 1, 'Count the pairs not the shoes', 'She wears one pair. Think pairs not individual shoes.', 'e.g. 1'),
('general', 1, 1, 'Jurassic Park', 1993, '🦕', 'How many T-Rex attacks happen in Jurassic Park?', 1, 'Your answer is the digit', 'One famous attack on the road. Just one T-Rex.', 'e.g. 1'),
('general', 1, 1, 'The Karate Kid', 1984, '🥋', 'Daniel wins the tournament with a kick to what body part? Count the words in your answer.', 1, 'Count the words in the body part name', 'One word. A single body part.', 'e.g. 1'),
('general', 1, 1, 'Rocky', 1976, '🥊', 'How many Rocky films did Sylvester Stallone write himself? Take units digit.', 1, 'Take the units digit', 'He wrote the original himself. Take the units digit of total.', 'e.g. 1'),
('general', 1, 1, 'Finding Nemo', 2003, '🐟', 'How many fins does Nemo have on his right side that are smaller than normal?', 1, 'Your answer is the digit', 'His lucky fin. Just one.', 'e.g. 1'),

-- DIGIT 2
('general', 1, 2, 'Home Alone 2', 1992, '🗽', 'Home Alone 2 is set in which city? Count the words in the city name.', 2, 'Count the words in the city name', 'New York. Two words.', 'e.g. 2'),
('general', 1, 2, 'Toy Story 2', 1999, '🤠', 'How many Toy Story films were released in the 1990s?', 2, 'Your answer is the digit', 'Toy Story 1 and 2. Both in the 90s.', 'e.g. 2'),
('general', 1, 2, 'The Parent Trap', 1998, '👯', 'How many twins are in The Parent Trap?', 2, 'Your answer is the digit', 'Both played by the same actress. Count them.', 'e.g. 2'),
('general', 1, 2, 'Sister Act', 1992, '🎵', 'How many Sister Act films are there?', 2, 'Your answer is the digit', 'Whoopi Goldberg made two of them.', 'e.g. 2'),
('general', 1, 2, 'Snow White', 1937, '🍎', 'How many Evil Queens are there in Snow White?', 2, 'Count the forms she takes', 'The Queen and the old hag. Same character, two forms.', 'e.g. 2'),

-- DIGIT 3
('general', 1, 3, 'The Three Musketeers', 1993, '⚔️', 'How many Musketeers are there originally?', 3, 'Your answer is the digit', 'It is in the title.', 'e.g. 3'),
('general', 1, 3, 'Back to the Future', 1985, '⚡', 'How many Back to the Future films are there?', 3, 'Your answer is the digit', 'A trilogy. Count them.', 'e.g. 3'),
('general', 1, 3, 'Shrek', 2001, '🧅', 'How many Shrek films feature the character Puss in Boots?', 3, 'Your answer is the digit', 'He appears in Shrek 2, 3 and 4 plus his own film.', 'e.g. 3'),
('general', 1, 3, 'Jurassic Park', 1993, '🦕', 'How many Jurassic Park films make up the original trilogy?', 3, 'Your answer is the digit', 'Before Jurassic World. The original run.', 'e.g. 3'),
('general', 1, 3, 'Lord of the Rings', 2001, '💍', 'How many Lord of the Rings films are in the main trilogy?', 3, 'Your answer is the digit', 'Fellowship, Two Towers, Return of the King.', 'e.g. 3'),

-- DIGIT 4
('general', 1, 4, 'Four Weddings and a Funeral', 1994, '💍', 'How many weddings are in Four Weddings and a Funeral?', 4, 'Your answer is the digit — it is in the title', 'It is literally in the title.', 'e.g. 4'),
('general', 1, 4, 'The Fantastic Four', 2005, '🔥', 'How many members are in the Fantastic Four?', 4, 'Your answer is the digit', 'It is in the name.', 'e.g. 4'),
('general', 1, 4, 'Teenage Mutant Ninja Turtles', 1990, '🐢', 'How many Ninja Turtles are there?', 4, 'Your answer is the digit', 'Leonardo, Donatello, Raphael, Michelangelo.', 'e.g. 4'),
('general', 1, 4, 'Alien', 1979, '👾', 'How many films are in the original Alien quadrilogy?', 4, 'Your answer is the digit', 'Alien, Aliens, Alien 3, Alien Resurrection.', 'e.g. 4'),
('general', 1, 4, 'Indiana Jones', 1981, '🎩', 'How many original Indiana Jones films are there?', 4, 'Your answer is the digit', 'Raiders, Temple, Last Crusade, Kingdom of Crystal Skull.', 'e.g. 4'),

-- DIGIT 5
('general', 1, 5, 'The Jackson Five', 1977, '🎵', 'How many brothers are in The Jackson Five?', 5, 'Your answer is the digit', 'It is in the name.', 'e.g. 5'),
('general', 1, 5, 'The Fifth Element', 1997, '🔥', 'What number element is in the title of The Fifth Element?', 5, 'Your answer is the digit', 'It is in the title.', 'e.g. 5'),
('general', 1, 5, 'Snow White', 1937, '🍎', 'How many dwarfs are in Snow White?', 7, 'Subtract 2 from your answer', 'Seven dwarfs. Subtract 2.', 'e.g. 5'),
('general', 1, 5, 'Fast and Furious', 2001, '🚗', 'How many letters are in the word FURIOUS?', 7, 'Subtract 2 from your answer', 'Count the letters. Then subtract 2.', 'e.g. 5'),
('general', 1, 5, 'Kung Fu Panda', 2008, '🐼', 'How many members are in the Furious Five plus Po?', 6, 'Subtract 1 from your answer', 'The Furious Five plus Po makes six. Subtract 1.', 'e.g. 5'),

-- DIGIT 6
('general', 1, 6, 'The Avengers', 2012, '🛡️', 'How many original Avengers are in the first film?', 6, 'Your answer is the digit', 'Iron Man, Cap, Thor, Hulk, Black Widow, Hawkeye.', 'e.g. 6'),
('general', 1, 6, 'Ocean Eleven', 2001, '🎰', 'How many letters are in the word ELEVEN?', 6, 'Your answer is the digit', 'Count the letters in ELEVEN.', 'e.g. 6'),
('general', 1, 6, 'The Italian Job', 2003, '🚗', 'How many Mini Coopers are used in the heist?', 3, 'Double your answer', 'Three Minis. Double it.', 'e.g. 6'),
('general', 1, 6, 'Night at the Museum', 2006, '🦕', 'What number film in a series was Night at the Museum? Take units digit of year released.', 2006, 'Take the units digit of the release year', 'Released in 2006. Take the last digit.', 'e.g. 6'),
('general', 1, 6, 'Shrek', 2001, '🧅', 'How many Shrek films are there in total including Puss in Boots?', 6, 'Your answer is the digit', 'Four Shreks plus two Puss in Boots films.', 'e.g. 6'),

-- DIGIT 7
('general', 1, 7, 'Snow White', 1937, '🍎', 'How many dwarfs are in Snow White?', 7, 'Your answer is the digit', 'Happy, Grumpy, Sleepy, Bashful, Sneezy, Dopey, Doc.', 'e.g. 7'),
('general', 1, 7, 'Seven', 1995, '📦', 'How many deadly sins are there?', 7, 'Your answer is the digit', 'The film is named after this number.', 'e.g. 7'),
('general', 1, 7, 'Harry Potter', 2001, '⚡', 'How many Harry Potter books are there?', 7, 'Your answer is the digit', 'One book per school year. Count them.', 'e.g. 7'),
('general', 1, 7, 'James Bond', 1962, '🔫', 'What is James Bond s agent number?', 7, 'Take only the units digit', 'Double 0 something. Take the last digit.', 'e.g. 7'),
('general', 1, 7, 'The Magnificent Seven', 1960, '🤠', 'How many gunfighters are hired in The Magnificent Seven?', 7, 'Your answer is the digit', 'It is in the title.', 'e.g. 7'),

-- DIGIT 8
('general', 1, 8, 'Spider-Man', 2002, '🕷️', 'How many legs does a spider have?', 8, 'Your answer is the digit', 'Count a spider s legs.', 'e.g. 8'),
('general', 1, 8, 'Hateful Eight', 2015, '🤠', 'How many characters are in The Hateful Eight?', 8, 'Your answer is the digit', 'It is in the title.', 'e.g. 8'),
('general', 1, 8, 'Octopus', 2000, '🐙', 'How many arms does an octopus have?', 8, 'Your answer is the digit', 'Oct means eight.', 'e.g. 8'),
('general', 1, 8, 'Back to the Future', 1985, '⚡', 'What speed in mph must the DeLorean reach? Take units digit.', 88, 'Take the units digit', 'Eighty eight miles per hour. Take the last digit.', 'e.g. 8'),
('general', 1, 8, 'Infinity War', 2018, '💎', 'What year was Avengers Infinity War released? Take units digit.', 2018, 'Take the units digit of the year', 'Released in 2018. Take the last digit.', 'e.g. 8'),

-- DIGIT 9
('general', 1, 9, 'Nine', 2009, '🎭', 'How many letters are in the word NINE?', 4, 'Take your answer and add 5', 'Count the letters in NINE. Then add 5.', 'e.g. 9'),
('general', 1, 9, 'Cloud Nine', 2008, '☁️', 'What number is Cloud ___?', 9, 'Your answer is the digit', 'On cloud what? Fill in the blank.', 'e.g. 9'),
('general', 1, 9, 'The Whole Nine Yards', 2000, '🎯', 'How many yards are in the whole nine yards?', 9, 'Your answer is the digit', 'It is in the title.', 'e.g. 9'),
('general', 1, 9, 'District 9', 2009, '👽', 'What number is the district in District 9?', 9, 'Your answer is the digit', 'It is in the title.', 'e.g. 9'),
('general', 1, 9, 'Plan 9 from Outer Space', 1957, '🛸', 'What number plan is it in Plan 9 from Outer Space?', 9, 'Your answer is the digit', 'It is in the title.', 'e.g. 9')

ON CONFLICT DO NOTHING;
