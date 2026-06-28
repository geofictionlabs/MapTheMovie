INSERT INTO trivia_pool (genre, difficulty, coordinate_digit, movie_title, movie_year, movie_emoji, question_text, correct_answer, extraction_note, hint_text, placeholder) VALUES

-- DIGIT 0
('romance', 1, 0, 'Pretty Woman', 1990, '👠', 'What year was Pretty Woman released? Take units digit.', 1990, 'Take the units digit of the year', 'Released at the start of a new decade. Take the last digit.', 'e.g. 0'),
('romance', 1, 0, 'Ghost', 1990, '🏺', 'What year was Ghost released? Take units digit.', 1990, 'Take the units digit of the year', 'Released in 1990. Take the last digit.', 'e.g. 0'),
('romance', 1, 0, 'Sleepless in Seattle', 1993, '🌧️', 'How many letters are in SEATTLE? Take units digit then subtract 7.', 7, 'Subtract 7 from your answer', 'Seven letters in SEATTLE. Subtract 7.', 'e.g. 0'),
('romance', 1, 0, 'The Notebook', 2004, '🏠', 'How many letters are in NOTEBOOK? Take units digit then subtract 8.', 8, 'Subtract 8 from your answer', 'Eight letters in NOTEBOOK. Subtract 8.', 'e.g. 0'),
('romance', 1, 0, 'Titanic', 1997, '🚢', 'How many Titanic films have been made? Take units digit then subtract 3.', 3, 'Subtract 3 from your answer', 'Three major Titanic films. Subtract 3.', 'e.g. 0'),

-- DIGIT 1
('romance', 1, 1, 'Titanic', 1997, '🚢', 'How many funnels did the real Titanic have?', 4, 'Subtract 3 from your answer', 'Four funnels. One was fake. Subtract 3.', 'e.g. 1'),
('romance', 1, 1, 'The Notebook', 2004, '🏠', 'How many years does Noah wait for Allie? Take units digit.', 7, 'Subtract 6 from your answer', 'Seven years. Subtract 6.', 'e.g. 1'),
('romance', 1, 1, 'Dirty Dancing', 1987, '💃', 'How many Dirty Dancing films are there?', 2, 'Subtract 1 from your answer', 'Two films. Subtract 1.', 'e.g. 1'),
('romance', 1, 1, 'Grease', 1978, '🎤', 'How many Grease films are there in the original run?', 2, 'Subtract 1 from your answer', 'Two Grease films. Subtract 1.', 'e.g. 1'),
('romance', 1, 1, 'Notting Hill', 1999, '📚', 'How many words are in the phrase I am just a girl standing in front of a boy? Take units digit.', 15, 'Subtract 4 from your answer then take units digit', 'Fifteen words. Subtract 4 then take units digit.', 'e.g. 1'),

-- DIGIT 2
('romance', 1, 2, 'Grease', 1978, '🎤', 'How many Grease films are there?', 2, 'Your answer is the digit', 'Grease and Grease 2. Two films.', 'e.g. 2'),
('romance', 1, 2, 'The Parent Trap', 1998, '👯', 'How many twins are there?', 2, 'Your answer is the digit', 'Two twins. Both played by Lindsay Lohan.', 'e.g. 2'),
('romance', 1, 2, 'Mamma Mia', 2008, '🎵', 'How many Mamma Mia films are there?', 2, 'Your answer is the digit', 'Mamma Mia and Here We Go Again. Two films.', 'e.g. 2'),
('romance', 1, 2, 'Bridget Jones', 2001, '📔', 'How many love interests does Bridget have in the first film?', 2, 'Your answer is the digit', 'Mark Darcy and Daniel Cleaver. Two men.', 'e.g. 2'),
('romance', 1, 2, 'When Harry Met Sally', 1989, '🥗', 'How many times do Harry and Sally meet before getting together? Take units digit.', 3, 'Subtract 1 from your answer', 'Three meetings over the years. Subtract 1.', 'e.g. 2'),

-- DIGIT 3
('romance', 1, 3, 'Bridget Jones', 2001, '📔', 'How many Bridget Jones films are there?', 3, 'Your answer is the digit', 'Three films in the series.', 'e.g. 3'),
('romance', 1, 3, 'Mamma Mia', 2008, '🎵', 'How many potential fathers does Sophie have in Mamma Mia?', 3, 'Your answer is the digit', 'Three possible dads invited to the wedding.', 'e.g. 3'),
('romance', 1, 3, 'My Best Friends Wedding', 1997, '💐', 'How many days does Julianne have to stop the wedding?', 4, 'Subtract 1 from your answer', 'Four days. Subtract 1.', 'e.g. 3'),
('romance', 1, 3, 'Hitch', 2005, '💃', 'How many dates does Hitch give Albert before the gala?', 3, 'Your answer is the digit', 'Three dates coached by Hitch.', 'e.g. 3'),
('romance', 1, 3, 'The Holiday', 2006, '🏡', 'How many main characters are in The Holiday?', 4, 'Subtract 1 from your answer', 'Four main characters swap homes. Subtract 1.', 'e.g. 3'),

-- DIGIT 4
('romance', 1, 4, 'Four Weddings and a Funeral', 1994, '💍', 'How many weddings are in the title?', 4, 'Your answer is the digit', 'It is in the title.', 'e.g. 4'),
('romance', 1, 4, 'Twilight', 2008, '🧛', 'How many Twilight films are there?', 5, 'Subtract 1 from your answer', 'Five films. Subtract 1.', 'e.g. 4'),
('romance', 1, 4, 'The Notebook', 2004, '🏠', 'What year was The Notebook released? Take units digit.', 2004, 'Take the units digit of the year', 'Released in 2004. Take the last digit.', 'e.g. 4'),
('romance', 1, 4, 'Love Actually', 2003, '❤️', 'How many love stories are in Love Actually?', 10, 'Subtract 6 from your answer', 'Ten interweaving love stories. Subtract 6.', 'e.g. 4'),
('romance', 1, 4, 'Pretty Woman', 1990, '👠', 'How many letters are in the word LOVE?', 4, 'Your answer is the digit', 'Count the letters in LOVE.', 'e.g. 4'),

-- DIGIT 5
('romance', 1, 5, 'Pride and Prejudice', 2005, '📖', 'How many Bennet daughters are there?', 5, 'Your answer is the digit', 'Jane, Elizabeth, Mary, Kitty, Lydia.', 'e.g. 5'),
('romance', 1, 5, 'Twilight', 2008, '🧛', 'How many Twilight films are there?', 5, 'Your answer is the digit', 'Five films in the series.', 'e.g. 5'),
('romance', 1, 5, 'Sense and Sensibility', 1995, '📖', 'What year was Sense and Sensibility released? Take units digit.', 1995, 'Take the units digit of the year', 'Released in 1995. Take the last digit.', 'e.g. 5'),
('romance', 1, 5, 'The Five Year Engagement', 2012, '💍', 'How many years is the engagement in the title?', 5, 'Your answer is the digit', 'It is in the title.', 'e.g. 5'),
('romance', 1, 5, 'Crazy Rich Asians', 2018, '💎', 'How many letters are in the word CRAZY?', 5, 'Your answer is the digit', 'Count the letters in CRAZY.', 'e.g. 5'),

-- DIGIT 6
('romance', 1, 6, 'The Holiday', 2006, '🏡', 'What year was The Holiday released? Take units digit.', 2006, 'Take the units digit of the year', 'Released in 2006. Take the last digit.', 'e.g. 6'),
('romance', 1, 6, 'Love Actually', 2003, '❤️', 'How many letters are in ROMANCE?', 7, 'Subtract 1 from your answer', 'Count the letters in ROMANCE. Subtract 1.', 'e.g. 6'),
('romance', 1, 6, 'Notting Hill', 1999, '📚', 'How many letters are in NOTTING?', 7, 'Subtract 1 from your answer', 'Count the letters in NOTTING. Subtract 1.', 'e.g. 6'),
('romance', 1, 6, 'Dirty Dancing', 1987, '💃', 'How many letters are in DANCING?', 7, 'Subtract 1 from your answer', 'Count the letters in DANCING. Subtract 1.', 'e.g. 6'),
('romance', 1, 6, 'Sleepless in Seattle', 1993, '🌧️', 'How many letters are in the word SLEEPY?', 6, 'Your answer is the digit', 'Count the letters in SLEEPY. S-L-E-E-P-Y.', 'e.g. 6'),

-- DIGIT 7
('romance', 1, 7, 'The Notebook', 2004, '🏠', 'How many years does Noah wait for Allie?', 7, 'Your answer is the digit', 'Seven long years of waiting.', 'e.g. 7'),
('romance', 1, 7, 'Amélie', 2001, '🌸', 'How many people does Amélie help in the film?', 7, 'Your answer is the digit', 'She helps seven people find happiness.', 'e.g. 7'),
('romance', 1, 7, 'Four Weddings and a Funeral', 1994, '💍', 'How many events are in the title? Count weddings and funerals.', 5, 'Add 2 to your answer', 'Four weddings plus one funeral equals five. Add 2.', 'e.g. 7'),
('romance', 1, 7, 'Titanic', 1997, '🚢', 'What year was Titanic released? Take units digit.', 1997, 'Take the units digit of the year', 'Released in 1997. Take the last digit.', 'e.g. 7'),
('romance', 1, 7, 'The Vow', 2012, '💍', 'How many letters are in the word FOREVER?', 7, 'Your answer is the digit', 'Count the letters in FOREVER.', 'e.g. 7'),

-- DIGIT 8
('romance', 1, 8, 'Grease', 1978, '🎤', 'What year was Grease released? Take units digit.', 1978, 'Take the units digit of the year', 'Released in 1978. Take the last digit.', 'e.g. 8'),
('romance', 1, 8, 'Crazy Rich Asians', 2018, '💎', 'What year was Crazy Rich Asians released? Take units digit.', 2018, 'Take the units digit of the year', 'Released in 2018. Take the last digit.', 'e.g. 8'),
('romance', 1, 8, 'Mamma Mia', 2008, '🎵', 'What year was Mamma Mia released? Take units digit.', 2008, 'Take the units digit of the year', 'Released in 2008. Take the last digit.', 'e.g. 8'),
('romance', 1, 8, 'Twilight', 2008, '🧛', 'What year was Twilight released? Take units digit.', 2008, 'Take the units digit of the year', 'Released in 2008. Take the last digit.', 'e.g. 8'),
('romance', 1, 8, 'The Notebook', 2004, '🏠', 'How many letters are in ROMANTIC?', 8, 'Your answer is the digit', 'Count the letters in ROMANTIC.', 'e.g. 8'),

-- DIGIT 9
('romance', 1, 9, 'When Harry Met Sally', 1989, '🥗', 'What year was When Harry Met Sally released? Take units digit.', 1989, 'Take the units digit of the year', 'Released in 1989. Take the last digit.', 'e.g. 9'),
('romance', 1, 9, 'Notting Hill', 1999, '📚', 'What year was Notting Hill released? Take units digit.', 1999, 'Take the units digit of the year', 'Released in 1999. Take the last digit.', 'e.g. 9'),
('romance', 1, 9, 'My Best Friends Wedding', 1997, '💐', 'How many letters are in WEDDING?', 7, 'Add 2 to your answer', 'Count the letters in WEDDING. Add 2.', 'e.g. 9'),
('romance', 1, 9, 'Love Actually', 2003, '❤️', 'How many letters are in VALENTINE?', 9, 'Your answer is the digit', 'Count the letters in VALENTINE.', 'e.g. 9'),
('romance', 1, 9, 'La La Land', 2016, '🎵', 'How many Academy Award nominations did La La Land receive?', 14, 'Add the digits: 1+4 then add 4', 'Fourteen nominations. Add the digits then add 4.', 'e.g. 9')

ON CONFLICT DO NOTHING;
