import React from "react";
import Timeline from "./components/Timeline";

class App extends React.Component {
  constructor(props) {
    super(props);

    this.timeline = React.createRef();
    this.twitter = chrome.runtime.connect({name: "twitter"});
  }
  render() {
    return (
      <div>
        <Timeline ref={this.timeline} twitter={this.twitter} />
      </div>
    )
  }
  getTimeline() {
    return this.timeline;
  }
};

export default App;
