import "../img/dodo_128.png";
import secrets from "secrets";
import crypto from "crypto";

class OAuth {
  constructor(consumerKey, consumerSecret) {
    this.consumerKey = consumerKey;
    this.consumerSecret = consumerSecret;
  }
  getTimestamp() {
    let now = (new Date()).getTime();
    return Math.floor(now/1000);
  }
  getNonce() {
    return crypto.randomBytes(16).toString('hex');
  }
  prepareParams(oauth_token, oauth_token_secret, method, url, otherParams) {
    const params = {
      oauth_timestamp: "1318467427", //this.getTimestamp(),
      oauth_nonce: "ea9ec8429b68d6b77cd5600adbbb0456", //this.getNonce(),
      oauth_signature_method: "HMAC-SHA1",
      oauth_consumer_key: this.consumerKey,
      oauth_version: "1.0",
    };
    Object.assign(params, otherParams);
    console.log(params);
    if(oauth_token) {
      params[oauth_token] = oauth_token;
    }
    let signature = this.sign(method, url, params, oauth_token_secret);
    params.oauth_signature = signature;
    return params;
  }
  encode(str) {
    return encodeURIComponent(str)
      .replace(/\!/g, "%21")
      .replace(/\'/g, "%27")
      .replace(/\(/g, "%28")
      .replace(/\)/g, "%29")
      .replace(/\*/g, "%2A");
  }
  sortParams(params) {
    let as_array = [];
    for (const pair of Object.entries(params)) {
      as_array.push(pair.map(this.encode));
    }
    return as_array.sort((a, b) => {
      let keyComp = a[0].localeCompare(b[0]);
      if(keyComp) return keyComp;
      return a[1].localeCompare(b[1]);
    });
  }
  sign(method, url, params, oauth_token_secret="") {
    url = this.encode(url);
    let sorted = this.sortParams(params);
    params = sorted.map(i => `${i[0]}=${i[1]}`).join("&");
    params = this.encode(params);
    oauth_token_secret = this.encode(oauth_token_secret);
    
    let base = `${method}&${url}&${params}`;
    console.log(base);
    let key = this.consumerSecret;

    return crypto.createHmac('sha1', key).update(base).digest('base64');
  }

  async request(oauth_token, oauth_token_secret, method, url, otherParams) {
    let params = this.prepareParams(oauth_token, oauth_token_secret, method, url, otherParams);
    console.log("OAuth " + this.sortParams(params).filter(p => p[0].startsWith("oauth")).map(p => `${p[0]}="${p[1]}"`).join(",\n\t"))
    return fetch(url, {
      headers: new Headers({
        "Authorization": "OAuth " + this.sortParams(params).filter(p => p[0].startsWith("oauth")).map(p => `${p[0]}="${p[1]}"`).join(","),
      }),
      method,
    });
  }

  async getRequestToken(oauth_callback) {
    return this.request(null, null, "POST", "https://api.twitter.com/oauth/request_token", {oauth_callback});
  }
}

const oauth = new OAuth(
  secrets.TWITTER.CONSUMER.KEY,
  secrets.TWITTER.CONSUMER.SECRET,
);
async function getRequestToken() {
  oauth.getRequestToken("http://localhost/sign-in-with-twitter/");
}
getRequestToken();