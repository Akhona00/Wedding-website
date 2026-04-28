import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

async function submitRSVP(name, email) {
  const { data, error } = await supabase
    .from('rsvp')
    .insert([{ name, email }])

  if (error) console.log(error)
  else console.log("Saved!", data)
}
