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

/* ── LocalStorage key used to remember this device already RSVP'd ── */
var RSVP_LOCAL_FLAG = 'wedding_rsvp_submitted';

/* ── Normalize phone numbers for comparison ──
   Strips everything except digits, then keeps the last 9 digits so
   "+27 82 123 4567", "0821234567", and "082 123 4567" all match. */
function normalizePhone(phone) {
  var digits = (phone || '').replace(/\D/g, '');
  return digits.slice(-9);
}

/* ── Check if this phone number has already RSVP'd ──
   Fetches existing phone numbers from Supabase and compares
   normalized values client-side (handles formatting differences). */
function checkDuplicateRSVP(phone) {
  var normalizedInput = normalizePhone(phone);

  return fetch(
    SUPABASE_URL + '/rest/v1/rsvps?select=phone',
    {
      headers: {
        'apikey':        SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY
      }
    }
  ).then(function(res) {
    if (!res.ok) {
      /* If the check itself fails, don't block the guest —
         fail open so a network hiccup doesn't stop a real RSVP. */
      return false;
    }
    return res.json().then(function(rows) {
      return rows.some(function(row) {
        return row.phone && normalizePhone(row.phone) === normalizedInput;
      });
    });
  }).catch(function() {
    return false; /* fail open on network error */
  });
}

/* ── Show the "you've already RSVP'd" message ── */
function showAlreadyRSVPd() {
  var form = document.getElementById('rsvp-form');
  var existing = document.getElementById('rsvp-already-msg');
  if (existing) existing.remove();

  var msg = document.createElement('div');
  msg.id = 'rsvp-already-msg';
  msg.style.cssText = [
    'background:rgba(232,184,75,0.08)',
    'border:1px solid rgba(232,184,75,0.35)',
    'border-radius:8px',
    'padding:16px 18px',
    'margin-bottom:20px',
    'color:#E8B84B',
    'font-family:Jost,sans-serif',
    'font-size:14px',
    'line-height:1.5'
  ].join(';');
  msg.innerHTML =
    '<strong>Looks like you\'ve already RSVP\'d! 💛</strong><br>' +
    'We\'ve already received a response for this phone number, so there\'s no need to submit again. ' +
    'If you need to change your details, please contact us directly.';
  form.insertBefore(msg, form.firstChild);
  msg.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ── Count existing RSVPs (all rows, regardless of attendance) ── */
function countRSVPs() {
  return fetch(
    SUPABASE_URL + '/rest/v1/rsvps?select=id',
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

/* ── Count existing RSVPs for a given side ──
   Excludes guests who said they can't make it (events = 'none'),
   so non-attendees never eat into the 50-person capacity. */
function countSide(side) {
  return fetch(
    SUPABASE_URL + '/rest/v1/rsvps?select=id&side=eq.' + side + '&events=neq.none',
    {
      headers: {
        'apikey':        SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Prefer':        'count=exact',
        'Range':         '0-0'
      }
    }
  ).then(function(res) {
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

/* ── Show the correct success message depending on attendance ── */
function showSuccess(notAttending) {
  document.getElementById('rsvp-form').classList.add('hidden');
  document.getElementById('rsvp-success').classList.add('show');

  var attendingMsg    = document.getElementById('success-attending');
  var notAttendingMsg = document.getElementById('success-not-attending');

  if (attendingMsg)    attendingMsg.style.display    = notAttending ? 'none' : '';
  if (notAttendingMsg) notAttendingMsg.style.display = notAttending ? '' : 'none';
}

/* ── Validate & submit ── */
function submitRSVP() {
  if (isSubmitting) return;

  clearFieldErrors();

  /* ── Quick client-side check: has this device already submitted? ──
     This is just a fast UX shortcut — the authoritative check
     (by phone number, against Supabase) still runs below. */
  if (localStorage.getItem(RSVP_LOCAL_FLAG)) {
    showAlreadyRSVPd();
    return;
  }

  var full_name = document.getElementById("fname").value.trim();
  var phone = document.getElementById("phone").value.trim();
  var email = document.getElementById("email").value.trim();
  var guests = document.getElementById("guests").value;
  var events = document.getElementById("events").value;
  var side = document.getElementById("side-val").value;
  var diet = document.getElementById("diet").value.trim();
  var message = document.getElementById("msg").value.trim();

  var notAttending = events === "none";
  var attendingBoth = events === "both";
  var attendingOne = events === "wedding";

  /* ── Required field validation ──
     - Name, phone, and events are always required.
     - Guest count is only required if they're actually attending.
     - Side is only required if attending BOTH ceremonies. */
  var hasError = false;
  if (!full_name) {
    showFieldError("fname", "Please enter your full name.");
    hasError = true;
  }
  if (!phone) {
    showFieldError("phone", "Please enter your phone number.");
    hasError = true;
  }
  if (!events) {
    showFieldError("events", "Please select which ceremonies.");
    hasError = true;
  }

  if (!notAttending && !guests) {
    showFieldError("guests", "Please select number of guests.");
    hasError = true;
  }

  if (attendingBoth && !side) {
    showFieldError("side-val", "Please choose Bride's side or Groom's side.");
    hasError = true;
  }

  if (attendingOne && !side) {
    showFieldError("side-val", "Please choose Bride's side or Groom's side.");
    hasError = true;
  }

  if (hasError) return;

  /* Email is optional — only validate format if something was entered */
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showFieldError("email", "Please enter a valid email address.");
    return;
  }

  /* Lock UI while we process */
  isSubmitting = true;
  var btn = document.getElementById("submit-btn");
  btn.disabled = true;
  btn.textContent = "Checking your details…";

  var payload = {
    full_name: full_name,
    phone: phone,
    email: email || null,
    guests: notAttending ? null : guests,
    events: events,
    side: attendingBoth ? side : null,
    diet: diet || null,
    message: message || null,
  };

  /* ── Authoritative duplicate check against Supabase by phone ──
     Runs before any save, capacity check, or success message. */
  checkDuplicateRSVP(phone).then(function(isDuplicate) {
    if (isDuplicate) {
      isSubmitting = false;
      btn.disabled = false;
      btn.textContent = "Confirm My Attendance";
      localStorage.setItem(RSVP_LOCAL_FLAG, '1');
      showAlreadyRSVPd();
      return;
    }

    proceedWithSubmission(payload, notAttending, attendingBoth, btn);
  }).catch(function(err) {
    console.error("Duplicate check error:", err);
    /* Fail open — don't block a genuine guest over a network hiccup */
    proceedWithSubmission(payload, notAttending, attendingBoth, btn);
  });
}

/* ── Runs the actual save flow, after the duplicate check has passed ── */
function proceedWithSubmission(payload, notAttending, attendingBoth, btn) {
  btn.textContent = attendingBoth ? "Checking availability…" : "Submitting…";

  /* Guests not attending both ceremonies (i.e. not selecting a side)
     skip the capacity check entirely and save straight away —
     this covers "can't make it", "Umembeso only", and "Wedding only". */

  /* if not attending send a wishing well message */
  if (notAttending) {
    saveRSVP(payload)
      .then(function () {
        localStorage.setItem(RSVP_LOCAL_FLAG, '1');
        document.getElementById("rsvp-form").classList.add("hidden");
        document.getElementById("rsvp-success").classList.add("show");

        /* Show the "You'll Be Missed" message, hide the attending one */
        document.getElementById("success-attending").style.display = "none";
        document.getElementById("success-not-attending").style.display = "";
      })
      .catch(function (err) {
        console.error("RSVP error:", err);
        isSubmitting = false;
        btn.disabled = false;
        btn.textContent = "Confirm My Attendance";
        showBannerError(
          "Oops! Something went wrong — please try again.\n\nError: " +
            err.message,
        );
      });
    return;
  }

  if (!attendingBoth) {
    saveRSVP(payload)
      .then(function () {
        localStorage.setItem(RSVP_LOCAL_FLAG, '1');
        document.getElementById("rsvp-form").classList.add("hidden");
        document.getElementById("rsvp-success").classList.add("show");
      })
      .catch(function (err) {
        console.error("RSVP error:", err);
        isSubmitting = false;
        btn.disabled = false;
        btn.textContent = "Confirm My Attendance";
        showBannerError(
          "Oops! Something went wrong — please try again.\n\nError: " +
            err.message,
        );
      });
    return;
  }

  /* Attending both ceremonies: check side capacity before saving */
  countSide(payload.side)
    .then(function (count) {
      if (count >= SIDE_LIMIT) {
        /* Side is full — unlock form and show message */
        isSubmitting = false;
        btn.disabled = false;
        btn.textContent = "Confirm My Attendance";
        showSideFull(payload.side);
        return;
      }

      /* Capacity available — proceed with save */
      btn.textContent = "Submitting…";

      return saveRSVP(payload).then(function () {
        localStorage.setItem(RSVP_LOCAL_FLAG, '1');
        document.getElementById("rsvp-form").classList.add("hidden");
        document.getElementById("rsvp-success").classList.add("show");

        document.getElementById("success-attending").style.display = "";
        document.getElementById("success-not-attending").style.display = "none";
      });
    })
    .catch(function (err) {
      console.error("RSVP error:", err);
      isSubmitting = false;
      btn.disabled = false;
      btn.textContent = "Confirm My Attendance";
      showBannerError(
        "Oops! Something went wrong — please try again.\n\nError: " +
          err.message,
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
  /* Also hide any already-RSVP'd message */
  var alreadyEl = document.getElementById('rsvp-already-msg');
  if (alreadyEl) alreadyEl.remove();
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

/* ═══════════════════════════════════════════════
   SHOW SIDE-PICKER ONLY WHEN ATTENDING BOTH EVENTS
   Runs once the DOM is ready so the elements exist.
═══════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function() {
  /* If this device has already RSVP'd, show the message right away */
  if (localStorage.getItem(RSVP_LOCAL_FLAG)) {
    showAlreadyRSVPd();
  }

  var eventsSelect = document.getElementById('events');
  var sideField    = document.getElementById('side-field');
  if (!eventsSelect || !sideField) return;

  function toggleSideField() {
    if (eventsSelect.value === 'both') {
      sideField.style.display = '';
    } 
    else if (eventsSelect.value === 'wedding') {
      sideField.style.display = '';
    }else {
      sideField.style.display = 'none';
      /* Reset any previously chosen side so a stale choice never
         gets submitted silently if the guest changes their mind */
      var sideVal   = document.getElementById('side-val');
      var brideCard = document.getElementById('bride-card');
      var groomCard = document.getElementById('groom-card');
      if (sideVal) sideVal.value = '';
      if (brideCard) {
        brideCard.classList.remove('chosen');
        brideCard.setAttribute('aria-pressed', 'false');
      }
      if (groomCard) {
        groomCard.classList.remove('chosen');
        groomCard.setAttribute('aria-pressed', 'false');
      }
    }
  }

  eventsSelect.addEventListener('change', toggleSideField);
  toggleSideField(); // run once on load in case of pre-filled values
});T = 50;
 
var isSubmitting = false;
 
/* ── Count existing RSVPs (all rows, regardless of attendance) ── */
function countRSVPs() {
  return fetch(
    SUPABASE_URL + '/rest/v1/rsvps?select=id',
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
 
/* ── Count existing RSVPs for a given side ──
   Excludes guests who said they can't make it (events = 'none'),
   so non-attendees never eat into the 50-person capacity. */
function countSide(side) {
  return fetch(
    SUPABASE_URL +
      "/rest/v1/rsvps?select=guests&side=eq." +
      side +
      "&events=neq.none",
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: "Bearer " + SUPABASE_KEY,
      },
    },
  )
    .then(function (res) {
      return res.json();
    })
    .then(function (rows) {
      return rows.reduce(function (sum, r) {
        return sum + (parseInt(r.guests, 10) || 0);
      }, 0);
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

/* ── Show the correct success message depending on attendance ── */
function showSuccess(notAttending) {
  document.getElementById('rsvp-form').classList.add('hidden');
  document.getElementById('rsvp-success').classList.add('show');
 
  var attendingMsg    = document.getElementById('success-attending');
  var notAttendingMsg = document.getElementById('success-not-attending');
 
  if (attendingMsg)    attendingMsg.style.display    = notAttending ? 'none' : '';
  if (notAttendingMsg) notAttendingMsg.style.display = notAttending ? '' : 'none';
}
 
/* ── Validate & submit ── */
function submitRSVP() {
  if (isSubmitting) return;

  clearFieldErrors();

  var full_name = document.getElementById("fname").value.trim();
  var phone = document.getElementById("phone").value.trim();
  var email = document.getElementById("email").value.trim();
  var guests = document.getElementById("guests").value;
  var events = document.getElementById("events").value;
  var side = document.getElementById("side-val").value;
  var diet = document.getElementById("diet").value.trim();
  var message = document.getElementById("msg").value.trim();

  var notAttending = events === "none";
  var attendingBoth = events === "both";
  var attendingOne = events === "wedding";

  /* ── Required field validation ──
     - Name, phone, and events are always required.
     - Guest count is only required if they're actually attending.
     - Side is only required if attending BOTH ceremonies. */
  var hasError = false;
  if (!full_name) {
    showFieldError("fname", "Please enter your full name.");
    hasError = true;
  }
  if (!phone) {
    showFieldError("phone", "Please enter your phone number.");
    hasError = true;
  }
  if (!events) {
    showFieldError("events", "Please select which ceremonies.");
    hasError = true;
  }

  if (!notAttending && !guests) {
    showFieldError("guests", "Please select number of guests.");
    hasError = true;
  }

  if (attendingBoth && !side) {
    showFieldError("side-val", "Please choose Bride's side or Groom's side.");
    hasError = true;
  }

  if (attendingOne && !side) {
    showFieldError("side-val", "Please choose Bride's side or Groom's side.");
    hasError = true;
  }

  if (hasError) return;

  /* Email is optional — only validate format if something was entered */
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showFieldError("email", "Please enter a valid email address.");
    return;
  }

  /* Lock UI while we process */
  isSubmitting = true;
  var btn = document.getElementById("submit-btn");
  btn.disabled = true;
  btn.textContent = attendingBoth ? "Checking availability…" : "Submitting…";

  var payload = {
    full_name: full_name,
    phone: phone,
    email: email || null,
    guests: notAttending ? null : guests,
    events: events,
    side: attendingBoth ? side : null,
    diet: diet || null,
    message: message || null,
  };

  /* Guests not attending both ceremonies (i.e. not selecting a side)
     skip the capacity check entirely and save straight away —
     this covers "can't make it", "Umembeso only", and "Wedding only". */

  /* if not attending send a wishing well message */
  if (notAttending) {
    saveRSVP(payload)
      .then(function () {
        document.getElementById("rsvp-form").classList.add("hidden");
        document.getElementById("rsvp-success").classList.add("show");

        /* Show the "You'll Be Missed" message, hide the attending one */
        document.getElementById("success-attending").style.display = "none";
        document.getElementById("success-not-attending").style.display = "";
      })
      .catch(function (err) {
        console.error("RSVP error:", err);
        isSubmitting = false;
        btn.disabled = false;
        btn.textContent = "Confirm My Attendance";
        showBannerError(
          "Oops! Something went wrong — please try again.\n\nError: " +
            err.message,
        );
      });
    return;
  }

  if (!attendingBoth) {
    saveRSVP(payload)
      .then(function () {
        document.getElementById("rsvp-form").classList.add("hidden");
        document.getElementById("rsvp-success").classList.add("show");
      })
      .catch(function (err) {
        console.error("RSVP error:", err);
        isSubmitting = false;
        btn.disabled = false;
        btn.textContent = "Confirm My Attendance";
        showBannerError(
          "Oops! Something went wrong — please try again.\n\nError: " +
            err.message,
        );
      });
    return;
  }

  /* Attending both ceremonies: check side capacity before saving */
  countSide(side)
    .then(function (count) {
      if (count >= SIDE_LIMIT) {
        /* Side is full — unlock form and show message */
        isSubmitting = false;
        btn.disabled = false;
        btn.textContent = "Confirm My Attendance";
        showSideFull(side);
        return;
      }

      /* Capacity available — proceed with save */
      btn.textContent = "Submitting…";

      return saveRSVP(payload).then(function () {
        document.getElementById("rsvp-form").classList.add("hidden");
        document.getElementById("rsvp-success").classList.add("show");

        document.getElementById("success-attending").style.display = "";
        document.getElementById("success-not-attending").style.display = "none";
      });
    })
    .catch(function (err) {
      console.error("RSVP error:", err);
      isSubmitting = false;
      btn.disabled = false;
      btn.textContent = "Confirm My Attendance";
      showBannerError(
        "Oops! Something went wrong — please try again.\n\nError: " +
          err.message,
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
 
/* ═══════════════════════════════════════════════
   SHOW SIDE-PICKER ONLY WHEN ATTENDING BOTH EVENTS
   Runs once the DOM is ready so the elements exist.
═══════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function() {
  var eventsSelect = document.getElementById('events');
  var sideField    = document.getElementById('side-field');
  if (!eventsSelect || !sideField) return;
 
  function toggleSideField() {
    if (eventsSelect.value === 'both') {
      sideField.style.display = '';
    } 
    else if (eventsSelect.value === 'wedding') {
      sideField.style.display = '';
    }else {
      sideField.style.display = 'none';
      /* Reset any previously chosen side so a stale choice never
         gets submitted silently if the guest changes their mind */
      var sideVal   = document.getElementById('side-val');
      var brideCard = document.getElementById('bride-card');
      var groomCard = document.getElementById('groom-card');
      if (sideVal) sideVal.value = '';
      if (brideCard) {
        brideCard.classList.remove('chosen');
        brideCard.setAttribute('aria-pressed', 'false');
      }
      if (groomCard) {
        groomCard.classList.remove('chosen');
        groomCard.setAttribute('aria-pressed', 'false');
      }
    }
  }
 
  eventsSelect.addEventListener('change', toggleSideField);
  toggleSideField(); // run once on load in case of pre-filled values
});
 