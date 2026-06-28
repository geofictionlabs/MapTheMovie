INSERT INTO trivia_pool (genre, difficulty, coordinate_digit, movie_title, movie_year, movie_emoji, question_text, correct_answer, extraction_note, hint_text, placeholder) VALUES

-- DIGIT 0
('general', 2, 0, 'Pulp Fiction', 1994, '💉', 'What year was Pulp Fiction released? Take units digit.', 1994, 'Take the units digit of the year', 'Mid 90s Tarantino classic. Take the last digit.', 'e.g. 4'),
('general', 2, 0, 'American Beauty', 1999, '🌹', 'How many Academy Awards did American Beauty win? Take units digit.', 5, 'Subtract 5 from your answer', 'Won five Oscars. Subtract 5.', 'e.g. 0'),
('general', 2, 0, 'Fight Club', 1999, '👊', 'What is the first rule of Fight Club? Count the words then take units digit.', 10, 'Take the units digit', 'You do not talk about it. Count those words. Take units digit.', 'e.g. 0'),
('general', 2, 0, 'The Shawshank Redemption', 1994, '🔒', 'How many years does Andy Dufresne spend in Shawshank? Take units digit.', 20, 'Take the units digit', 'Two decades. Take the last digit.', 'e.g. 0'),
('general', 2, 0, 'Goodfellas', 1990, '🍝', 'What year was Goodfellas released? Take units digit.', 1990, 'Take the units digit of the year', 'Scorsese classic. Released at the start of a new decade.', 'e.g. 0'),

-- DIGIT 1
('general', 2, 1, 'The Silence of the Lambs', 1991, '🦋', 'How many Oscars did Silence of the Lambs win?', 5, 'Subtract 4 from your answer', 'Won the big five. Subtract 4.', 'e.g. 1'),
('general', 2, 1, 'Schindlers List', 1993, '📋', 'How many Academy Awards did Schindlers List win?', 7, 'Subtract 6 from your answer', 'Won seven Oscars. Subtract 6.', 'e.g. 1'),
('general', 2, 1, 'No Country for Old Men', 2007, '💰', 'How many Coen Brothers are there?', 2, 'Subtract 1 from your answer', 'Joel and Ethan. Subtract 1.', 'e.g. 1'),
('general', 2, 1, 'Chinatown', 1974, '🔍', 'How many parts does Chinatown have? Count the films in the series.', 2, 'Subtract 1', 'Chinatown and The Two Jakes. Subtract 1.', 'e.g. 1'),
('general', 2, 1, 'Taxi Driver', 1976, '🚕', 'How many fingers does Travis Bickle hold to his head in the mirror scene?', 1, 'Your answer is the digit', 'You talkin to me. One finger pointed like a gun.', 'e.g. 1'),

-- DIGIT 2
('general', 2, 2, 'Apocalypse Now', 1979, '🚁', 'How many hours long is the Redux version of Apocalypse Now? Take units digit.', 3, 'Subtract 1 from your answer', 'Over three hours long. Subtract 1.', 'e.g. 2'),
('general', 2, 2, 'The Godfather', 1972, '🌹', 'How many Godfather films are there in the trilogy?', 3, 'Subtract 1 from your answer', 'Three films. Subtract 1.', 'e.g. 2'),
('general', 2, 2, 'Blade Runner', 1982, '🌧️', 'What year was the original Blade Runner released? Take units digit.', 1982, 'Take the units digit of the year', 'Early 80s sci-fi classic. Take the last digit.', 'e.g. 2'),
('general', 2, 2, 'Full Metal Jacket', 1987, '🪖', 'How many main sections does Full Metal Jacket have?', 2, 'Your answer is the digit', 'Boot camp and Vietnam. Two distinct halves.', 'e.g. 2'),
('general', 2, 2, 'Raging Bull', 1980, '🥊', 'How many times did Jake LaMotta win the world middleweight title?', 1, 'Add 1 to your answer', 'He won it once. Add 1.', 'e.g. 2'),

-- DIGIT 3
('general', 2, 3, 'The Godfather', 1972, '🌹', 'How many sons does Vito Corleone have?', 3, 'Your answer is the digit', 'Sonny, Michael and Fredo.', 'e.g. 3'),
('general', 2, 3, 'Reservoir Dogs', 1992, '🐕', 'How many Mr colour-named characters are there in Reservoir Dogs?', 6, 'Subtract 3 from your answer', 'Six Mr colours. Subtract 3.', 'e.g. 3'),
('general', 2, 3, 'The Deer Hunter', 1978, '🦌', 'How many rounds are in Russian Roulette? Take units digit.', 6, 'Subtract 3 from your answer', 'Six chambers. Subtract 3.', 'e.g. 3'),
('general', 2, 3, 'Platoon', 1986, '🌿', 'How many Oscar wins did Platoon receive?', 4, 'Subtract 1 from your answer', 'Won four Oscars including Best Picture. Subtract 1.', 'e.g. 3'),
('general', 2, 3, 'Lawrence of Arabia', 1962, '🏜️', 'How many Academy Awards did Lawrence of Arabia win?', 7, 'Subtract 4 from your answer', 'Won seven Oscars. Subtract 4.', 'e.g. 3'),

-- DIGIT 4
('general', 2, 4, 'Amadeus', 1984, '🎵', 'How many Academy Awards did Amadeus win?', 8, 'Subtract 4 from your answer', 'Won eight Oscars. Subtract 4.', 'e.g. 4'),
('general', 2, 4, 'One Flew Over the Cuckoos Nest', 1975, '🦅', 'How many patients are in McMurphys card game?', 4, 'Your answer is the digit', 'A small group of patients. Count them at the table.', 'e.g. 4'),
('general', 2, 4, 'The French Connection', 1971, '🚂', 'How many Academy Awards did The French Connection win?', 5, 'Subtract 1 from your answer', 'Won five Oscars. Subtract 1.', 'e.g. 4'),
('general', 2, 4, 'All About Eve', 1950, '🎭', 'How many Academy Award nominations did All About Eve receive?', 14, 'Add the digits: 1+4 subtract 1', 'A record 14 nominations. Add the digits then subtract 1.', 'e.g. 4'),
('general', 2, 4, 'Casablanca', 1942, '🎷', 'How many Academy Awards did Casablanca win?', 3, 'Add 1 to your answer', 'Won three Oscars. Add 1.', 'e.g. 4'),

-- DIGIT 5
('general', 2, 5, 'The Usual Suspects', 1995, '☕', 'How many criminals are in the police lineup?', 5, 'Your answer is the digit', 'A famous lineup scene. Count the men.', 'e.g. 5'),
('general', 2, 5, 'Se7en', 1995, '📦', 'How many deadly sins are explored in Se7en?', 7, 'Subtract 2 from your answer', 'Seven sins. Subtract 2.', 'e.g. 5'),
('general', 2, 5, 'The Shining', 1980, '🪓', 'Room number in The Shining? Take units digit.', 237, 'Add the digits 2+3+7 subtract 7', 'Room two three seven. Add all digits then subtract 7.', 'e.g. 5'),
('general', 2, 5, 'Heat', 1995, '🔫', 'How many minutes does Michael Mann say criminals should be able to walk away in?', 30, 'Subtract 25 from your answer', 'Thirty seconds. Subtract 25.', 'e.g. 5'),
('general', 2, 5, 'Fargo', 1996, '❄️', 'How many people die in Fargo?', 7, 'Subtract 2 from your answer', 'Seven deaths total. Subtract 2.', 'e.g. 5'),

-- DIGIT 6
('general', 2, 6, 'The Sixth Sense', 1999, '👻', 'What number sense is the sixth sense?', 6, 'Your answer is the digit', 'It is in the title.', 'e.g. 6'),
('general', 2, 6, 'Michael Collins', 1996, '🇮🇪', 'What year was Michael Collins released? Take units digit.', 1996, 'Take the units digit of the year', 'Mid 90s. Take the last digit.', 'e.g. 6'),
('general', 2, 6, 'The Departed', 2006, '🎭', 'How many main characters die in The Departed?', 6, 'Your answer is the digit', 'A very high body count among leads. Count the main deaths.', 'e.g. 6'),
('general', 2, 6, 'LA Confidential', 1997, '🔍', 'How many Academy Award nominations did LA Confidential receive?', 9, 'Subtract 3 from your answer', 'Nine nominations. Subtract 3.', 'e.g. 6'),
('general', 2, 6, 'Traffic', 2000, '💊', 'How many storylines run simultaneously in Traffic?', 3, 'Double your answer', 'Three parallel stories. Double it.', 'e.g. 6'),

-- DIGIT 7
('general', 2, 7, 'Seven Samurai', 1954, '⚔️', 'How many samurai are recruited in Seven Samurai?', 7, 'Your answer is the digit', 'It is in the title.', 'e.g. 7'),
('general', 2, 7, 'Zodiac', 2007, '♐', 'What year was Zodiac released?', 2007, 'Take the units digit of the year', 'Released in 2007. Take the last digit.', 'e.g. 7'),
('general', 2, 7, 'The Magnificent Seven', 1960, '🤠', 'How many gunmen protect the village?', 7, 'Your answer is the digit', 'It is in the title.', 'e.g. 7'),
('general', 2, 7, 'Memento', 2000, '📸', 'How many permanent tattoos does Leonard have roughly? Take units digit.', 27, 'Take the units digit', 'Around two dozen. Take the last digit.', 'e.g. 7'),
('general', 2, 7, 'Prisoners', 2013, '🔑', 'How many days does the investigation span roughly? Take units digit.', 7, 'Your answer is the digit', 'About a week. Seven days.', 'e.g. 7'),

-- DIGIT 8
('general', 2, 8, 'The Hateful Eight', 2015, '🤠', 'How many strangers are trapped together?', 8, 'Your answer is the digit', 'It is in the title.', 'e.g. 8'),
('general', 2, 8, 'Once Upon a Time in Hollywood', 2019, '🎬', 'What year is Once Upon a Time in Hollywood set? Take units digit.', 1969, 'Take the units digit of the year the film is set', 'Set in the late 60s. Take the last digit of that year.', 'e.g. 9'),
('general', 2, 8, 'Inglourious Basterds', 2009, '🎖️', 'How many scalps does Aldo Raine demand from each soldier?', 100, 'Take the hundreds digit', 'One hundred scalps each. Take the first digit.', 'e.g. 1'),
('general', 2, 8, 'The Grand Budapest Hotel', 2014, '🏨', 'How many Academy Awards did The Grand Budapest Hotel win?', 4, 'Double your answer', 'Won four Oscars. Double it.', 'e.g. 8'),
('general', 2, 8, 'Whiplash', 2014, '🥁', 'How many Academy Awards did Whiplash win?', 3, 'Subtract 1 then double', 'Won three Oscars. Subtract 1 then double.', 'e.g. 4'),

-- DIGIT 9
('general', 2, 9, 'District 9', 2009, '👽', 'What number district is it?', 9, 'Your answer is the digit', 'It is in the title.', 'e.g. 9'),
('general', 2, 9, 'Revolution 9', 1968, '🎵', 'What number is repeated in the Beatles track Revolution 9?', 9, 'Your answer is the digit', 'Number nine, number nine, number nine.', 'e.g. 9'),
('general', 2, 9, 'Nine to Five', 1980, '💼', 'What time does the working day end in Nine to Five?', 5, 'Add 4 to your answer', 'Five o clock. Add 4.', 'e.g. 9'),
('general', 2, 9, 'Cloud Atlas', 2012, '☁️', 'How many storylines are in Cloud Atlas?', 6, 'Add 3 to your answer', 'Six interwoven stories. Add 3.', 'e.g. 9'),
('general', 2, 9, 'The Ninth Gate', 1999, '🚪', 'What number gate is it?', 9, 'Your answer is the digit', 'It is in the title.', 'e.g. 9')

ON CONFLICT DO NOTHING;
