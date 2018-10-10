let urlParams = new URLSearchParams(window.location.search);
let token = urlParams.get('oauth_token');
let verifier = urlParams.get('oauth_verifier');
if(token && verifier) {
  chrome.runtime.sendMessage({type: "AUTH_CALLBACK", oauthData: {token, verifier}});
  window.close();
}