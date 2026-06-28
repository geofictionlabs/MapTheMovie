INSERT INTO trivia_pool (genre, difficulty, coordinate_digit, movie_title, movie_year, movie_emoji, question_text, correct_answer, extraction_note, hint_text, placeholder) VALUES

-- DIGIT 0
('action', 1, 0, 'Mission Impossible', 1996, '💣', 'How many Mission Impossible films are there? Take units digit.', 7, 'Subtract 7 from your answer', 'Seven films in the series. Subtract 7.', 'e.g. 0'),
('action', 1, 0, 'Die Hard', 1988, '🏢', 'How many floors does Nakatomi Plaza have? Take units digit.', 35, 'Add the digits 3+5 subtract 8', 'Thirty five floors. Add the digits then subtract 8.', 'e.g. 0'),
('action', 1, 0, 'Speed', 1994, '🚌', 'What speed must the bus stay above? Take units digit.', 50, 'Take the units digit', 'Fifty miles per hour. Take the last digit.', 'e.g. 0'),
('action', 1, 0, 'Top Gun', 1986, '✈️', 'How many pilots wash out of Top Gun on average per year? Take units digit.', 10, 'Take the units digit', 'Ten percent wash out. Take the last digit.', 'e.g. 0'),
('action', 1, 0, 'The Italian Job', 2003, '🚗', 'How many Mini Coopers are used in the heist? Take units digit then subtract 3.', 3, 'Subtract 3 from your answer', 'Three Minis. Subtract 3.', 'e.g. 0'),

-- DIGIT 1
('action', 1, 1, 'Die Hard', 1988, '🏢', 'How many Die Hard films are there? Take units digit.', 5, 'Subtract 4 from your answer', 'Five films. Subtract 4.', 'e.g. 1'),
('action', 1, 1, 'John Wick', 2014, '🐶', 'How many John Wick films are there? Take units digit.', 4, 'Subtract 3 from your answer', 'Four films. Subtract 3.', 'e.g. 1'),
('action', 1, 1, 'The Dark Knight', 2008, '🦇', 'How many Dark Knight films are in the trilogy? Take units digit then subtract 2.', 3, 'Subtract 2 from your answer', 'Three films. Subtract 2.', 'e.g. 1'),
('action', 1, 1, 'Gladiator', 2000, '⚔️', 'How many Gladiator films are there in the original run?', 1, 'Your answer is the digit', 'Just one original film. Gladiator 2 came much later.', 'e.g. 1'),
('action', 1, 1, 'Mad Max', 1979, '🛞', 'How many letters are in the word MAX?', 3, 'Subtract 2 from your answer', 'Count the letters in MAX. Subtract 2.', 'e.g. 1'),

-- DIGIT 2
('action', 1, 2, 'Lethal Weapon', 1987, '🔫', 'How many Lethal Weapon films are there?', 4, 'Subtract 2 from your answer', 'Four films. Subtract 2.', 'e.g. 2'),
('action', 1, 2, 'Top Gun Maverick', 2022, '✈️', 'What year was Top Gun Maverick released? Take units digit.', 2022, 'Take the units digit of the year', 'Released in 2022. Take the last digit.', 'e.g. 2'),
('action', 1, 2, 'Rush Hour', 1998, '🥋', 'How many Rush Hour films are there?', 3, 'Subtract 1 from your answer', 'Three Rush Hour films. Subtract 1.', 'e.g. 2'),
('action', 1, 2, 'Beverly Hills Cop', 1984, '🚔', 'How many Beverly Hills Cop films are there?', 4, 'Subtract 2 from your answer', 'Four films in the series. Subtract 2.', 'e.g. 2'),
('action', 1, 2, 'The Expendables', 2010, '💪', 'How many Expendables films are there?', 4, 'Subtract 2 from your answer', 'Four films. Subtract 2.', 'e.g. 2'),

-- DIGIT 3
('action', 1, 3, 'The Dark Knight', 2008, '🦇', 'How many films are in Nolans Batman trilogy?', 3, 'Your answer is the digit', 'Begins, Dark Knight, Dark Knight Rises.', 'e.g. 3'),
('action', 1, 3, 'Back to the Future', 1985, '⚡', 'How many Back to the Future films are there?', 3, 'Your answer is the digit', 'A trilogy. Three films.', 'e.g. 3'),
('action', 1, 3, 'The Bourne Identity', 2002, '🛂', 'How many original Bourne films with Matt Damon are there?', 4, 'Subtract 1 from your answer', 'Four Bourne films with Damon. Subtract 1.', 'e.g. 3'),
('action', 1, 3, 'Taken', 2008, '📞', 'How many Taken films are there?', 3, 'Your answer is the digit', 'Three Taken films with Liam Neeson.', 'e.g. 3'),
('action', 1, 3, 'The Transporter', 2002, '🚗', 'How many Transporter films are there?', 3, 'Your answer is the digit', 'Three Transporter films with Jason Statham.', 'e.g. 3'),

-- DIGIT 4
('action', 1, 4, 'Die Hard', 1988, '🏢', 'How many floors does Nakatomi Plaza have? Add the digits.', 35, 'Add the digits: 3+5 subtract 4', 'Thirty five. Add the digits 3+5=8 then subtract 4.', 'e.g. 4'),
('action', 1, 4, 'Indiana Jones', 1981, '🎩', 'How many Indiana Jones films are there?', 5, 'Subtract 1 from your answer', 'Five films including Dial of Destiny. Subtract 1.', 'e.g. 4'),
('action', 1, 4, 'Lethal Weapon', 1987, '🔫', 'How many Lethal Weapon films are there?', 4, 'Your answer is the digit', 'Four films in the series.', 'e.g. 4'),
('action', 1, 4, 'The Expendables', 2010, '💪', 'How many Expendables films are there?', 4, 'Your answer is the digit', 'Four films total.', 'e.g. 4'),
('action', 1, 4, 'Beverly Hills Cop', 1984, '🚔', 'How many Beverly Hills Cop films are there?', 4, 'Your answer is the digit', 'Four films in the series.', 'e.g. 4'),

-- DIGIT 5
('action', 1, 5, 'Mission Impossible', 1996, '💣', 'How many letters are in the word MISSION?', 7, 'Subtract 2 from your answer', 'Count the letters in MISSION. Subtract 2.', 'e.g. 5'),
('action', 1, 5, 'Die Hard', 1988, '🏢', 'How many Die Hard films are there?', 5, 'Your answer is the digit', 'Five films in the series.', 'e.g. 5'),
('action', 1, 5, 'Fast and Furious', 2001, '🚗', 'How many letters are in FURIOUS?', 7, 'Subtract 2 from your answer', 'Count the letters in FURIOUS. Subtract 2.', 'e.g. 5'),
('action', 1, 5, 'Kingsman', 2014, '☂️', 'How many letters are in KINGS?', 5, 'Your answer is the digit', 'Count the letters in KINGS.', 'e.g. 5'),
('action', 1, 5, 'Heat', 1995, '🔫', 'What year was Heat released? Take units digit.', 1995, 'Take the units digit of the year', 'Released in 1995. Take the last digit.', 'e.g. 5'),

-- DIGIT 6
('action', 1, 6, 'The Fast and the Furious', 2001, '🚗', 'How many Fast and Furious main saga films are there? Take units digit.', 10, 'Subtract 4 from your answer', 'Ten main films. Subtract 4.', 'e.g. 6'),
('action', 1, 6, 'James Bond', 1962, '🔫', 'How many actors have played James Bond in official films?', 6, 'Your answer is the digit', 'Connery, Lazenby, Moore, Dalton, Brosnan, Craig.', 'e.g. 6'),
('action', 1, 6, 'Rush Hour', 1998, '🥋', 'How many letters are in TUCKER?', 6, 'Your answer is the digit', 'Count the letters in TUCKER. Chris Tucker.', 'e.g. 6'),
('action', 1, 6, 'Cobra', 1986, '🐍', 'How many letters are in STALLONE?', 8, 'Subtract 2 from your answer', 'Count the letters in STALLONE. Subtract 2.', 'e.g. 6'),
('action', 1, 6, 'The Italian Job', 2003, '🚗', 'How many letters are in ITALIAN?', 7, 'Subtract 1 from your answer', 'Count the letters in ITALIAN. Subtract 1.', 'e.g. 6'),

-- DIGIT 7
('action', 1, 7, 'James Bond', 1962, '🔫', 'What is James Bond s agent number? Take units digit.', 7, 'Take the units digit', 'Double O Seven. Take the last digit.', 'e.g. 7'),
('action', 1, 7, 'The Magnificent Seven', 1960, '🤠', 'How many gunfighters are hired?', 7, 'Your answer is the digit', 'It is in the title.', 'e.g. 7'),
('action', 1, 7, 'Se7en', 1995, '📦', 'How many deadly sins are there?', 7, 'Your answer is the digit', 'The film is named after this number.', 'e.g. 7'),
('action', 1, 7, 'Predator', 1987, '🌿', 'What year was Predator released? Take units digit.', 1987, 'Take the units digit of the year', 'Released in 1987. Take the last digit.', 'e.g. 7'),
('action', 1, 7, 'Top Gun', 1986, '✈️', 'How many letters are in MAVERICK?', 8, 'Subtract 1 from your answer', 'Count the letters in MAVERICK. Subtract 1.', 'e.g. 7'),

-- DIGIT 8
('action', 1, 8, 'Die Hard', 1988, '🏢', 'What year was Die Hard released? Take units digit.', 1988, 'Take the units digit of the year', 'Released in 1988. Take the last digit.', 'e.g. 8'),
('action', 1, 8, 'Rambo', 1982, '🏹', 'How many letters are in STALLONE?', 8, 'Your answer is the digit', 'Count the letters in STALLONE.', 'e.g. 8'),
('action', 1, 8, 'Mad Max Fury Road', 2015, '🛞', 'How many letters are in FURY ROAD? Count letters only not the space.', 8, 'Your answer is the digit', 'F-U-R-Y-R-O-A-D. Eight letters. Do not count the space.', 'e.g. 8'),
('action', 1, 8, 'Lethal Weapon', 1987, '🔫', 'How many letters are in LETHAL?', 6, 'Add 2 to your answer', 'Count the letters in LETHAL. Add 2.', 'e.g. 8'),
('action', 1, 8, 'The Raid', 2011, '🥋', 'How many floors does the team need to fight through?', 15, 'Add the digits: 1+5 then add 2', 'Fifteen floors. Add the digits then add 2.', 'e.g. 8'),

-- DIGIT 9
('action', 1, 9, 'John Wick Chapter 4', 2023, '🐶', 'How many steps are in the famous staircase fight scene?', 222, 'Add the digits: 2+2+2 then add 3', 'Two hundred and twenty two steps. Add all digits then add 3.', 'e.g. 9'),
('action', 1, 9, 'Fast X', 2023, '🚗', 'How many Fast and Furious films came before Fast X?', 9, 'Your answer is the digit', 'Fast X is the tenth film. Nine came before it.', 'e.g. 9'),
('action', 1, 9, 'Mission Impossible', 1996, '💣', 'How many letters are in IMPOSSIBLE?', 10, 'Subtract 1 from your answer', 'Count the letters in IMPOSSIBLE. Subtract 1.', 'e.g. 9'),
('action', 1, 9, 'Top Gun Maverick', 2022, '✈️', 'How many pilots are in the Dagger squad in Top Gun Maverick?', 9, 'Your answer is the digit', 'Nine pilots selected for the mission.', 'e.g. 9'),
('action', 1, 9, 'Cobra', 1986, '🐍', 'How many letters are in SYLVESTER?', 9, 'Your answer is the digit', 'Count the letters in SYLVESTER.', 'e.g. 9')

ON CONFLICT DO NOTHING;
