import React from "react";

import twitterText from 'twitter-text';

function getCaretPosition(editable) {
  if(document.activeElement !== editable) {
    return 0;
  }
  let selection = document.getSelection();
  let position = selection.anchorOffset;
  let node = selection.anchorNode;
  if(node === editable) {
    return position;
  }
  let parent = node.parentElement;
  do {
    for(let child of parent.childNodes) {
      if(child === node) {
        break;
      }
      let text = child.innerText;
      if(child.nodeType === Node.TEXT_NODE) {
        text = child.textContent;
      }
      if(text) {
        position += text.length;
      }
    }
    node = parent;
    parent = node.parentElement;
  } while(node && node !== editable);
  return position;
}
function findRangeInNode(node, caretPos) {
  let range = document.createRange();
  let position = 0;

  for(let child of node.childNodes) {
    let text = child.innerText;
    if(child.nodeType === Node.TEXT_NODE) {
      text = child.textContent;
    }
    if(!text) {
      continue;
    }
    // found it
    if(position + text.length >= caretPos) {
      if(child.nodeType === Node.TEXT_NODE) {
        range.setStart(child, caretPos - position);
        return range;
      }
      else {
        return findRangeInNode(child, caretPos - position);
      }
    }
    position += text.length;
  }
  return range;
}
function fixCaret(editable, caretPos) {
  let selection = document.getSelection();
  let range = findRangeInNode(editable, caretPos);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
  editable.focus();
};

class TweetComposer extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      tweetText: "",
      parsedTweet: twitterText.parseTweet(""),
      sendingTweet: false,
    };
    this.editor = React.createRef();
  }
  handleChange = () => {
    let el = this.editor.current;
    let text = el.innerText.replace(/\n\n/g, "\n");
    let caretPos = getCaretPosition(el);

    let original_text = text
      .replace(`<span class="extra_text">`, "")
      .replace(`</span>`, "");
    
    let parsedTweet = twitterText.parseTweet(original_text);
    if(parsedTweet.validRangeEnd < parsedTweet.weightedLength - 1) {
      let valid_length = parsedTweet.validRangeEnd - parsedTweet.validRangeStart;
      text = 
        original_text.slice(parsedTweet.validRangeStart, valid_length + 1) +
        `<span class="extra_text">${original_text.slice(parsedTweet.validRangeEnd + 1)}</span>`;
      text = text.replace(/\n/g, "<br/>").replace(/  /g, " &nbsp;");
      this.editor.current.innerHTML = text;
      fixCaret(el, caretPos);
    }
    
    this.setState({tweetText: original_text, parsedTweet});
  }
  handlePaste = () => {
    this.editor.current.innerHTML = this.editor.current.innerText.replace(/\n/g, "<br/>").replace(/  /g, " &nbsp;");
  }
  sendTweet = () => {
    this.setState({sendingTweet: true});
    let message = {type: "POST_TWEET", text: this.state.tweetText};
    if(this.props.inReplyTo) {
      message.text = `@${this.props.inReplyTo.user.screen_name} ${message.text}`;
      message.in_reply_to_status_id = this.props.inReplyTo.id_str;
    }
    chrome.runtime.sendMessage(message, (response) => {
      this.setState({
        sendingTweet: false,
      });

      if(response.err) {
        // TODO: show error somehow
        console.error(err);
      }
      else if(response.success) {
        this.editor.current.innerHTML = "";
        this.handleChange();
      }
    });
  }
  render() {
    let parsedTweet = this.state.parsedTweet;
    return (
      <div className="tweet_compose">
        <div disabled={this.state.sendingTweet} contentEditable={true} ref={this.editor} className="editor" onInput={this.handleChange} onPaste={this.handlePaste}/>
        <span className="character_count">{parsedTweet.weightedLength}</span>
        <span className="Icon Icon--close Icon--medium close" onClick={this.props.close}></span>
        <div className="tweet_buttons">
          <button className="send_tweet" disabled={!parsedTweet.valid || this.state.sendingTweet} onClick={this.sendTweet}>Tweet</button>
        </div>
      </div>
    );
  }
};

export default TweetComposer;