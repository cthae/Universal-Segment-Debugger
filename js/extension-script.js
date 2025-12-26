document.addEventListener('DOMContentLoaded', async () => {
  const tabId = (await chrome.tabs.query({ active: true, currentWindow: true }))[0].id;
  updateVersion(chrome.runtime.getManifest().version);
  deployClickListeners();
  await loadSettings();
  const client = await getValuesFromClient();
  const stateFromBg = await chrome.runtime.sendMessage({action: "bgGetSegmentState"});
  console.log("state from background is: ", stateFromBg);
  updatePage(await checkStatus(client.pageLoadTime, stateFromBg?.[tabId]));
});

function updateVersion(version){
  document.getElementsByName("version").forEach((element) => {element.innerText = version});
}

async function getValuesFromClient(){
  const client = {};
  client.timing = JSON.parse(await getTiming());
  client.pageLoadTime = client.timing.toFixed(0);
  console.log('client is ');
  console.log(JSON.stringify(client, null, 4));
  return client;
}

function deployClickListeners() {
  document.querySelectorAll("button.tablinks").forEach((button) => {
    button.addEventListener("click", switchTab);
  });
  document.getElementById("segmentWorkspace").addEventListener("input", segmentWorkspaceChanged);
  document.getElementById("setRedirection").addEventListener("click", setRedirection);
  document.getElementById("delAllRedirections").addEventListener("click", removeAllRedirections);
  document.getElementById("newlib").addEventListener("click", evnt => {event.target.innerText=""});
  document.getElementById("blockPageUnload").addEventListener("click", blockPageUnload);
  document.getElementById("OTCheckConsent").addEventListener("click", OTCheckConsent);
  document.getElementById("OTOpenManager").addEventListener("click", OTOpenManager);
  document.getElementById("OTRejectAll").addEventListener("click", OTRejectAll);
  document.getElementById("OTAllowAll").addEventListener("click", OTAllowAll);
  document.getElementById("raccoon").addEventListener("click", loveTheRaccoon);
  document.getElementById("defaultTab").addEventListener("change", defaultTabChange);
  document.getElementById("themeSwitcher").addEventListener("click", switchTheme);
  document.getElementById("clearCookies").addEventListener("click", clearCookies);
  document.getElementById("resetColors").addEventListener("click", resetColors);
}

function segmentWorkspaceChanged(event){
  updateDynamicBookmarks();
}

function resetColors(event){
  const changeEvent = new Event("change");
  document.querySelectorAll("input[type='color']").forEach(input => {
    input.value = input.getAttribute("data-value");
    input.dispatchEvent(changeEvent);
  });  
}

function clearCookies(event){
  executeOnPage("", () => {
    localStorage.clear();
    sessionStorage.clear();
  });
  chrome.runtime.sendMessage("removeCookies");
  event.target.classList = "success";
  event.target.innerText = "Done!";
}

function switchTheme(event){
  const icon = event.target;
  const css = document.getElementById("cssTheme");
  chrome.storage.sync.get('settings', function (data) {
    if(icon.innerText.includes("☀️")){
      icon.innerText = "🌙";
      css.href = "css/water_light.css";
      data.settings.themeSwitcher = "light";
      console.log("theme switched, the themeSwitcher is " + data.settings.themeSwitcher);
    } else {
      icon.innerText = "☀️";
      css.href = "css/water_dark.css";
      data.settings.themeSwitcher = "dark";
      console.log("theme switched, the themeSwitcher is " + data.settings.themeSwitcher);
    }
    chrome.storage.sync.set({settings:data.settings});
  });
}

function defaultTabChange(event){
  chrome.storage.sync.get('settings', function (data) {
    data.settings.defaultTab = event.target.value;
    chrome.storage.sync.set({settings:data.settings});
  });
}

function openChromeFlags(){
  chrome.tabs.create({url: 'chrome://flags/#enable-force-dark'});
}
function setLoggingHeadings(event){
  const textArea = document.getElementById("loggingHeadings");
  textArea.value = textArea.value.replace(/\s/g, "").replace(/[^a-zA-Z0-9\-,\._]/g, "");
  let queryParams = []
  if(textArea.value.length === 0){
    event.target.classList = "error";
    event.target.innerText = "Cleared!";
  } else {
    event.target.classList = "success";
    event.target.innerText = "Set!";
    queryParams = textArea.value.split(",").map(param => param.replace(/^xdm\./,"").trim()).filter(Boolean);
  }
  chrome.storage.sync.get('settings', function (data) {
    data.settings.loggingHeadings = queryParams;
    chrome.storage.sync.set({settings:data.settings});
  });
}

function loveTheRaccoon(event){
  event.target.innerText = "😻";
  setTimeout(() => event.target.innerText = "🦝", 6000);
}

async function OTAllowAll(event){
  const result = await executeOnPage("", () => {
    if (typeof Optanon === "undefined"){
      return false;
    } else {
      Optanon.AllowAll();
      return true;
    }
  });
  if (result){
    event.target.classList = "success";
    event.target.innerText = "Done!";
  } else {
    event.target.classList = "error";
    event.target.innerText = "No Optanon!";
  }
}

async function OTRejectAll(event){
  const result = await executeOnPage("", () => {
    if (typeof Optanon === "undefined"){
      return false;
    } else {
      Optanon.RejectAll();
      return true;
    }
  });
  if (result){
    event.target.classList = "success";
    event.target.innerText = "Done!";
  } else {
    event.target.classList = "error";
    event.target.innerText = "No Optanon!";
  }
}

async function OTOpenManager(event){
  const result = await executeOnPage("", () => {
    if (typeof Optanon === "undefined"){
      return false;
    } else {
      Optanon.ToggleInfoDisplay();
      return true;
    }
  });
  if (result){
    event.target.classList = "success";
    event.target.innerText = "Done!";
  } else {
    event.target.classList = "error";
    event.target.innerText = "No Optanon!";
  }
}

function OTCheckConsent(event){
  event.target.classList = "success";
  event.target.innerText = "In the Console!";
  const result = executeOnPage("", () => {
    const color = {
      good: 'lime',
      bad: 'red',
      info: 'white',
      info2: 'yellow',
      data: 'lightgrey'
    }
    window.getCookie = function (name) {
      const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
      if (match) return match[2];
    }
    const fullCookie = window.getCookie("OptanonConsent");
    console.group("%c Consent check script initiated. \n", css(color.info));
    console.log("%c Total Cookies on this page: " + document.cookie.split(";").length, css(color.info2));
    console.log("%c The length of the OptanonConsent is " + (!fullCookie ? "0" : fullCookie.length), css(color.info2));
    console.log("%c The raw OptanonConsent is:", css(color.info2));
    console.log("%c " + fullCookie, css(color.data));
  
    if (!/groups/i.test(fullCookie)) {
      console.log("%c Consent is not recorded", css("red"));
      return;
    }
    console.log("%c \nThe Groups Breakdown:", css(color.info));
    console.log("%c NOTE! The default groups are: C0001 - Necessary; C0002 - Performance; C0003 - Functional; C0004 - Targeting. But they can be tweaked.", css("white"));
    decodeURIComponent(fullCookie.split("groups=")[1].split("&")[0]).split(",").forEach((groupPair) => {
      let c = groupPair.split(":")[1] === "1" ? color.good : color.bad;
      console.log("%c Group " + groupPair.split(":")[0] + " = " + groupPair.split(":")[1], css(c));
    });
    console.groupEnd()
    function css(c) {
      return `color: ${c};font-weight: 500;font-size: 1.3em; background-color: dimgray`;
    }
  });
}

function blockPageUnload(event){
  event.target.classList = "success";
  event.target.innerText = "Done!";
  executeOnPage("", () => {
    window.onbeforeunload = () => false;
  });
}

function removeAllRedirections(){
  //kill all redirections from settings
  chrome.storage.sync.set({redirections:[]});
  //kill all redirections from the declarativeNetRequest
  deleteAllDeclarativeNetRequestRules();
  //finally, clear the table...
  const table = document.getElementsByClassName("redirectionsTable")[0];
  while (table.rows.length > 1) {
    table.deleteRow(1);
  }
}

async function deleteAllDeclarativeNetRequestRules(){
  chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: (await chrome.declarativeNetRequest.getSessionRules()).map(rule => rule.id),
    addRules: []
  });
  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: (await chrome.declarativeNetRequest.getDynamicRules()).map(rule => rule.id),
    addRules: []
  });
}

function getFirstValidUrl(text) {
  const urlRegex = /\bhttps?:\/\/[\w\.\/\-\#\?\&\:\=\@]+/gi;
  const matches = text.match(urlRegex);
  if (matches && matches.length > 0) {
    return matches[0];
  }
  return "[No Valid URL!]";
}

function setRedirection(){
  const date = new Date().toISOString().replace("T","\n").replace(/:\d\d\..+/,"");
  const redirectFrom = document.getElementById("currentlib");
  const redirectTo = document.getElementById("newlib");
  const CTA = document.getElementById("setRedirection");
  redirectFrom.value = getFirstValidUrl(redirectFrom.value);
  redirectTo.value = getFirstValidUrl(redirectTo.value);
  if(!/http/i.test(redirectFrom.value) || !/http/i.test(redirectTo.value)) {
    CTA.innerText = "ERROR"; 
    CTA.className = "error";
    return false;
  } else if (redirectFrom.value === redirectTo.value){
    CTA.innerText = "The URL is the same!";
    CTA.className = "error";
    return false;
  }
  
  chrome.storage.sync.get('redirections', function (data) {
    console.log("@@@ Redirections are ", data.redirections);
    redirections = data.redirections || [];
    if(!updateRedirectionIfExists(redirections, redirectFrom.value, redirectTo.value, date, CTA)){
      redirections.push({date: date, from: redirectFrom.value, to: redirectTo.value});
      CTA.innerText = "Rule Added!"; 
      CTA.className = "success";
    }
    //to catch the update happened in the for loop:
    chrome.storage.sync.set({redirections: redirections});
    updateRedirections(redirections);
  })
}

function updateRedirectionIfExists(redirections, redirectFrom, redirectTo, date, CTA){
  for (var i = 0; i < redirections.length; i++){
    if(redirections[i].from === redirectFrom){
      if(redirections[i].to === redirectTo){
        CTA.innerText = "Rule Exists!"; 
        CTA.className = "warn";
        return true;
      } else{
        CTA.innerText = "Rule Updated!"; 
        CTA.className = "success";
        redirections[i].to = redirectTo;
        redirections[i].date = date;
        return true;
      }
    }
  }
  return false;
}

function switchTab(event) {
  console.log("switch tab invoked, event is", event);
  const tabName = event.target.name;
  document.querySelectorAll("div.tab").forEach((tab) => {
    if (tab.id === tabName) {
      tab.style.display = "block";
    } else {
      tab.style.display = "none";
    }
  });
  if (tabName === "Redirections"){
    renderRedirections();
  }
}

function renderRedirections(){
  chrome.storage.sync.get('redirections', function (data) {
    if (data.redirections?.length > 0){
      document.getElementById("redirectionMessage").innerText = "";
      const table = document.getElementsByClassName("redirectionsTable")[0];
      table.innerHTML = `<tbody>
  <tr>
     <th style = "text-align: center; vertical-align: middle;">Date</th>
     <th>From</th>
     <th>To</th>
     <th style = "text-align: center; vertical-align: middle;">Delete</th>
  </tr>
</tbody>`;
      console.log("@@@ Redirections Exist, the obj is ", data.redirections);
      data.redirections.forEach(redirection => {
        const row = table.insertRow(-1);
        const td0 = row.insertCell(0);
        const td1 = row.insertCell(1);
        const td2 = row.insertCell(2);
        const td3 = row.insertCell(3);
        td0.innerText = redirection.date.replace("t","<br/>");
        td0.style = "text-align: center; vertical-align: middle;";
        td0.setAttribute("name", "date");
        td1.innerText = redirection.from;
        td1.setAttribute("name", "from");
        td2.innerText = redirection.to;
        td2.setAttribute("name", "to");
        td3.innerHTML = "<button name = 'deleteRedirection' class = 'error'>X</button>";
        td3.style = "text-align: center; vertical-align: middle;";
        td3.setAttribute("name", "delete");
      });
      deleteRedirectionButtonListener()
    } else {
      document.getElementById("redirectionMessage").innerText = "No redirections as of yet!";
    }
  });
}

function deleteRedirectionButtonListener(){
  buttons = document.getElementsByName("deleteRedirection");
  buttons.forEach(button => {
    button.addEventListener("click", clickEvent => {
      const row = clickEvent.target.parentElement.parentElement;
      const from = row.querySelector("[name='from']").innerText;
      deleteRedirection(from);
      row.remove();
    })
  })
}

function deleteRedirection(from){
  chrome.storage.sync.get('redirections', function (data) {
    const redirections = data.redirections.filter(redirection => redirection.from !== from);
    chrome.storage.sync.set({redirections:redirections});
    updateRedirections(redirections);
    console.log("@@@ Redirection " + from + " deleted! New redirections: ", redirections);
  });
}

async function updateRedirections(redirections) {
  chrome.storage.sync.get('settings', async function (data) {
    const newRules = redirections.map((redirect, index) => {
      let rule = {
        'id': index + 1,
        'priority': index + 1,
        'action': {
          'type': 'redirect',
          'redirect': {
            url: redirect.to
          }
        },
        'condition': {
          'urlFilter': redirect.from,
          'resourceTypes': [
            'script'
          ]
        }
      };
      //console.log("The redirect rule is: ", rule);
      return rule;
    });
    if(data?.settings?.sessionRedirections !== false){
      chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds: (await chrome.declarativeNetRequest.getSessionRules()).map(rule => rule.id),
        addRules: newRules
      });
    } else {
      chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: (await chrome.declarativeNetRequest.getDynamicRules()).map(rule => rule.id),
        addRules: newRules
      });
    }
  });
}

async function updatePage(launchDebugInfo) {
  Object.keys(launchDebugInfo).forEach((launchDebugItem) => {
    let reportElement = document.getElementById(launchDebugItem);
    reportElement.className = '';
    reportElement.classList.add(launchDebugInfo[launchDebugItem].class);
    reportElement.innerHTML = launchDebugInfo[launchDebugItem].value;
    reportElement.parentElement.setAttribute("title", launchDebugInfo[launchDebugItem].info);
  });
  updateDynamicBookmarks();
}

function updateDynamicBookmarks(){
  const workspace = document.getElementById("segmentWorkspace").value;
  if(workspace){
    document.getElementById("segmentWorkspaceLinks").querySelectorAll("a").forEach(link => {
      link.href = link.href.replace(/segment\.com\/[^\/]*\//,`/segment.com/${workspace}/`);
    });
  }
}

async function getTiming() {
  const [{ result }] = await chrome.scripting.executeScript({
    func: () => JSON.stringify(performance.getEntriesByType("navigation")[0]?.duration),
    args: [],
    target: {
      tabId: (await chrome.tabs.query({ active: true, currentWindow: true }))[0].id
    },
    world: 'MAIN',
  });
  return result;
}

async function executeOnPage(funcVar, funcToExecute) {
  const [{result}] = await chrome.scripting.executeScript({
    func: funcToExecute,
    args: [funcVar],
    target: {
      tabId: (await chrome.tabs.query({ active: true, currentWindow: true }))[0].id
    },
    world: 'MAIN',
  });
  return result;
}

async function getPageVar(name, tabId) {
  const [{ result }] = await chrome.scripting.executeScript({
    func: name => JSON.stringify(window[name]),
    args: [name],
    target: {
      tabId: tabId ??
        (await chrome.tabs.query({ active: true, currentWindow: true }))[0].id
    },
    world: 'MAIN',
  });
  return result;
}

async function checkStatus(pageLoadTime, segmentStatus) {
  const details = {
    pstatus: {},
    lstatus: {},
    sourceId: {}
  };
  if (pageLoadTime > 0) {
    details.pstatus = {
      value: "Loaded in " + pageLoadTime / 1000 + " sec.",
      class: "success",
      info: "Loaded successfully"
    };
  } else {
    details.pstatus = {
      value: "Not Loaded Yet",
      class: "warn",
      info: "The page is still loading. Seems like the window.performance.timing.domContentLoadedEventEnd hasn't fired yet."
    };
  }
  if (segmentStatus?.libraryLoaded){
    details.lstatus = {
      value: "Found",
      class: "success",
      info: "Detected a settings call for the Segment config"
    };
    if (segmentStatus?.sourceId) {
      details.sourceId = {
        value: segmentStatus?.sourceId,
        class: "success",
        info: "We're good. The sorce id is found."
      };
    } else {
      details.sourceId = {
        value: "Not Found",
        class: "warn",
        info: "source id wasn't identified."
      };
    }
  } else {
    details.lstatus = {
      value: "Not Found",
      class: "warn",
      info: "Segment library hasn't been detected"
    };
    details.sourceId = {
      value: "N/A",
      class: "warn",
      info: "No library = No source id."
    };
  }
  return details;
}

async function loadSettings() {
  chrome.storage.sync.get('redirections', function (data) {
    const redirections = data?.redirections || [];
    updateRedirections(redirections);
  });

  const settings = {};
  chrome.storage.sync.get('settings', function (data) {
    if(!data){
      data = {settings:{}};
    }
    settingsSetter(data.settings);
    if (data.settings) {
      if (data.settings?.themeSwitcher == "light"){
        document.getElementById("cssTheme").href = "css/water_light.css";
        document.getElementById("themeSwitcher").innerText = "🌙";
      }
      if (data.settings.defaultTab){
        switchTab({target: {name: data.settings.defaultTab}});
        document.getElementById("defaultTab").querySelector(`[value=${data.settings.defaultTab}]`).selected = "selected";
      }
      console.log("@@@ Settings Exist, the obj is ", data.settings);
      Object.keys(data.settings).forEach(setting => {
        if (document.getElementById(setting)?.type == 'checkbox'){
          document.getElementById(setting).checked = data.settings[setting];
        } else if (document.getElementById(setting)?.type == 'text'){
          document.getElementById(setting).value = data.settings[setting];
        }
      });

      Object.keys(data.settings?.colors || []).forEach(colorId => {
        if (document.getElementById(colorId)){
          const field = document.getElementById(colorId);
          const exampleTd = field.parentElement.parentElement.querySelector("[name='example']");
          field.value = data.settings.colors[colorId];

          if(field.id.includes("-bg")){
            exampleTd.style.background = field.value;
          } else if(field.id.includes("-txt")){
            exampleTd.style.color = field.value;
          }
          
        }
      });

      if (Array.isArray(data.settings?.loggingHeadings)){
        document.getElementById("loggingHeadings").value = data.settings.loggingHeadings.join(", ");
      }
    } else {
      console.log("@@@ Settings Don't exist. Populating them with default vals. the obj is ", data.settings);
      document.querySelectorAll("input[type='checkbox']").forEach(checkbox => {
        settings[checkbox.id] = checkbox.checked;
      });
      chrome.storage.sync.set({ settings: settings });
    }
  });
}

async function settingsSetter(settings) {
  document.querySelectorAll("input[type='checkbox']").forEach(checkbox => {
    checkbox.addEventListener("click", (event) => {
      settings[event.target.id] = event?.target?.checked ?? false;
      chrome.storage.sync.set({ settings: settings });
      if(event.target.id === "launchbox"){
        executeOnPage(event.target.checked, (flag) => {
          localStorage.setItem("com.adobe.reactor.debug",!!flag); 
          typeof window._satellite !== 'undefined' ? window._satellite?.setDebug(flag ? true : false) : '';
        });
      }
    })
  });

  document.querySelectorAll("input[type='text']").forEach(input => {
    input.addEventListener("change", (event) => {
      settings[event.target.id] = event?.target?.value;
      chrome.storage.sync.set({ settings: settings });
    })
  });

  document.querySelectorAll("input[type='color']").forEach((input) => {
    input.addEventListener("change", (event)=>{
      const exampleTd = event.target.parentElement.parentElement.querySelector("[name='example']");
      const newColor = event.target.value;
      const targetId = event.target.id;
      if(targetId.includes("-bg")){
        exampleTd.style.background = newColor;
      } else if(targetId.includes("-txt")){
        exampleTd.style.color = newColor;
      }

      settings.colors = settings.colors || {};
      settings.colors[targetId] = newColor;
      chrome.storage.sync.set({ settings: settings });
    });
  });
}

function logSettings(){
  chrome.storage.sync.get('settings', function (data) {
    console.log("@@@ Debugging the Settings object is: " , data.settings);
  });
}