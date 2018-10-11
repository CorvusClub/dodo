import React from "react";

import Media from "./Media";

import formatDistance from 'date-fns/formatDistance';
import formatRelative from 'date-fns/formatRelative';
import differenceInCalendarDays from 'date-fns/differenceInCalendarDays';
import parse from 'date-fns/parse';

import twemoji from 'twemoji';
import ReactHtmlParser from 'react-html-parser';

const TWITTER_DATE_FORMAT = "eee MMM dd HH:mm:ss xxxx yyyy";

function formatDate(twitterDateString) {
  let now = new Date();
  let date = parse(twitterDateString, TWITTER_DATE_FORMAT, now);
  let diff = differenceInCalendarDays(now, date);
  if(diff > 0) {
    return formatRelative(date, now);
  }
  else {
    return formatDistance(date, now, {addSuffix: true});
  }
}

class Tweet extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      showing_reply: false,
      reply_tweet: null,
      retweeted: props.data.retweeted,
      favorited: props.data.favorited,
    };
  }
  parseEntities(tweet) {
    let text = tweet.full_text;
    let entities = tweet.entities;
    let extended_entities = tweet.extended_entities;

    let graphemes = [...text];

    let accumulatedLength = 0;

    let ents = [];
    entities.hashtags.forEach(e => e.type="hashtag");
    entities.urls.forEach(e => e.type="url");
    entities.user_mentions.forEach(e => e.type="mention");
    ents = ents.concat(entities.hashtags, entities.urls, entities.user_mentions);
    
    if(extended_entities) {
      let photo = extended_entities.media.find(media => media.type === "photo");
      if(photo) {
        ents.push(photo);
      }
      let video = extended_entities.media.find(media => media.type === "video");
      if(video) {
        ents.push(video);
      }
      let gif = extended_entities.media.find(media => media.type === "animated_gif");
      if(gif) {
        ents.push(gif);
      }
    }
    ents.sort((a, b) => a.indices[0] - b.indices[0]);


    ents.forEach(ent => {
      let startIndex = ent.indices[0];
      let endIndex = ent.indices[1];
      let start = graphemes.slice(0, startIndex + accumulatedLength);
      let end = graphemes.slice(endIndex + accumulatedLength);

      let length = 0;
      let insertion = "";

      if(ent.type === "hashtag") {
        insertion = [...`<a class="hashtag" href="https://twitter.com/hashtag/${ent.text}?src=hash" target="_blank">#${ent.text}</a>`];
        length = insertion.length - (ent.text.length + 1);
      }
      if(ent.type === "url") {
        insertion = [...`<a class="external_link" href="${ent.url}" target="_blank">${ent.expanded_url}</a>`];
        length = insertion.length - ent.url.length;
      }
      if(ent.type === "mention") {
        insertion = [...`<a class="mention" href="https://twitter.com/${ent.screen_name}" target="_blank">@${ent.screen_name}</a>`];
        length = insertion.length - (ent.screen_name.length + 1);
      }
     
      graphemes = start.concat(insertion, end);
      accumulatedLength += length;
    });

    text = graphemes.join("");

    text = text.replace(/\n/g, "<br />");

    text = twemoji.parse(text, {folder: "svg",ext: '.svg'});

    return ReactHtmlParser(text);
  }
  toggleShowReply() {
    this.setState((state, props) => {
      let showing_reply = !state.showing_reply;
      if(showing_reply && !state.reply_tweet) {
        let reply_id = props.data.in_reply_to_status_id_str || props.data.retweeted_status.in_reply_to_status_id_str;
        this.fetchTweet(reply_id, reply => {
          this.setState({reply_tweet: reply});
        });
      }
      return {showing_reply}
    });
  }
  toggleRT() {
    this.setState((state, props) => {
      let id_str = props.data.id_str;
      let retweeted = !state.retweeted;
      if(retweeted) {
        chrome.runtime.sendMessage({type: "RETWEET", id_str});
        props.data.retweet_count++;
      }
      else {
        chrome.runtime.sendMessage({type: "UNRETWEET", id_str});
        props.data.retweet_count--;
      }
      return {
        retweeted
      };
    });
  }
  toggleFav() {
    this.setState((state, props) => {
      let id_str = props.data.id_str;
      let favorited = !state.favorited;
      if(favorited) {
        chrome.runtime.sendMessage({type: "FAVORITE", id_str});
        props.data.favorite_count++;
      }
      else {
        chrome.runtime.sendMessage({type: "UNFAVORITE", id_str});
        props.data.favorite_count--;
      }
      return {
        favorited
      };
    });
  }
  fetchTweet(id_str, callback) {
    chrome.runtime.sendMessage({type: "GET_TWEET", id_str}, callback);
  }
  render() {
    let tweet = this.props.data;
    let source_user = tweet.user;
    let is_rt = false;
    let is_reply = false;
    let is_quote = false;
    
    if(tweet.retweeted_status) {
      tweet = tweet.retweeted_status;
      is_rt = true;
    }
    if(tweet.quoted_status) {
      is_quote = true;
    }
    if(tweet.in_reply_to_status_id_str) {
      is_reply = true;
    }
    let reply = "";
    if(this.state.showing_reply && this.state.reply_tweet) {
      reply = <Tweet data={this.state.reply_tweet} />;
    }
    let user = tweet.user;

    return (
      <div className="tweet" id={this.props.id}>
        <a href={`https://twitter.com/${user.screen_name}`} target="_blank">
          <img className="profile_image" src={user.profile_image_url_https} />
        </a>
        <a className="name" href={`https://twitter.com/${user.screen_name}`} target="_blank">
          <span className="display_name">{ReactHtmlParser(twemoji.parse(user.name))}</span>
          <span className="screen_name">@{user.screen_name}</span>
        </a>
        {is_rt ? <a className="name" href={`https://twitter.com/${source_user.screen_name}`} target="_blank">
          <img className="profile_image source" src={source_user.profile_image_url_https} />
        </a> : ""}
        <div className="content">
          <span className="tweet_text">{this.parseEntities(tweet)}</span>
          {tweet.extended_entities ? <Media data={tweet.extended_entities}/> : ""}
          {tweet.quoted_status ? <Tweet data={tweet.quoted_status} /> : ""}
        </div>
        <div className="buttons">
          <button className="rtButton" className={this.state.retweeted ? "retweeted" : ""} onClick={() => this.toggleRT()}><span className="Icon Icon--medium Icon--retweet"></span></button>
          <span className="retweetCount">{tweet.retweet_count > 0 ? tweet.retweet_count : ""}</span>
          <button className="favoriteButton" className={this.state.favorited ? "favorited" : ""} onClick={() => this.toggleFav()}><span className="Icon Icon--heart Icon--medium"></span></button>
          <span className="favoriteCount">{tweet.favorite_count > 0 ? tweet.favorite_count : ""}</span>
        </div>
        <span className="footer">
          <a className="timestamp" href={`https://twitter.com/${user.screen_name}/status/${tweet.id_str}`} target="_blank" title={tweet.created_at}>
            {formatDate(tweet.created_at)}
          </a>
          {is_quote ? <a className="quote_by" href={"https://twitter.com/" + tweet.quoted_status.user.screen_name} target="_blank"> quoting @{tweet.quoted_status.user.screen_name}</a> : ""}
          {is_reply ? <a className="reply_by" onClick={() => this.toggleShowReply()}> in reply to @{tweet.in_reply_to_screen_name}</a> : ""}
          {is_rt ? <a className="rt_by" href={"https://twitter.com/" + source_user.screen_name} target="_blank"> retweeted by @{source_user.screen_name}</a> : ""}
        </span>
        {reply}
      </div>
    );
  }
};

export default Tweet;