/* ═══════════════════════════════════════════════════════════
   rsvp.js  —  RSVP submission logic for Ayanda & Ngoako
   ═══════════════════════════════════════════════════════════

   HOW TO CONNECT TO SUPABASE:
   1. Create a table called "rsvp" in your Supabase project with columns:
      name, phone, email, guests, events, side, diet, message
   2. Replace the placeholder values below with your real credentials
   3. That's it — the rest is handled automatically
   ═══════════════════════════════════════════════════════════ */

var SUPABASE_URL  = 'https://ufbfuslnzniujhwmnrbm.supabase.co';
var SUPABASE_KEY  = 'sb_publishable_4biQ90_Ml6AFItiub4y0Zg_bQo0DFDD';

var isSubmitting = false;
 
/* ── Send data to Supabase ── */
function saveRSVP(data) {
  return fetch(SUPABASE_URL + '/rest/v1/rsvps', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Prefer':        'return=minimal'
    },
    body: JSON.stringify(data)
  })
  .then(function (res) {
    if (!res.ok) {
      return res.text().then(function (text) {
        /* Try to parse Supabase error JSON for a cleaner message */
        try {
          var err = JSON.parse(text);
          throw new Error(err.message || err.hint || text);
        } catch (_) {
          throw new Error(text || 'Server error ' + res.status);
        }
      });
    }
  });
}
 
/* ── Validate & submit ── */
function submitRSVP() {
  if (isSubmitting) return; /* block double-tap */
 
  /* Read form values */
  var full_name = document.getElementById('fname').value.trim();
  var phone     = document.getElementById('phone').value.trim();
  var email     = document.getElementById('email').value.trim();
  var guests    = document.getElementById('guests').value;
  var events    = document.getElementById('events').value;
  var side      = document.getElementById('side-val').value;
  var diet      = document.getElementById('diet').value.trim();
  var message   = document.getElementById('msg').value.trim();
 
  /* Validate required fields */
  if (!full_name) { showFieldError('fname',   'Please enter your full name.');      return; }
  if (!phone)     { showFieldError('phone',   'Please enter your phone number.');   return; }
  if (!email)     { showFieldError('email',   'Please enter your email address.');  return; }
  if (!guests)    { showFieldError('guests',  'Please select number of guests.');   return; }
  if (!events)    { showFieldError('events',  'Please select which ceremonies.');   return; }
  if (!side)      { alert('Please choose Bride\'s side or Groom\'s side.'); return; }
 
  /* Lock submission */
  isSubmitting = true;
  var btn = document.getElementById('submit-btn');
  btn.disabled    = true;
  btn.textContent = 'Submitting…';
 
  /* Payload — column names match your Supabase table exactly */
  var payload = {
    full_name : full_name,
    phone     : phone,
    email     : email,
    guests    : guests,
    events    : events,
    side      : side,
    diet      : diet    || null,
    message   : message || null
  };
 
  saveRSVP(payload)
    .then(function () {
      /* Hide form, show success */
      document.getElementById('rsvp-form').classList.add('hidden');
      document.getElementById('rsvp-success').classList.add('show');
    })
    .catch(function (err) {
      console.error('RSVP submission failed:', err);
      alert('Oops! Something went wrong. Please try again.\n\nError: ' + err.message);
      /* Unlock so user can retry */
      isSubmitting    = false;
      btn.disabled    = false;
      btn.textContent = 'Confirm My Attendance';
    });
}
 
/* ── Inline field error helper ── */
function showFieldError(fieldId, msg) {
  var field = document.getElementById(fieldId);
  if (!field) return;
  field.focus();
  field.style.borderColor = '#e05a3a';
  /* Reset border on next input */
  field.addEventListener('input', function reset() {
    field.style.borderColor = '';
    field.removeEventListener('input', reset);
  }, { once: true });
  alert(msg);
}