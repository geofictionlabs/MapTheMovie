INSERT INTO trivia_pool (genre, difficulty, coordinate_digit, movie_title, movie_year, movie_emoji, question_text, correct_answer, extraction_note, hint_text, placeholder) VALUES

-- DIGIT 0
('scifi', 1, 0, 'Star Wars', 1977, '⭐', 'What year was the original Star Wars released? Take units digit.', 1977, 'Take the units digit of the year', 'Late 70s. Take the last digit.', 'e.g. 7'),
('scifi', 1, 0, 'The Matrix', 1999, '💊', 'How many Matrix films are there? Take units digit.', 4, 'Subtract 4 from your answer', 'Four films total. Subtract 4.', 'e.g. 0'),
('scifi', 1, 0, '2001 A Space Odyssey', 1968, '🔴', 'What is the last digit of the year in the title 2001?', 1, 'Subtract 1 from your answer', 'Two zero zero one. Take the last digit then subtract 1.', 'e.g. 0'),
('scifi', 1, 0, 'Interstellar', 2014, '⏰', 'How many dimensions does Cooper travel through? Take units digit.', 5, 'Subtract 5 from your answer', 'Five dimensions. Subtract 5.', 'e.g. 0'),
('scifi', 1, 0, 'Gravity', 2013, '🌍', 'How many astronauts survive at the end of Gravity? Take units digit then subtract 1.', 1, 'Subtract 1 from your answer', 'Only one survives. Subtract 1.', 'e.g. 0'),

-- DIGIT 1
('scifi', 1, 1, 'Star Wars', 1977, '⭐', 'How many Death Stars are destroyed across the original trilogy?', 2, 'Subtract 1 from your answer', 'Two Death Stars blown up. Subtract 1.', 'e.g. 1'),
('scifi', 1, 1, 'Alien', 1979, '👾', 'How many aliens are on the Nostromo at the start?', 1, 'Your answer is the digit', 'Just one alien. That is the whole terror.', 'e.g. 1'),
('scifi', 1, 1, 'The Terminator', 1984, '🤖', 'How many Terminators are sent back in the first film?', 1, 'Your answer is the digit', 'Just one Terminator sent back. Model T-800.', 'e.g. 1'),
('scifi', 1, 1, 'ET', 1982, '👽', 'How many fingers does ET point with when he says phone home?', 1, 'Your answer is the digit', 'One glowing finger. Phone home.', 'e.g. 1'),
('scifi', 1, 1, 'Back to the Future', 1985, '⚡', 'How many flux capacitors are in the DeLorean?', 1, 'Your answer is the digit', 'Just one flux capacitor. The key invention.', 'e.g. 1'),

-- DIGIT 2
('scifi', 1, 2, 'Star Wars', 1977, '⭐', 'How many suns does Luke watch set on Tatooine?', 2, 'Your answer is the digit', 'Two suns. A binary sunset. Famous scene.', 'e.g. 2'),
('scifi', 1, 2, 'Terminator 2', 1991, '🤖', 'What number Terminator film is Judgment Day?', 2, 'Your answer is the digit', 'It is in the title. Terminator 2.', 'e.g. 2'),
('scifi', 1, 2, 'Aliens', 1986, '👾', 'Aliens is the second film in the franchise. What number is it?', 2, 'Your answer is the digit', 'Alien then Aliens. Second film.', 'e.g. 2'),
('scifi', 1, 2, 'The Matrix', 1999, '💊', 'How many pills does Morpheus offer Neo?', 2, 'Your answer is the digit', 'Red pill or blue pill. Two choices.', 'e.g. 2'),
('scifi', 1, 2, 'Blade Runner 2049', 2017, '🌧️', 'What number is in the title of Blade Runner 2049? Take units digit.', 2049, 'Take the units digit of the number in the title', 'Two zero four nine. Take the last digit.', 'e.g. 9'),

-- DIGIT 3
('scifi', 1, 3, 'Star Wars', 1977, '⭐', 'How many Star Wars films are in the original trilogy?', 3, 'Your answer is the digit', 'A New Hope, Empire Strikes Back, Return of the Jedi.', 'e.g. 3'),
('scifi', 1, 3, 'Back to the Future', 1985, '⚡', 'How many Back to the Future films are there?', 3, 'Your answer is the digit', 'A trilogy. Three films.', 'e.g. 3'),
('scifi', 1, 3, 'Guardians of the Galaxy', 2014, '🚀', 'How many Guardians are in the original team?', 5, 'Subtract 2 from your answer', 'Star-Lord, Gamora, Drax, Rocket, Groot. Subtract 2.', 'e.g. 3'),
('scifi', 1, 3, 'Men in Black', 1997, '🕶️', 'How many Men in Black films are there?', 4, 'Subtract 1 from your answer', 'Four films in the series. Subtract 1.', 'e.g. 3'),
('scifi', 1, 3, 'The Fifth Element', 1997, '🔥', 'How many divine stones are there in The Fifth Element?', 4, 'Subtract 1 from your answer', 'Four elemental stones plus the fifth element. Subtract 1.', 'e.g. 3'),

-- DIGIT 4
('scifi', 1, 4, 'Star Wars', 1977, '⭐', 'What episode number is the original Star Wars film?', 4, 'Your answer is the digit', 'A New Hope is Episode IV.', 'e.g. 4'),
('scifi', 1, 4, 'Alien', 1979, '👾', 'How many crew members are on the Nostromo?', 7, 'Subtract 3 from your answer', 'Seven crew members. Subtract 3.', 'e.g. 4'),
('scifi', 1, 4, 'Independence Day', 1996, '🛸', 'How many aliens attack major cities at once?', 3, 'Add 1 to your answer', 'Three cities attacked simultaneously. Add 1.', 'e.g. 4'),
('scifi', 1, 4, 'The Martian', 2015, '🪐', 'How many crew members leave Mark Watney behind?', 5, 'Subtract 1 from your answer', 'Five crew members evacuate. Subtract 1.', 'e.g. 4'),
('scifi', 1, 4, 'Arrival', 2016, '🛸', 'How many alien vessels appear on Earth?', 12, 'Add the digits: 1+2 then add 1', 'Twelve vessels. Add the digits then add 1.', 'e.g. 4'),

-- DIGIT 5
('scifi', 1, 5, 'The Fifth Element', 1997, '🔥', 'What number element is the Fifth Element?', 5, 'Your answer is the digit', 'It is in the title.', 'e.g. 5'),
('scifi', 1, 5, 'Star Wars', 1977, '⭐', 'How many Star Wars films are in the sequel trilogy?', 3, 'Add 2 to your answer', 'Three sequel films. Add 2.', 'e.g. 5'),
('scifi', 1, 5, 'Interstellar', 2014, '⏰', 'How many dimensions does the tesseract have? Take units digit.', 5, 'Your answer is the digit', 'Five dimensional space. Single digit.', 'e.g. 5'),
('scifi', 1, 5, 'The Hitchhikers Guide', 2005, '🌌', 'What is the answer to life the universe and everything? Take units digit.', 42, 'Take the units digit', 'Forty two. The famous answer. Take the last digit.', 'e.g. 2'),
('scifi', 1, 5, 'Minority Report', 2002, '👁️', 'How many PreCogs are in the PreCrime program?', 3, 'Add 2 to your answer', 'Three PreCogs. Add 2.', 'e.g. 5'),

-- DIGIT 6
('scifi', 1, 6, 'Star Trek', 1979, '🖖', 'How many letters are in VULCAN?', 6, 'Your answer is the digit', 'Count the letters in VULCAN.', 'e.g. 6'),
('scifi', 1, 6, 'Alien', 1979, '👾', 'How many letters are in ALIEN?', 5, 'Add 1 to your answer', 'Count the letters in ALIEN. Add 1.', 'e.g. 6'),
('scifi', 1, 6, 'The Martian', 2015, '🪐', 'How many crew members are in the Ares 3 mission?', 6, 'Your answer is the digit', 'Six crew members on the mission.', 'e.g. 6'),
('scifi', 1, 6, 'Guardians of the Galaxy', 2014, '🚀', 'How many Infinity Stones are there?', 6, 'Your answer is the digit', 'Space, Mind, Reality, Power, Time, Soul.', 'e.g. 6'),
('scifi', 1, 6, 'I Robot', 2004, '🤖', 'What year was I Robot released? Take units digit.', 2004, 'Take the units digit of the year', 'Released in 2004. Take the last digit.', 'e.g. 4'),

-- DIGIT 7
('scifi', 1, 7, 'Alien', 1979, '👾', 'How many crew members are on the Nostromo?', 7, 'Your answer is the digit', 'Seven crew members face one alien.', 'e.g. 7'),
('scifi', 1, 7, 'Star Wars', 1977, '⭐', 'What year was the original Star Wars released? Take units digit.', 1977, 'Take the units digit of the year', 'Released in 1977. Take the last digit.', 'e.g. 7'),
('scifi', 1, 7, 'Predator', 1987, '🌿', 'What year was Predator released? Take units digit.', 1987, 'Take the units digit of the year', 'Released in 1987. Take the last digit.', 'e.g. 7'),
('scifi', 1, 7, 'Total Recall', 1990, '🧠', 'How many seconds does Quaid have to get his ass to Mars? Joke answer — take the letters in MARS subtract 4 then add 7.', 4, 'Subtract 4 from letters in MARS then add 7', 'MARS has 4 letters. 4-4=0, 0+7=7.', 'e.g. 7'),
('scifi', 1, 7, 'The Day the Earth Stood Still', 1951, '🤖', 'How many letters are in KLAATU?', 6, 'Add 1 to your answer', 'Count the letters in KLAATU. Add 1.', 'e.g. 7'),

-- DIGIT 8
('scifi', 1, 8, 'Back to the Future', 1985, '⚡', 'What speed must the DeLorean reach in mph?', 88, 'Take the first digit of your answer', 'Eighty eight miles per hour. Take the first digit.', 'e.g. 8'),
('scifi', 1, 8, 'District 9', 2009, '👽', 'How many letters are in DISTRICT?', 8, 'Your answer is the digit', 'Count the letters in DISTRICT.', 'e.g. 8'),
('scifi', 1, 8, 'The Martian', 2015, '🪐', 'How many letters are in MARTIAN?', 7, 'Add 1 to your answer', 'Count the letters in MARTIAN. Add 1.', 'e.g. 8'),
('scifi', 1, 8, 'Stargate', 1994, '🌀', 'How many letters are in STARGATE?', 8, 'Your answer is the digit', 'Count the letters in STARGATE.', 'e.g. 8'),
('scifi', 1, 8, 'Robocop', 1987, '🤖', 'How many directives does Robocop have? Take units digit then add 5.', 4, 'Subtract 1 from your answer then double', 'Four directives. Subtract 1 then double.', 'e.g. 8'),

-- DIGIT 9
('scifi', 1, 9, 'Star Wars', 1977, '⭐', 'How many Star Wars main saga films are there in total?', 9, 'Your answer is the digit', 'Episodes one through nine.', 'e.g. 9'),
('scifi', 1, 9, 'The Matrix', 1999, '💊', 'What year was The Matrix released? Take units digit.', 1999, 'Take the units digit of the year', 'Released in 1999. Take the last digit.', 'e.g. 9'),
('scifi', 1, 9, 'District 9', 2009, '👽', 'What number district is it?', 9, 'Your answer is the digit', 'It is in the title.', 'e.g. 9'),
('scifi', 1, 9, 'Plan 9 from Outer Space', 1957, '🛸', 'What number plan is it?', 9, 'Your answer is the digit', 'It is in the title.', 'e.g. 9'),
('scifi', 1, 9, 'Moon', 2009, '🌙', 'What year was Moon released? Take units digit.', 2009, 'Take the units digit of the year', 'Released in 2009. Take the last digit.', 'e.g. 9')

ON CONFLICT DO NOTHING;
