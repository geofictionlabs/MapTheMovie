INSERT INTO trivia_pool (genre, difficulty, coordinate_digit, movie_title, movie_year, movie_emoji, question_text, correct_answer, extraction_note, hint_text, placeholder) VALUES

-- DIGIT 0
('horror', 1, 0, 'Halloween', 1978, '🎃', 'What year was Halloween released? Take units digit.', 1978, 'Take the units digit of the year', 'Late 70s slasher classic. Take the last digit.', 'e.g. 8'),
('horror', 1, 0, 'Friday the 13th', 1980, '🔪', 'What year was Friday the 13th released? Take units digit.', 1980, 'Take the units digit of the year', 'Released at the start of a new decade. Take the last digit.', 'e.g. 0'),
('horror', 1, 0, 'The Ring', 2002, '📺', 'How many days do you have after watching the tape? Take units digit.', 7, 'Subtract 7 from your answer', 'Seven days. Subtract 7.', 'e.g. 0'),
('horror', 1, 0, 'Paranormal Activity', 2007, '📹', 'How many Paranormal Activity films are there? Take units digit.', 10, 'Take the units digit', 'A long running franchise. Ten films. Take the last digit.', 'e.g. 0'),
('horror', 1, 0, 'Scream', 1996, '📞', 'How many letters are in the word SCREAM? Take units digit then subtract 6.', 6, 'Subtract 6 from your answer', 'Count the letters. Then subtract 6.', 'e.g. 0'),

-- DIGIT 1
('horror', 1, 1, 'A Nightmare on Elm Street', 1984, '💤', 'How many blades are on Freddys glove?', 4, 'Subtract 3 from your answer', 'Four razor blades. Subtract 3.', 'e.g. 1'),
('horror', 1, 1, 'The Shining', 1980, '🪓', 'How many ghosts does Danny see at the Overlook Hotel at first?', 2, 'Subtract 1 from your answer', 'The two girls in the corridor. Subtract 1.', 'e.g. 1'),
('horror', 1, 1, 'Psycho', 1960, '🚿', 'How many personalities does Norman Bates have?', 2, 'Subtract 1 from your answer', 'Norman and his mother. Subtract 1.', 'e.g. 1'),
('horror', 1, 1, 'Get Out', 2017, '🪑', 'How many sunken place victims are shown in the film?', 4, 'Subtract 3 from your answer', 'Four victims shown. Subtract 3.', 'e.g. 1'),
('horror', 1, 1, 'It', 2017, '🤡', 'How many members are in the Losers Club?', 7, 'Subtract 6 from your answer', 'Seven kids in the group. Subtract 6.', 'e.g. 1'),

-- DIGIT 2
('horror', 1, 2, 'Scream', 1996, '📞', 'How many Scream films are in the original trilogy?', 3, 'Subtract 1 from your answer', 'Three original films. Subtract 1.', 'e.g. 2'),
('horror', 1, 2, 'Poltergeist', 1982, '👻', 'What year was Poltergeist released? Take units digit.', 1982, 'Take the units digit of the year', 'Released in 1982. Take the last digit.', 'e.g. 2'),
('horror', 1, 2, 'The Conjuring', 2013, '🪬', 'How many Conjuring universe films are there? Take units digit.', 9, 'Subtract 7 from your answer', 'A large universe of films. Nine total. Subtract 7.', 'e.g. 2'),
('horror', 1, 2, 'Saw', 2004, '🪚', 'How many original Saw films are there? Take units digit.', 7, 'Subtract 5 from your answer', 'Seven films in the original series. Subtract 5.', 'e.g. 2'),
('horror', 1, 2, 'The Exorcist', 1973, '🕯️', 'How many Exorcist films are there including sequels? Take units digit.', 6, 'Subtract 4 from your answer', 'Six films in total. Subtract 4.', 'e.g. 2'),

-- DIGIT 3
('horror', 1, 3, 'A Nightmare on Elm Street', 1984, '💤', 'How many original Nightmare on Elm Street films are there?', 7, 'Subtract 4 from your answer', 'Seven original films. Subtract 4.', 'e.g. 3'),
('horror', 1, 3, 'Friday the 13th', 1980, '🔪', 'How many Friday the 13th films are in the original franchise?', 12, 'Add the digits 1+2', 'Twelve films. Add the two digits together.', 'e.g. 3'),
('horror', 1, 3, 'The Purge', 2013, '🎭', 'How many hours does the Purge last?', 12, 'Add the digits 1+2', 'Twelve hours of lawlessness. Add the digits.', 'e.g. 3'),
('horror', 1, 3, 'Annabelle', 2014, '🪆', 'How many Annabelle films are there?', 3, 'Your answer is the digit', 'Three films about the doll.', 'e.g. 3'),
('horror', 1, 3, 'The Nun', 2018, '⛪', 'How many The Conjuring spinoff films are there? Take units digit.', 6, 'Subtract 3 from your answer', 'Six spinoffs. Subtract 3.', 'e.g. 3'),

-- DIGIT 4
('horror', 1, 4, 'Jaws', 1975, '🦈', 'How many Jaws films are there?', 4, 'Your answer is the digit', 'Four shark attack films in the series.', 'e.g. 4'),
('horror', 1, 4, 'Alien', 1979, '👾', 'How many films are in the original Alien series?', 4, 'Your answer is the digit', 'Alien, Aliens, Alien 3, Alien Resurrection.', 'e.g. 4'),
('horror', 1, 4, 'Halloween', 1978, '🎃', 'How many letters are in the word FEAR?', 4, 'Your answer is the digit', 'Count the letters in FEAR.', 'e.g. 4'),
('horror', 1, 4, 'Sinister', 2012, '📽️', 'How many families were murdered before the Oswalt family?', 4, 'Your answer is the digit', 'Four previous families shown in the Super 8 films.', 'e.g. 4'),
('horror', 1, 4, 'The Others', 2001, '🕯️', 'How many people live in the house at the start?', 4, 'Your answer is the digit', 'Grace and her two children plus the first servant.', 'e.g. 4'),

-- DIGIT 5
('horror', 1, 5, 'A Nightmare on Elm Street', 1984, '💤', 'How many letters are in FREDDY?', 6, 'Subtract 1 from your answer', 'Count the letters in FREDDY. Subtract 1.', 'e.g. 5'),
('horror', 1, 5, 'The Shining', 1980, '🪓', 'Room 237 in The Shining — add all the digits together.', 237, 'Add all three digits: 2+3+7 subtract 7', 'Two three seven. Add all digits then subtract 7.', 'e.g. 5'),
('horror', 1, 5, 'It', 2017, '🤡', 'Pennywise returns every how many years? Divide by 5 then add 0.', 27, 'Subtract 22 from your answer', 'Twenty seven years. Subtract 22.', 'e.g. 5'),
('horror', 1, 5, 'Halloween', 1978, '🎃', 'How many Halloween films are there in total? Take units digit.', 13, 'Subtract 8 from your answer', 'Thirteen films total. Subtract 8.', 'e.g. 5'),
('horror', 1, 5, 'Drag Me to Hell', 2009, '😈', 'How many days does Christine have before being dragged to hell?', 3, 'Add 2 to your answer', 'Three days. Add 2.', 'e.g. 5'),

-- DIGIT 6
('horror', 1, 6, 'The Omen', 1976, '😈', 'What is the number of the beast in The Omen?', 666, 'Take only the first digit', 'Six six six. Take just the first digit.', 'e.g. 6'),
('horror', 1, 6, 'Saw', 2004, '🪚', 'How many traps are in the original Saw film?', 3, 'Double your answer', 'Three main traps. Double it.', 'e.g. 6'),
('horror', 1, 6, 'The Ring', 2002, '📺', 'How many days do you have after watching the tape? Take units digit then subtract 1.', 7, 'Subtract 1 from your answer', 'Seven days. Subtract 1.', 'e.g. 6'),
('horror', 1, 6, 'Gremlins', 1984, '🐾', 'How many rules are there for caring for a Mogwai?', 3, 'Double your answer', 'Three rules. Double it.', 'e.g. 6'),
('horror', 1, 6, 'Child''s Play', 1988, '🪆', 'How many Good Guy dolls are sold in the film?', 1, 'Multiply by 6', 'Just one doll is sold to Karen. Multiply by 6.', 'e.g. 6'),

-- DIGIT 7
('horror', 1, 7, 'The Ring', 2002, '📺', 'How many days do you have after watching the cursed tape?', 7, 'Your answer is the digit', 'Seven days. A very famous horror countdown.', 'e.g. 7'),
('horror', 1, 7, 'It', 2017, '🤡', 'How many members are in the Losers Club?', 7, 'Your answer is the digit', 'Bill, Beverly, Ben, Richie, Eddie, Stan, Mike.', 'e.g. 7'),
('horror', 1, 7, 'Saw', 2004, '🪚', 'How many original Saw films are there?', 7, 'Your answer is the digit', 'Seven films before the reboot.', 'e.g. 7'),
('horror', 1, 7, 'A Nightmare on Elm Street', 1984, '💤', 'How many original Nightmare films are there?', 7, 'Your answer is the digit', 'Seven films in the original series.', 'e.g. 7'),
('horror', 1, 7, 'Sinister', 2012, '📽️', 'How many letters are in the word SINISTER?', 8, 'Subtract 1 from your answer', 'Count the letters in SINISTER. Subtract 1.', 'e.g. 7'),

-- DIGIT 8
('horror', 1, 8, 'Halloween', 1978, '🎃', 'How many letters are in HALLOWEEN?', 9, 'Subtract 1 from your answer', 'Count the letters in HALLOWEEN. Subtract 1.', 'e.g. 8'),
('horror', 1, 8, 'A Nightmare on Elm Street', 1984, '💤', 'What year was A Nightmare on Elm Street released? Take units digit.', 1984, 'Take the units digit of the year', 'Released in 1984. Take the last digit.', 'e.g. 4'),
('horror', 1, 8, 'The Shining', 1980, '🪓', 'How many letters are in OVERLOOK?', 8, 'Your answer is the digit', 'Count the letters in OVERLOOK.', 'e.g. 8'),
('horror', 1, 8, 'Hereditary', 2018, '👸', 'What year was Hereditary released? Take units digit.', 2018, 'Take the units digit of the year', 'Released in 2018. Take the last digit.', 'e.g. 8'),
('horror', 1, 8, 'The Conjuring', 2013, '🪬', 'How many letters are in CONJURING?', 9, 'Subtract 1 from your answer', 'Count the letters in CONJURING. Subtract 1.', 'e.g. 8'),

-- DIGIT 9
('horror', 1, 9, 'Halloween', 1978, '🎃', 'How many letters are in HALLOWEEN? Take units digit then add 0.', 9, 'Your answer is the digit', 'Count the letters in HALLOWEEN. Nine letters.', 'e.g. 9'),
('horror', 1, 9, 'The Conjuring', 2013, '🪬', 'How many letters are in CONJURING?', 9, 'Your answer is the digit', 'Count the letters in CONJURING. Nine letters.', 'e.g. 9'),
('horror', 1, 9, 'It Chapter Two', 2019, '🤡', 'What year was It Chapter Two released? Take units digit.', 2019, 'Take the units digit of the year', 'Released in 2019. Take the last digit.', 'e.g. 9'),
('horror', 1, 9, 'Us', 2019, '✂️', 'What year was Us released? Take units digit.', 2019, 'Take the units digit of the year', 'Jordan Peele film released in 2019. Take the last digit.', 'e.g. 9'),
('horror', 1, 9, 'Midsommar', 2019, '🌸', 'What year was Midsommar released? Take units digit.', 2019, 'Take the units digit of the year', 'Released in 2019. Take the last digit.', 'e.g. 9')

ON CONFLICT DO NOTHING;
