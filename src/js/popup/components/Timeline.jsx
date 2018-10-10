import React from "react";
import Tweet from "./Tweet";
import SortedSet from "collections/sorted-set";

import InfiniteScroll from 'react-infinite-scroller';

class Timeline extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      tweets: new SortedSet([], 
        (a,b) => a.id_str === b.id_str,
        (a,b) => BigInt(b.id_str) - BigInt(a.id_str),
      ),
      visible_tweets: [],
      lowest_visible: null,
      highest_visible: null,
      page: 1,
      tweet_at_top_of_screen: null,
    };

    this.containerRef = React.createRef();
  }
  componentDidMount() {
    this.props.twitter.onMessage.addListener(msg => {
      if(msg.type === "tweets") {
        this.addTweets(msg.tweets)
      }
    });
    this.scrollListener = event => {
      let scrollPos = this.containerRef.current.scrollTop;
      let current_top_id = this.state.tweet_at_top_of_screen;
      let current_top = document.getElementById(current_top_id);
      if(!current_top) {
        this.setState((state => ({tweet_at_top_of_screen: state.high_tweet_id})));
        return;
      }
      let rect = current_top.getBoundingClientRect();

      // is top tweet above the screen?
      if(rect.top + rect.height < 0) {
        let topTweetIndex = this.state.tweets.indexOf({id_str: current_top_id});
        let nextTopTweet = this.state.tweets.slice(topTweetIndex + 1, topTweetIndex + 2)[0];
        this.setState({tweet_at_top_of_screen: nextTopTweet.id_str});
        chrome.storage.local.set({tweet_at_top_of_screen: nextTopTweet.id_str});
      }
      if(rect.top > 0) {
        let topTweetIndex = this.state.tweets.indexOf({id_str: current_top_id});
        let nextTopTweet = this.state.tweets.slice(topTweetIndex - 1, topTweetIndex)[0];
        this.setState({tweet_at_top_of_screen: nextTopTweet.id_str});
        if(nextTopTweet.id_str === this.state.high_tweet_id) {
          chrome.storage.local.set({tweet_at_top_of_screen: null});
        }
        else {
          chrome.storage.local.set({tweet_at_top_of_screen: nextTopTweet.id_str});
        }
      }
    };
    this.containerRef.current.addEventListener("scroll", this.scrollListener);
  }

  componentWillUnmount() {
    this.containerRef.current.removeEventListener("scroll", this.scrollListener);
  }

  displayPage(page, cb) {
    this.setState(state => {
      let high_tweet_id = state.high_tweet_id;
      let high_tweet;
      if(!high_tweet_id) {
        high_tweet = state.tweets.min();
        high_tweet_id = high_tweet.id_str;
      }
      else {
        high_tweet = state.tweets.find({id_str: high_tweet_id}).value;
      }

      let high_tweet_index = state.tweets.indexOf(high_tweet);
      let count = page * 20;

      let visible_tweets = state.tweets.slice(high_tweet_index, high_tweet_index + count);
      let moreTweetsAvailable = true;
      if(visible_tweets.length === 0 || state.tweets.length - count <= visible_tweets.length) {
        moreTweetsAvailable = false;
      }

      chrome.storage.sync.set({high_tweet_id});
      
      return {
        visible_tweets,
        moreTweetsAvailable,
        high_tweet_id,
        page,
      };
    }, cb);
  }

  showNewTweets() {
    let highest_tweet_id = this.state.tweets.min().id_str;
    chrome.storage.local.set({tweet_at_top_of_screen: null});
    this.setState({
      high_tweet_id: highest_tweet_id,
      tweet_at_top_of_screen: highest_tweet_id,
    }, () => this.displayPage(this.state.page));
  }

  render() {
    let tweets = this.state.visible_tweets.map(tweet => {
      return <Tweet data={tweet} fetchTweet={this.fetchTweet} key={tweet.id_str} id={tweet.id_str} />
    });
    let highest_tweet = this.state.tweets.min();
    let highest_tweet_id;
    if(highest_tweet) {
      highest_tweet_id = highest_tweet.id_str;
    }
    let high_tweet_id = this.state.high_tweet_id;
    let showing_highest = high_tweet_id === highest_tweet_id;
    let newTweetCount = 0;
    if(high_tweet_id && !showing_highest) {
      newTweetCount = this.state.tweets.indexOf({id_str: high_tweet_id});
      chrome.browserAction.setBadgeText({text: newTweetCount.toString()});
    }
    else {
      chrome.browserAction.setBadgeText({text: ""});
    }
    return (
      <div className="timeline" ref={this.containerRef}>
        {showing_highest ? "" : <button className="showNewerTweets" onClick={this.showNewTweets.bind(this)}>Show {newTweetCount} new tweets</button>}
        <InfiniteScroll
            pageStart={0}
            loadMore={(page)=>this.displayPage(page)}
            hasMore={this.state.moreTweetsAvailable}
            loader={<div className="loader" key={0}>Loading ...</div>}
            useWindow={false}
        >
          {tweets}
        </InfiniteScroll>
      </div>
    );
  }
  addTweets(newTweets) {
    let initialLoad = false;
    if(this.state.tweets.length === 0) {
      initialLoad = true;
    }
    this.setState(state => {
      let newState = {
        tweets: state.tweets.concat(newTweets),
        moreTweetsAvailable: true,
      };

      return newState;
    }, () => {
      if(initialLoad) {
        chrome.storage.local.get("tweet_at_top_of_screen", results => {
          let top_id = results.tweet_at_top_of_screen;
          if(top_id && this.state.tweets.has({id_str: top_id})) {
            this.setState({high_tweet_id: top_id, tweet_at_top_of_screen: top_id}, () => this.displayPage(this.state.page));
          }
          else {
            this.setState({tweet_at_top_of_screen: this.state.tweets.min().id_str}, () => this.displayPage(this.state.page));
          }
        });
      }
      else {
        this.displayPage(this.state.page);
      }
    });
  }
};

export default Timeline;