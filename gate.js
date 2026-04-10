// Gate: redirect non-logged-in visitors to custom landing page
try {
  var stored = localStorage.getItem('vuex-lz');
  if (stored) {
    var parsed = JSON.parse(stored);
    if (parsed && parsed.oauth && parsed.oauth.userToken) {
      // Logged in - do nothing, let Pleroma-FE load
    } else {
      window.location.replace('/static/social.html');
    }
  } else {
    window.location.replace('/static/social.html');
  }
} catch(e) {
  window.location.replace('/static/social.html');
}
