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
  // TEMPORARY DIAGNOSTIC LOGGING (remove once the Command Center
  // generation-failure investigation is closed out) -- logs the raw
  // request params and the raw invoke() result BEFORE any of this
  // function's own error-shape logic runs, so we can see exactly what
  // the client actually received (status, body, parse failures) rather
  // than only the message this function chooses to surface.
  console.log('[trivia-diag] invoking generate-trivia-question', {
    locationName, tier, requiredDigit, genre, excludeMovies,
  });

  const { data, error } = await supabase.functions.invoke('generate-trivia-question', {
    body: { locationName, tier, required_digit: requiredDigit, genre, exclude_movies: excludeMovies },
  });

  console.log('[trivia-diag] raw invoke() result', {
    data,
    error,
    errorName: error?.name,
    errorMessage: error?.message,
    errorStatus: error?.context?.status,
    isFunctionsHttpError: error instanceof FunctionsHttpError,
  });

  if (error) {
    // FunctionsHttpError's own .message is a fixed generic string ("Edge
    // Function returned a non-2xx status code") -- the actual reason
    // (e.g. which validation failed, after how many retries) only lives
    // in the response body, reachable via error.context.
    if (error instanceof FunctionsHttpError) {
      let detail = null;
      let rawBodyText = null;
      try {
        // Clone before consuming so the .json() parse below (if it
        // succeeds) still has an unread body to work with -- reading
        // the raw text first regardless of shape, since a genuine
        // infra-level 502 page is often HTML/plain-text, not JSON.
        rawBodyText = await error.context.clone().text();
        const body = JSON.parse(rawBodyText);
        // TEMPORARY DIAGNOSTIC: log both fields separately -- detail
        // below only ever surfaces body.error (see the || below), so
        // this line is the only place lastFailureReason is currently
        // visible anywhere.
        console.log('[trivia-diag] parsed error body from Edge Function', {
          status: error.context.status,
          bodyError: body?.error,
          bodyLastFailureReason: body?.lastFailureReason,
        });
        detail = body?.error || body?.lastFailureReason;
      } catch (parseErr) {
        console.log('[trivia-diag] error response body was not JSON', {
          status: error.context?.status,
          rawBodyText,
          parseErr: parseErr?.message,
        });
      }
      throw new Error(detail || error.message || 'Trivia generation failed');
    }
    throw new Error(error.message || 'Trivia generation failed');
  }
  if (data?.error) {
    console.log('[trivia-diag] 2xx response but data.error set', data);
    throw new Error(data.error);
  }

  return data;
}
