import React from "react";
import Timeline from "./components/Timeline";
import TweetComposer from "./components/TweetComposer";

class App extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      composeTweetOpen: false,
    }

    this.timeline = React.createRef();
    this.twitter = chrome.runtime.connect({name: "twitter"});
  }
  toggleTweetComposer = () => {
    this.setState(state => ({composeTweetOpen: !state.composeTweetOpen}));
  }
  render() {
    let tweetComposerSection;
    if(this.state.composeTweetOpen) {
      tweetComposerSection = <TweetComposer close={this.toggleTweetComposer}/>;
    }
    else {
      tweetComposerSection = <button className="send_tweet open_composer" onClick={this.toggleTweetComposer}>Tweet</button>;
    }
    return (
      <>
        {tweetComposerSection}
        <Timeline ref={this.timeline} twitter={this.twitter} replyToTweet={this.replyToTweet}/>
      </>
    )
  }
  getTimeline() {
    return this.timeline;
  }
};

export default App;
