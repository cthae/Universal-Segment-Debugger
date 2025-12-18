chrome.tabs.onUpdated.addListener(tabChangedCallback);
chrome.tabs.onActivated.addListener(tabChangedCallback);
const state = {};

async function tabChangedCallback(){
  const tab = (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  if (!isTabLegal(tab)){return false;}
  setFavicon();
  messageListenerRouter();
}

main();

chrome.runtime.onStartup.addListener(checkSettings);
chrome.runtime.onInstalled.addListener(checkSettings);

async function main() {
  messageListenerRouter();
  mainListener();
}

function messageListenerRouter() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message === 'removeCookies'){
      deleteAllCookiesOfActiveTab();
    }
  });
}

async function mainListener() {
  const filter = { urls: ["<all_urls>", "http://*/*", "https://*/*"] }//   *://*/*/b/ss/*   --   <all_urls>
  const requests = new Map();
  chrome.webRequest.onBeforeRequest.addListener(async info => {
    const urlType = getUrlType(info.url);
    if (urlType === "segmentAPI" && info.method === "POST" &&
      (info?.requestBody?.raw?.length > 0 || info?.requestBody?.formData || urlType === "Beaconed webSDK")) {
      setFavicon("green");
      let postedString = universalPostParser(info);
      requests.set(info.requestId, {
        info: info,
        postPayload: postedString,
        eventTriggered: "onBeforeRequest - API",
        type: urlType
      });
      setTimeout(processOrphanedRequest, 6000, info.requestId);
    } else if (urlType === "segmentCDN"){
      requests.set(info.requestId, {
        info: info,
        eventTriggered: "onBeforeRequest - CDN",
        type: urlType
      });
    }
  }, filter, ['requestBody']);

  chrome.webRequest.onHeadersReceived.addListener(async info => {
    if (getUrlType(info.url) !== "N/A" && info.statusCode === 200) {
      const postRequest = requests.get(info.requestId);
      if (info.method === "POST" && postRequest) {
        sendToTab(postRequest, info.tabId);
      } else {
        if (/analytics/i.test(info.url)){//the core library
          state.segment.libraryLoaded = true;
          state.segment.sourceId = info.url.match(/\/(\w{30,40})\//)[1];
        } else if (/settings/i.test(info.url)){//the settings
          state.segment.settings = info;
          console.log("the settings have been received, the details are in ", state);
        }
      }
      requests.delete(info?.requestId);
    }
  }, filter);

  chrome.webRequest.onErrorOccurred.addListener(async info => {
    if (getUrlType(info.url) === "segment") {
      sendToTab({
        info: info,
        eventTriggered: "onErrorOccurred"
      }, info.tabId);
    }
    //requests.delete(info?.requestId);
  }, filter);

  async function processOrphanedRequest(requestId) {
    const request = requests.get(requestId);
    if (request) {
      request.eventTriggered = "timeoutError";
      sendToTab(request, request.info.tabId);
    }
  }
}

function getUrlType(url) {
  const segmentCdnEndpoint = state.settings.segmentCdnEndpoint || "cdn.segment.com";
  const segmentApiEndpoint = state.settings.segmentApiEndpoint || "api.segment.io";
  if (url.includes(segmentCdnEndpoint)){
    return "segmentCDN";
  } else if (url.includes(segmentApiEndpoint)){
    return "segmentAPI";
  }
  return "N/A"
}

async function sendToTab(msg, tabIdFromOutside) {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const tabId = tabIdFromOutside || tab.id;
  for (let retry = 0; retry < 20; retry++) {
    try {
      return await chrome.tabs.sendMessage(tabId, msg, { frameId: 0 });
    } catch (err) {
      if (!err.message.includes('Receiving end does not exist')) throw err;
    }
  }
}

function checkSettings(e) {
  chrome.storage.sync.get('settings', function (data) {
    const settings = data?.settings || {};
    settings.aabox = settings.aabox ?? true;
    settings.mainExpand = settings.mainExpand ?? false;
    settings.varsExpand = settings.varsExpand ?? true;
    settings.contextVarsExpand = settings.contextVarsExpand ?? false;
    settings.launchbox = settings.launchbox ?? false;
    settings.sessionRedirections = settings.sessionRedirections ?? true;
    settings.logAllWebSDK = settings.logAllWebSDK ?? false;
    settings.logBoringFieldsWebSDK = settings.logBoringFieldsWebSDK ?? false;
    settings.logDataObject = settings.logDataObject ?? false;
    settings.enableLaunchUIImprovements = settings.enableLaunchUIImprovements ?? true;
    chrome.storage.sync.set({ settings: settings });
    state.settings = settings;
  });
}

function universalPostParser(info) {
  if (info?.requestBody?.raw?.length > 0) { //for when a browser has no clue these are trivial key-value pairs.
    return String.fromCharCode.apply(null, new Uint8Array(info.requestBody.raw[0].bytes));
  } else if (info?.requestBody?.formData) { //for when a browser notices that these are trivial key-value pairs. FF does it. Chrome's algo is broken.
    return Object.keys(info.requestBody.formData).reduce((acc, currKey) => acc + currKey + `=` + encodeURIComponent(info.requestBody.formData[currKey]) + "&", "").slice(0, -1);
  } else {
    return false;
  }
}

async function setFavicon(status) {
  const tab = (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  if (!isTabLegal(tab)){return false;}
  const details = {path: "favicon 16-4 - grey.png", tabId: tab.id};
  //console.log("@@@ Debugging, the environment is", environment[0].result);
  details.path = `../favicon 16-4 - ${status}.png`;
  chrome.action.setIcon(details);
}

function isTabLegal(tab){
  const isLegal = !!tab?.url && !/^(about:|chrome:\/\/)/i.test(tab.url);
  return isLegal;
}

function deleteAllCookiesOfActiveTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs.length) return;
      const url = new URL(tabs[0].url);
      chrome.cookies.getAll({ domain: url.hostname.replace("www.", "") }, (cookies) => {
          cookies.forEach(cookie => {
              chrome.cookies.remove({
                  url: (cookie.secure ? "https://" : "http://") + cookie.domain + cookie.path,
                  name: cookie.name
              });
          });
      });
  });
}