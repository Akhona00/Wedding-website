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
var isSubmitting     = false;
 
function saveRSVP(rsvpData) {
  return fetch(SUPABASE_URL + '/rest/v1/rsvps', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(rsvpData)
  }).then(function (res) {
    if (!res.ok) {
      return res.text().then(function (text) {
        throw new Error(text || 'Server error ' + res.status);
      });
    }
    return true;
  });
}
 
function submitRSVP() {
  // Prevent double-submission
  if (isSubmitting) return;
 
  var name    = document.getElementById('fname').value.trim();
  var phone   = document.getElementById('phone').value.trim();
  var email   = document.getElementById('email').value.trim();
  var guests  = document.getElementById('guests').value;
  var events  = document.getElementById('events').value;
  var side    = document.getElementById('side-val').value;
  var diet    = document.getElementById('diet').value.trim();
  var message = document.getElementById('msg').value.trim();
 
  if (!name || !phone || !email || !guests || !events || !side) {
    alert('Please fill in all required fields and choose a side.');
    return;
  }
 
  isSubmitting = true;
  var btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.textContent = 'Submitting…';
 
  var rsvpData = { full_name: name, phone, email, guests, events, side, diet, message };
 
  saveRSVP(rsvpData)
    .then(function () {
      document.getElementById('rsvp-form').classList.add('hidden');
      document.getElementById('rsvp-success').classList.add('show');
      // No need to reset isSubmitting — form is hidden after success
    })
    .catch(function (err) {
      console.error('RSVP error:', err);
      alert('Something went wrong. Please try again.\n\n' + err.message);
      isSubmitting = false;
      btn.disabled = false;
      btn.textContent = 'Confirm My Attendance';
    });
}