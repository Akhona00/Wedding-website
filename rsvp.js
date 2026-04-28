import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY
)

async function submitRSVP() {
  const name = document.getElementById('fname').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const email = document.getElementById('email').value.trim();
  const guests = document.getElementById('guests').value;
  const events = document.getElementById('events').value;
  const diet = document.getElementById('diet').value;
  const message = document.getElementById('msg').value;

  if (!name || !phone || !email || !guests || !events || !chosenSide) {
    alert("Please fill in all required fields");
    return;
  }

  const { error } = await supabase.from("rsvp").insert([{
    name,
    phone,
    email,
    guests,
    events,
    side: chosenSide,
    diet,
    message
  }]);

  if (error) {
    alert("Error saving RSVP: " + error.message);
    return;
  }

  document.getElementById('rsvp-form').classList.add('hidden');
  document.getElementById('rsvp-success').classList.add('show');
}