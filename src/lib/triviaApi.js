// src/lib/triviaApi.js
//
// Calls the generate-trivia-question Edge Function. The user's auth
// session is attached automatically by supabase.functions.invoke,
// which is what lets the function verify they are a platform admin.

import { supabase } from './supabase';
import { FunctionsHttpError } from '@supabase/supabase-js';

// requiredDigit: the 4th decimal digit of the waypoint latitude.
// The AI will generate a question whose answer naturally contains this digit.
// genre: one of the 8 HuntSelectionScreen THEMES keys, or 'general' for no
// genre constraint (thematic-to-location behaviour, unchanged).
// excludeMovies: movie titles already used elsewhere in this hunt, so the AI
// doesn't pick the same film for two different pins.
// Returns: { question_text, movie_title, movie_year, movie_emoji,
//            correct_answer, coordinate_digit, extraction_note, hint_text }
export async function generateTriviaQuestion(locationName, tier, requiredDigit, genre, excludeMovies) {
  const { data, error } = await supabase.functions.invoke('generate-trivia-question', {
    body: { locationName, tier, required_digit: requiredDigit, genre, exclude_movies: excludeMovies },
  });

  if (error) {
    // FunctionsHttpError's own .message is a fixed generic string ("Edge
    // Function returned a non-2xx status code") -- the actual reason
    // (e.g. which validation failed, after how many retries) only lives
    // in the response body, reachable via error.context.
    if (error instanceof FunctionsHttpError) {
      let detail = null;
      try {
        const body = await error.context.json();
        detail = body?.error || body?.lastFailureReason;
      } catch {
        // Response body wasn't valid JSON -- fall through to the generic message.
      }
      throw new Error(detail || error.message || 'Trivia generation failed');
    }
    throw new Error(error.message || 'Trivia generation failed');
  }
  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}
