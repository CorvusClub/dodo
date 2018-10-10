import "../css/popup.css";
import "../fonts/edge-icons-Regular.ttf";

import App from "./popup/App.jsx";
import React from "react";
import { render } from "react-dom";

let app_container = window.document.getElementById("app-container");

chrome.runtime.sendMessage({type: "AUTH"}, account => {
  let app = render(
    <App account={account}/>,
    app_container,
  );
  //chrome.runtime.sendMessage({type: "POLL_TIMELINE"});
});

chrome.storage.sync.get("darkMode", (response) => {
  if(response.darkMode) {
    app_container.classList.add("dark");
  }
});