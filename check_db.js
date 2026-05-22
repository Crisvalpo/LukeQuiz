import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://czsjwqwjshkfguzzrbre.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6c2p3cXdqc2hrZmd1enpyYnJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NjcyNzksImV4cCI6MjA5MTM0MzI3OX0.1aMOZDO-R8vRayAxeRuUkGjkdPpg7S7SRGmqfLq8le4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  try {
    const quizId = '21723593-d62c-4322-a64c-18e814f7ca40';
    const questionId = 'efd965ba-00fb-4e2c-be37-2a4c6bb604cb';
    
    // Create a temporary game
    const joinCode = 'TDB' + Math.random().toString(36).substring(2, 5).toUpperCase();
    const { data: game } = await supabase.from('games').insert({
      quiz_id: quizId,
      join_code: joinCode,
      status: 'question',
      current_question_index: 8,
      question_started_at: new Date().toISOString()
    }).select().single();

    const { data: player } = await supabase.from('players').insert({
      game_id: game.id,
      nickname: 'TestDB',
      emoji: '👽',
      score: 0
    }).select().single();

    const { data: answer } = await supabase.from('answers').insert({
      player_id: player.id,
      question_id: questionId,
      selected_option: 'B'
    }).select().single();

    console.log('Inserted values:');
    console.log('game.question_started_at:', game.question_started_at);
    console.log('answer.answered_at:', answer.answered_at);
    
    // Clean up
    await supabase.from('answers').delete().eq('id', answer.id);
    await supabase.from('players').delete().eq('id', player.id);
    await supabase.from('games').delete().eq('id', game.id);
  } catch (e) {
    console.error('Error occurred:', e);
  }
}

run().catch(e => console.error('Top level error:', e));
