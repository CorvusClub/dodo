import React from "react";

class Photo extends React.Component {
  render() {
    return (
      <div className="media">
        <img src={this.props.data.media_url_https}></img>
      </div>
    );
  }
}
class Video extends React.Component {
  render() {
    let video = this.props.data;
    let variant = video.video_info.variants.filter(media => media.content_type.match(/mp4/)).sort((a, b) => {b.bitrate - a.bitrate})[0];
    return (
      <video controls={true} src={variant.url}></video>
    );
  }
}
class Gif extends React.Component {
  render() {
    let gif = this.props.data;
    let variant = gif.video_info.variants.sort((a, b) => {b.bitrate - a.bitrate})[0];
    return (
      <video autoPlay={true} muted={true} loop={true} src={variant.url}></video>
    );
  }
}
class Media extends React.Component {
  render() {
    let media = this.props.data.media.map(mediaInstance => {
      if(mediaInstance.type === "photo") {
        return <Photo data={mediaInstance} key={mediaInstance.id_str} />;
      }
      if(mediaInstance.type === "video") {
        return <Video data={mediaInstance} key={mediaInstance.id_str} />;
      }
      if(mediaInstance.type === "animated_gif") {
        return <Gif data={mediaInstance} key={mediaInstance.id_str} />;
      }
    });
    return (
      <div className="media">
        {media}
      </div>
    );
  }
};

export default Media;