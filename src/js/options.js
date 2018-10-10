import "../css/options.css";

let darkmodeToggle = document.getElementById("darkmode");

chrome.storage.sync.get("darkMode", (response) => {
  if(response.darkMode) {
    darkmodeToggle.checked = true;
  }
});

darkmodeToggle.addEventListener("change", event => {
  chrome.storage.sync.set({darkMode: darkmodeToggle.checked});
});