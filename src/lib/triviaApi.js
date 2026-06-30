// src/lib/triviaApi.js
//
// Calls the generate-trivia-question Edge Function. The user's auth
// session is attached automatically by supabase.functions.invoke,
// which is what lets the function verify they are a platform admin.

import { supabase } from './supabase';

// requiredDigit: the 4th decimal digit of the waypoint latitude.
// The AI will generate a question whose answer naturally contains this digit.
// Returns: { question_text, movie_title, movie_year, movie_emoji,
//            correct_answer, coordinate_digit, extraction_note, hint_text }
export async function generateTriviaQuestion(locationName, tier, requiredDigit) {
  const { data, error } = await supabase.functions.invoke('generate-trivia-question', {
    body: { locationName, tier, required_digit: requiredDigit },
  });

  if (error) {
    throw new Error(error.message || 'Trivia generation failed');
  }
  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}
