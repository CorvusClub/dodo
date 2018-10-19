import "../img/dodo_128.png";
import "../img/heart.png";
import secrets from "secrets";
import {OAuth} from "oauth";
import SortedSet from "collections/sorted-set";

const oauth = new OAuth(
  "https://api.twitter.com/oauth/request_token",
  "https://api.twitter.com/oauth/access_token",
  secrets.TWITTER.CONSUMER.KEY,
  secrets.TWITTER.CONSUMER.SECRET,
  "1.0",
  chrome.runtime.getURL("oauth_callback.html"),
  "HMAC-SHA1",
);
async function getAuthToken() {
  return new Promise((resolve, reject) => {
    oauth.getOAuthRequestToken((err, token, tokenSecret, results) => {
      if(err) return reject(err);
      if(results.oauth_callback_confirmed) {
        return resolve({token, tokenSecret});
      }
      reject("oauth callback rejected");
    })
  })
}

async function getAccessToken(oauthData) {
  return new Promise((resolve, reject) => {
    oauth.getOAuthAccessToken(oauthData.token, oauthData.tokenSecret, oauthData.verifier, 
      (err, accessToken, accessTokenSecret, results) => {
        if(err) return reject(err);
        resolve({accessToken, accessTokenSecret, account: results});
    });
  });
}

let highest_id, lowest_id;

const tweetMap = new Map();
const tweetsInOrder = new SortedSet([], 
  (a,b) => a.id_str === b.id_str,
  (a,b) => BigInt(b.id_str) - BigInt(a.id_str),
);

function getTweets(max_id) {
  if(!twitter_auth.accessToken) {
    return;
  }

  let params = {
    count: 200,
    tweet_mode: "extended",
  };
  if(!max_id && highest_id !== undefined) {
    params.since_id = highest_id;
  }
  else if(max_id) {
    params.max_id = max_id;
  }

  params = Object.entries(params).map(([k, v]) => `${k}=${v}`).join("&");

  oauth.get(`https://api.twitter.com/1.1/statuses/home_timeline.json?${params}`,
    twitter_auth.accessToken,
    twitter_auth.accessTokenSecret,
    (err, responseData, result) => {
      if(err) {
        return console.error(err);
      }
      let data;
      try {
        data = JSON.parse(responseData);
      }
      catch(err) {
        return console.error(err);
      }
      data.forEach(tweet => {
        let id = BigInt(tweet.id);
        if(!highest_id || id > highest_id) {
          highest_id = id;
        }
        tweetMap.set(tweet.id_str, tweet);
        tweetsInOrder.add(tweet);
      });
      broadcast({type: "tweets", tweets: data})
      chrome.storage.sync.get(["high_tweet_id"], data => {
        let highest_tweet = tweetsInOrder.min();
        let highest_tweet_id;
        if(highest_tweet) {
          highest_tweet_id = highest_tweet.id_str;
        }
        let high_tweet_id = data.high_tweet_id;
        let showing_highest = high_tweet_id === highest_tweet_id;
        let newTweetCount = 0;
        if(high_tweet_id && !showing_highest) {
          newTweetCount = tweetsInOrder.indexOf({id_str: high_tweet_id});
          chrome.browserAction.setBadgeText({text: newTweetCount.toString()});
        }
        else {
          chrome.browserAction.setBadgeText({text: ""});
        }
      });
    });
}
function get_timeline() {
  getTweets();
}

function get_twitter_config() {
  oauth.get(`https://api.twitter.com/1.1/help/configuration.json`,
        twitter_auth.accessToken,
        twitter_auth.accessTokenSecret,
        (err, responseData, result) => {
          if(err) {
            return console.error(err);
          }
          let data;
          try {
            data = JSON.parse(responseData);
          }
          catch(err) {
            return console.error(err);
          }
          chrome.storage.local.set({twitter_config: data});
        }
      );
}

let authCallback = () => {};

let twitter_auth = {};

chrome.storage.sync.get(["accessToken", "accessTokenSecret", "account"], items => {
  if(items) {
    twitter_auth = items;
    get_timeline();
    get_twitter_config();
  }
});
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if(msg.type === "AUTH") {
    if(twitter_auth.accessToken) {
      return reply(twitter_auth.account);
    }
    getAuthToken().then(async oauthData => {
      let url = `https://api.twitter.com/oauth/authenticate?oauth_token=${oauthData.token}`;
      chrome.tabs.create({url});
      let callbackData = await new Promise(resolve => { authCallback = resolve} );
      oauthData.verifier = callbackData.verifier;
      let access = await getAccessToken(oauthData);
      chrome.storage.sync.set(access);
      twitter_auth = access;
      reply(access.account);
      get_twitter_config();
    });
    return true;
  }
  if(msg.type === "AUTH_CALLBACK") {
    authCallback(msg.oauthData);
  }
  if(msg.type === "POLL_TIMELINE") {
    get_timeline();
  }
  if(msg.type === "GET_TWEET") {
    if(tweetMap.has(msg.id_str)) {
      return reply(tweetMap.get(msg.id_str));
    }
    oauth.get(`https://api.twitter.com/1.1/statuses/show/${msg.id_str}.json?tweet_mode=extended`,
      twitter_auth.accessToken,
      twitter_auth.accessTokenSecret,
      (err, responseData, result) => {
        if(err) {
          return console.error(err);
        }
        let data;
        try {
          data = JSON.parse(responseData);
        }
        catch(err) {
          return console.error(err);
        }
        tweetMap.set(data.id_str, data);
        reply(data);
      }
    );

    return true;
  }
  if(msg.type === "LOAD_OLD_TWEETS") {
    getTweets(msg.old_id);
  }
  
  if(msg.type === "POST_TWEET") {
    let tweetBody = {status: msg.text};
    if(msg.in_reply_to_status_id) {
      tweetBody.in_reply_to_status_id = msg.in_reply_to_status_id;
    }
    oauth.post(`https://api.twitter.com/1.1/statuses/update.json?tweet_mode=extended`,
      twitter_auth.accessToken,
      twitter_auth.accessTokenSecret,
      tweetBody,
      (err, responseData, result) => {
        if(err) {
          console.error(err);
          return reply({err});
        }
        let data;
        try {
          data = JSON.parse(responseData);
        }
        catch(err) {
          console.error(err);
          return reply({err});
        }
        tweetMap.set(data.id_str, data);
        tweetsInOrder.push(data);
        reply({err: null, success: true});
        broadcast({type: "tweets", tweets: [data]})
      }
    );

    return true;
  }
  if(msg.type === "RETWEET") {
    oauth.post(`https://api.twitter.com/1.1/statuses/retweet/${msg.id_str}.json`,
      twitter_auth.accessToken,
      twitter_auth.accessTokenSecret,
      null,
      () => {},
    );
  }
  if(msg.type === "UNRETWEET") {
    oauth.post(`https://api.twitter.com/1.1/statuses/unretweet/${msg.id_str}.json`,
      twitter_auth.accessToken,
      twitter_auth.accessTokenSecret,
      null,
      () => {},
    );
  }
  
  if(msg.type === "FAVORITE") {
    oauth.post(`https://api.twitter.com/1.1/favorites/create.json?id=${msg.id_str}`,
      twitter_auth.accessToken,
      twitter_auth.accessTokenSecret,
      null,
      () => {},
    );
  }
  if(msg.type === "UNFAVORITE") {
    oauth.post(`https://api.twitter.com/1.1/favorites/destroy.json?id=${msg.id_str}`,
      twitter_auth.accessToken,
      twitter_auth.accessTokenSecret,
      null,
      () => {},
    );
  }
});

const ports = new Set();
chrome.runtime.onConnect.addListener(port => {
  ports.add(port);
  port.onDisconnect.addListener((disconnected) => {
    ports.delete(disconnected);
  })
  port.onMessage.addListener(msg => {

  });
  let length = tweetsInOrder.length > 200 ? 200 : 0;
  let tweets = tweetsInOrder.slice(0, length);
  port.postMessage({type: "tweets", tweets});
});

function broadcast(msg) {
  ports.forEach(port => {
    port.postMessage(msg);
  });
}

chrome.alarms.create("timeline_poll", {delayInMinutes: 1, periodInMinutes: 1.5});
chrome.alarms.create("cleanup_tweets", {delayInMinutes: 10, periodInMinutes: 60});
chrome.alarms.onAlarm.addListener(alarm => {
  if(alarm.name === "timeline_poll") {
    get_timeline();
  }
  if(alarm.name === "cleanup_tweets") {
    tweetMap.clear();
    tweetsInOrder.clear()
    get_timeline();
  }
});