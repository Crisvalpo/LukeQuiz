import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://czsjwqwjshkfguzzrbre.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6c2p3cXdqc2hrZmd1enpyYnJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NjcyNzksImV4cCI6MjA5MTM0MzI3OX0.1aMOZDO-R8vRayAxeRuUkGjkdPpg7S7SRGmqfLq8le4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const quizId = '21723593-d62c-4322-a64c-18e814f7ca40';
  const questionId = 'efd965ba-00fb-4e2c-be37-2a4c6bb604cb';
  
  try {
    const joinCode = 'TQD' + Math.random().toString(36).substring(2, 5).toUpperCase();
    console.log('Inserting game...');
    const { data: game, error: gameErr } = await supabase.from('games').insert({
      quiz_id: quizId,
      join_code: joinCode,
      status: 'question',
      current_question_index: 8,
      question_started_at: new Date().toISOString()
    }).select().single();
    
    if (gameErr) throw gameErr;
    console.log('Inserted Game:', game);
    
    const { data: player, error: playerErr } = await supabase.from('players').insert({
      game_id: game.id,
      nickname: 'TestQD',
      emoji: '👽',
      score: 0
    }).select().single();
    
    if (playerErr) throw playerErr;
    console.log('Inserted Player:', player);
    
    const { data: answer, error: answerErr } = await supabase.from('answers').insert({
      player_id: player.id,
      question_id: questionId,
      selected_option: 'B'
    }).select().single();
    
    if (answerErr) throw answerErr;
    console.log('Inserted Answer:', answer);
    
    // Clean up
    console.log('Cleaning up...');
    await supabase.from('answers').delete().eq('id', answer.id);
    await supabase.from('players').delete().eq('id', player.id);
    await supabase.from('games').delete().eq('id', game.id);
  } catch (e) {
    console.error('Error:', e);
  }
}

run();
