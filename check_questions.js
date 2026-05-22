import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://czsjwqwjshkfguzzrbre.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6c2p3cXdqc2hrZmd1enpyYnJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NjcyNzksImV4cCI6MjA5MTM0MzI3OX0.1aMOZDO-R8vRayAxeRuUkGjkdPpg7S7SRGmqfLq8le4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  try {
    const { data: questions, error } = await supabase.from('questions').select('id, text, time_limit, correct_option');
    if (error) throw error;
    console.log('All questions:');
    questions.forEach(q => {
      console.log(`ID: ${q.id}, Limit: ${q.time_limit}, Option: ${q.correct_option}, Text: ${q.text.substring(0, 30)}`);
    });
  } catch (e) {
    console.error('Error:', e);
  }
}

run();
