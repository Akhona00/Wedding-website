/* ═══════════════════════════════════════════════════════════
   rsvp.js  —  RSVP submission logic for Ayanda & Ngoako
   ═══════════════════════════════════════════════════════════

   HOW TO CONNECT TO SUPABASE:
   1. Create a table called "rsvp" in your Supabase project with columns:
      name, phone, email, guests, events, side, diet, message
   2. Replace the placeholder values below with your real credentials
   3. That's it — the rest is handled automatically
   ═══════════════════════════════════════════════════════════ */

var SUPABASE_URL = "https://ufbfuslnzniujhwmnrbm.supabase.co";
var SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmYmZ1c2xuem5pdWpod21ucmJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNjg0NjQsImV4cCI6MjA5Mjk0NDQ2NH0.rEExmoAL0hiAne6mJYqnvRwjeftwHeYse11MGRLDFXs";

var NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_4biQ90_Ml6AFItiub4y0Zg_bQo0DFDD";
var isSubmitting = false;
 
/* Max guests allowed per side */
var SIDE_LIMIT = 50;
 
var isSubmitting = false;
 
/* ── Contact details shown when a side is full ── */
var CONTACT = {
  bride: {
    name:  'Ayanda',
    phone: '+27 000 000 000', /* ← replace with Ayanda's number */
    email: 'ayanda@email.com' /* ← replace with Ayanda's email  */
  },
  groom: {
    name:  'Ngoako',
    phone: '+27 000 000 000', /* ← replace with Ngoako's number */
    email: 'ngoako@email.com' /* ← replace with Ngoako's email  */
  }
};
 
/* ── Count existing RSVPs for a given side ── */
function countSide(side) {
  return fetch(
    SUPABASE_URL + '/rest/v1/rsvps?select=id&side=eq.' + side,
    {
      headers: {
        'apikey':        SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Prefer':        'count=exact',
        'Range':         '0-0'
      }
    }
  ).then(function(res) {
    /* Supabase returns total count in Content-Range: 0-0/TOTAL */
    var range = res.headers.get('Content-Range') || '';
    var match = range.match(/\/(\d+)$/);
    return match ? parseInt(match[1], 10) : 0;
  });
}
 
/* ── Save RSVP to Supabase ── */
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
  }).then(function(res) {
    if (!res.ok) {
      return res.text().then(function(text) {
        try {
          var err = JSON.parse(text);
          throw new Error(err.message || err.hint || text);
        } catch(_) {
          throw new Error(text || 'Server error ' + res.status);
        }
      });
    }
  });
}
 
/* ── Show the "side is full" message ── */
function showSideFull(side) {
  var contact = CONTACT[side];
  var msgEl   = document.getElementById('side-full-msg');
  if (!msgEl) return;
 
  var who = side === 'bride' ? "Bride's" : "Groom's";
 
  msgEl.innerHTML =
    '<p>We\'re sorry — the ' + who + ' side has reached its maximum of ' +
    SIDE_LIMIT + ' guests.</p>' +
    '<p style="margin-top:10px">Please contact <strong style="color:#E8B84B">' +
    contact.name + '</strong> directly to be added to the waiting list:</p>' +
    '<div class="contact-line" style="margin-top:10px">' +
      '📞 ' + contact.phone + '</div>' +
    '<div class="contact-line">' +
      '✉️ ' + contact.email + '</div>';
 
  msgEl.classList.add('show');
 
  /* Disable the chosen side card visually */
  var card = document.getElementById(side === 'bride' ? 'bride-card' : 'groom-card');
  if (card) {
    card.style.opacity      = '0.4';
    card.style.pointerEvents = 'none';
  }
}
 
/* ── Validate & submit ── */
function submitRSVP() {
  if (isSubmitting) return;
 
  clearFieldErrors();
 
  var full_name = document.getElementById('fname').value.trim();
  var phone     = document.getElementById('phone').value.trim();
  var email     = document.getElementById('email').value.trim();
  var guests    = document.getElementById('guests').value;
  var events    = document.getElementById('events').value;
  var side      = document.getElementById('side-val').value;
  var diet      = document.getElementById('diet').value.trim();
  var message   = document.getElementById('msg').value.trim();
 
  /* Required field validation */
  var hasError = false;
  if (!full_name) { showFieldError('fname',  'Please enter your full name.');     hasError = true; }
  if (!phone)     { showFieldError('phone',  'Please enter your phone number.');  hasError = true; }
  if (!email)     { showFieldError('email',  'Please enter your email address.'); hasError = true; }
  if (!guests)    { showFieldError('guests', 'Please select number of guests.');  hasError = true; }
  if (!events)    { showFieldError('events', 'Please select which ceremonies.');  hasError = true; }
  if (!side)      { showFieldError('side-val', 'Please choose Bride\'s side or Groom\'s side.'); hasError = true; }
  if (hasError) return;
 
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showFieldError('email', 'Please enter a valid email address.');
    return;
  }
 
  /* Lock UI while we check capacity */
  isSubmitting = true;
  var btn = document.getElementById('submit-btn');
  btn.disabled    = true;
  btn.textContent = 'Checking availability…';
 
  /* ── Check side capacity before saving ── */
  countSide(side)
    .then(function(count) {
      if (count >= SIDE_LIMIT) {
        /* Side is full — unlock form and show message */
        isSubmitting    = false;
        btn.disabled    = false;
        btn.textContent = 'Confirm My Attendance';
        showSideFull(side);
        return;
      }
 
      /* Capacity available — proceed with save */
      btn.textContent = 'Submitting…';
 
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
 
      return saveRSVP(payload).then(function() {
        document.getElementById('rsvp-form').classList.add('hidden');
        document.getElementById('rsvp-success').classList.add('show');
      });
    })
    .catch(function(err) {
      console.error('RSVP error:', err);
      isSubmitting    = false;
      btn.disabled    = false;
      btn.textContent = 'Confirm My Attendance';
      showBannerError(
        'Oops! Something went wrong — please try again.\n\nError: ' + err.message
      );
    });
}
 
/* ── Inline field error ── */
function showFieldError(fieldId, msg) {
  var field = document.getElementById(fieldId);
  if (!field) { alert(msg); return; }
 
  var existingErr = document.getElementById('err-' + fieldId);
  if (existingErr) existingErr.remove();
 
  field.style.borderColor = 'rgba(232,184,75,0.8)';
 
  var errEl = document.createElement('div');
  errEl.id = 'err-' + fieldId;
  errEl.style.cssText =
    'color:#E8B84B;font-size:11px;margin-top:5px;' +
    'font-family:Jost,sans-serif;letter-spacing:0.04em;';
  errEl.textContent = msg;
  field.parentNode.insertBefore(errEl, field.nextSibling);
 
  field.scrollIntoView({ behavior: 'smooth', block: 'center' });
  field.focus();
 
  field.addEventListener('input', function reset() {
    field.style.borderColor = '';
    var el = document.getElementById('err-' + fieldId);
    if (el) el.remove();
    field.removeEventListener('input', reset);
  }, { once: true });
 
  field.addEventListener('change', function resetChange() {
    field.style.borderColor = '';
    var el = document.getElementById('err-' + fieldId);
    if (el) el.remove();
    field.removeEventListener('change', resetChange);
  }, { once: true });
}
 
function clearFieldErrors() {
  ['fname','phone','email','guests','events','side-val'].forEach(function(id) {
    var field = document.getElementById(id);
    if (field) field.style.borderColor = '';
    var err = document.getElementById('err-' + id);
    if (err) err.remove();
  });
  /* Also hide any side-full message when user changes selection */
  var msgEl = document.getElementById('side-full-msg');
  if (msgEl) msgEl.classList.remove('show');
}
 
function showBannerError(msg) {
  var existing = document.getElementById('rsvp-banner-err');
  if (existing) existing.remove();
  var banner = document.createElement('div');
  banner.id = 'rsvp-banner-err';
  banner.style.cssText = [
    'background:rgba(232,184,75,0.08)',
    'border:1px solid rgba(232,184,75,0.35)',
    'border-radius:8px',
    'padding:14px 18px',
    'margin-bottom:20px',
    'color:#E8B84B',
    'font-family:Jost,sans-serif',
    'font-size:13px',
    'white-space:pre-line'
  ].join(';');
  banner.textContent = msg;
  var form = document.getElementById('rsvp-form');
  form.insertBefore(banner, form.firstChild);
  banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
}