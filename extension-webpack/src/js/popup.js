import Auth0Chrome from 'auth0-chrome';
import secrets from 'secrets';
import moment from 'moment';
import { defaultSettings, countSpooks, newModify, upsync, downsync } from './shared';
import '../css/popup.css';
const jwtDecode = require('jwt-decode');
const flatpickr = require('flatpickr');

moment.updateLocale('en', {
  relativeTime: {
    future: '%s',
    past: '%s',
    s:  '1s',
    ss: '%ss',
    m:  '1m',
    mm: '%dm',
    h:  '1h',
    hh: '%dh',
    d:  '1d',
    dd: '%dd',
    M:  '1M',
    MM: '%dM',
    y:  '1y',
    yy: '%dY',
  },
});

let spooking = false,
  shouldClose = true;

// Minimal jQuery
const $$ = document.querySelectorAll.bind(document);
const $ = document.querySelector.bind(document);

var user = {},
  sync = false;
function loggedInView(authResult) {
  fetch(`https://${secrets.AUTH0_DOMAIN}/userinfo`, {
    headers: {
      'Authorization': `Bearer ${authResult.access_token}`
    },
  }).then(resp => resp.json()).then((profile) => {
    console.log("profile", profile);
  // authService.getProfile(function(err, profile) {
    console.log(':: ' + profile.user_id + ' is logged in');
    chrome.storage.sync.set({
      'profile': JSON.stringify(profile),
    });
    user = profile;
    chrome.storage.sync.get('userid', function(theId) {
      if (Object.keys(theId).length === 0 && theId.constructor === Object) {
        console.log(':: userid not found: ' + theId);
        chrome.storage.sync.set({
          'userid': user.user_id,
        }, function() {
          console.log(':: userid saved');
          user.userID = user.userid;
        });
      }
      else {
        user.userID = theId.userid;
      }
      document.getElementById('userID').value = user.userID;

      chrome.storage.sync.get('rev', function(rev) {
        if (Object.keys(rev).length === 0 && rev.constructor === Object) {
          console.log('No revision data stored. ' + user.userID);
          registerUser(user.userID, function(thenData) {
            chrome.storage.sync.set({
              'rev': thenData,
            }, function() {
              document.getElementById('rev').value = thenData;
              console.log(':: New User Saved', thenData);
            });
          });
        }
        else {
          console.log(':: Syncing enabled');
          document.getElementById('rev').value = rev.rev;
          document.getElementById('doSync').checked = 'checked';
          user.rev = rev.rev;
          user.sync = true;
        }
      });
    });

    $('#loginButton').innerHTML = 'Logged In: ' + user.nickname;
    $('#loginButton').addEventListener('mouseover', function() {
      $('#loginButton').innerHTML = 'Log Out?';
    });
    $('#loginButton').addEventListener('mouseout', function() {
      $('#loginButton').innerHTML = 'Logged In: ' + user.nickname;
    });
    $('#loginButton').addEventListener('click', function() {
      chrome.runtime.sendMessage({
        type: 'logout',
      });
      window.close();
    });
  }).catch((err) => {
    console.log(':: Authentication error', err);
    chrome.storage.sync.get('profile', function(p) {
      user = JSON.parse(p);
    });
  }); //end
}

function defaultView() {
  $('.loggedIn').style.display = 'none';
  $('#loginButton').addEventListener('click', function() {
    chrome.runtime.sendMessage({
      type: 'authenticate'
    });
    // authService.show({
    //   theme: {
    //     logo: '/icons/icon128.png',
    //     primaryColor: 'green',
    //   },
    // }, function() {
    //   $('#loginButton').innerHTML = 'Logging In';
    //   setTimeout(function() {
    //     window.close();
    //   }, 1500);
    // });
  });
}


function param(object) {
  let encodedString = '';
  for (const prop in object) {
    if (object.hasOwnProperty(prop)) {
      if (encodedString.length > 0) {
        encodedString = encodedString + '&';
      }
      encodedString = encodedString + encodeURI(prop + '=' + object[prop]);
    }
  }
  return encodedString;
}

function fadeOut(el) {
  el.style.opacity = 1;

  (function fade() {
    if ((el.style.opacity -= 0.1) < 0) {
      el.style.display = 'none';
    }
    else {
      requestAnimationFrame(fade);
    }
  })();
}
function fadeIn(el, display) {
  el.style.opacity = 0;
  el.style.display = display || 'block';

  (function fade() {
    let val = parseFloat(el.style.opacity);
    if (!((val = val + 0.1) > 1)) {
      el.style.opacity = val;
      requestAnimationFrame(fade);
    }
  })();
}

function updateUnseen(count, total) {
  console.log(':: ' + total + ' saved, ' + count + ' unseen.');
  chrome.extension.sendMessage({ updateCount: count });
  if (count > 0) {
    const displayText = total > 1 ? total + ' Spookmarks : ' + count + ' unseen' : '1 Spookmark';
    document.getElementById('listButton').innerHTML = displayText;
  }
}

function setFutureDate(mDate, save) {
  let interval = $('#intervalNumber').value ? $('#intervalNumber').value : defaultSettings.interval;
  let intervalType = $('#intervalType').value ? $('#intervalType').value : defaultSettings.intervalType;
  if (mDate) {
    const dayDiff = moment().diff(mDate, 'days');
    interval = Math.abs(dayDiff);
    document.getElementById('intervalNumber').value = interval;
    intervalType = 'days';
  }
  const futureMoment = mDate || moment().add(interval, intervalType);
  const willCloseIndicator = shouldClose ? '<span id="willCloseIndicator">&#x21af;</span>' : '';
  document.getElementById('spookThis').innerHTML = 'Haunt Me In ' + interval + ' ' + intervalType + ' ' + willCloseIndicator;
  document.getElementById('futureDate').value = futureMoment.unix() * 1000 + Math.floor(Math.random() * 1000);
  document.getElementById('humanDate').innerHTML = futureMoment.format('MMMM Do, YYYY h:mm a');
  if (save !== false) {
    picker.setDate(futureMoment.format('YYYY-MM-DD HH:mm'));
    saveSettings();
  }
}

function deleteSpook(toDelete) {
  newModify('createDate', toDelete, 'delete', true, function(returnedArray) {
    upsync(user.userID, function(syncStat) {
      el.parentNode.remove();
      console.log(':: Post delete update', syncStat);
      status('Spook removed');
    });
  });
}

function addSpook(spookObj, back) {
  spooking = true;
  const unixFuture = spookObj.futureDate;
  const storeSpook = {};
  storeSpook[unixFuture] = spookObj;
  fadeOut(document.getElementById('topIcon'));
  let spookArr = [];
  chrome.storage.sync.get('spooks', function(data) {
    console.log('spookdata', data);
    if (data.spooks) {
      spookArr = JSON.parse(data.spooks);
    }
    spookArr.push(spookObj);
    chrome.storage.sync.set({ 'spooks': JSON.stringify(spookArr) }, function() {
      console.log(':: Spook stored', spookObj);
      if (user.sync === true) {
        upsync(user.user_id, function(stat) {
          console.log(stat);
          document.getElementById('spookThis').innerHTML = 'Spookmarks Synced';
        });
      }
      else {
        document.getElementById('spookThis').innerHTML = 'Spooked';
      }

      // Update badge count instantly with message passing
      countSpooks(spookArr, function(unseenCount, unseenArr) {
        chrome.extension.sendMessage({ updateCount: unseenCount });
      });
      fadeIn(document.getElementById('buttonGhost'));
      setTimeout(function() {
        spooking = false;
        back();
        window.close();
      }, 900);
    });
  });
}

function checkSpook(returnSpook) {
  const spook = {};
  spook.URL = document.getElementById('URL').value;
  spook.title = document.getElementById('title').value;
  spook.seen = false;
  spook.createDate = Date.now();
  spook.futureDate = parseInt(document.getElementById('futureDate').value);
  if (spook.futureDate.length == 0) {
    status('No date set');
    returnSpook(false);
  }
  spook.note = document.getElementById('note').value;
  returnSpook(spook);
}

function isLoggedIn(token) {
    console.log("token", token);
  // The user is logged in if their token isn't expired
  return jwtDecode(token).exp > Date.now() / 1000;
}

document.addEventListener('DOMContentLoaded', function() {
  
  document.getElementById('spookThis').addEventListener('click', function() {
    checkSpook(function(sp) {
      if (sp === false) {
        status('Something went wrong');
      }
      else if (spooking !== true) {
        addSpook(sp, function() {
          if (shouldClose) {
            chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
              chrome.tabs.remove(tabs[0].id, function() {
                console.log(':: Spooked and closed', sp);
              });
            });
          }
          else {
            console.log(':: Spooked', sp);
          }
        });
      }
    });
  });
  // document.getElementById('configIcon').addEventListener('click', function() {
  //   const configPanel = document.getElementById('config');
  //   configPanel.style.display = configPanel.style.display !== 'none' ? 'none' : '';
  // });

  document.getElementById('clear').addEventListener('click', function() {
    document.getElementById('clear').innerHTML = 'Are you sure?';
    document.getElementById('clear').addEventListener('click', function() {
      chrome.storage.sync.clear(function() {
        localStorage.clear();
        console.log('cleared');
        window.close();
      });
    });
  });
  document.getElementById('sync').addEventListener('click', function() {
    downsync(user.userID, function(stat, spooks) {
      console.log(':: Button sync ' + stat);
      if (spooks !== false) {
        buildSpookList(spooks, function(unseenCount) {
          updateUnseen(unseenCount, spooks.length);
        });
      }
    });
  });
  document.getElementById('stepUp').addEventListener('click', function() {
    document.getElementById('intervalNumber').stepUp();
    setFutureDate();
  });
  document.getElementById('stepDown').addEventListener('click', function() {
    if (document.getElementById('intervalNumber').value > 1) {
      document.getElementById('intervalNumber').stepDown();
      setFutureDate();
    }
  });
  document.getElementById('intervalType').addEventListener('change', function(e) {
    setFutureDate();
  });

  document.getElementById('putOffStepUp').addEventListener('click', function() {
    document.getElementById('putOffIntervalNumber').stepUp();
    saveSettings();
  });
  document.getElementById('putOffStepDown').addEventListener('click', function() {
    if (document.getElementById('putOffIntervalNumber').value > 1) {
      document.getElementById('putOffIntervalNumber').stepDown();
      saveSettings();
    }
  });
  // Add saveSettings to various elements
  [
    'putOffIntervalType',
    'putOffIntervalNumber',
    'closeTabSwitch'
  ].forEach(function(id) {
    console.log("id", id);
    document.getElementById(id).addEventListener('change', function(){ 
      saveSettings()
    });
  });
  
  try {
    // var bg = chrome.extension.getBackgroundPage();

    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      // document.getElementById("pdurl").value = tab[0].url;
      document.getElementById('URL').value = tabs[0].url;
      document.getElementById('title').value = tabs[0].title;
      document.getElementById('editLink').innerHTML = trunc(tabs[0].title);
      // setFutureDate();
    });
  }
  catch (err) {}
  function hidePanels() {
    const allPanels = Array.from(document.querySelectorAll('.js-accordion-panel'));
    allPanels.forEach(panel => panel.classList.add('hide'));
  }
  document.getElementById('configIcon').addEventListener('click', e => {
    hidePanels();
    if (document.getElementById('config').classList.contains('hide')) {
      document.getElementById('config').classList.remove('hide');
    } else {
      document.getElementById('config').classList.add('hide');
    }
  });
  document.getElementById('triggerDescription').addEventListener('click', e => {
    hidePanels();
    document.getElementById('description').classList.remove('hide');
  });
  document.getElementById('triggerCalendar').addEventListener('click', e => {
    hidePanels();
    document.getElementById('calendar').classList.remove('hide');
  });
  document.getElementById('triggerList').addEventListener('click', e => {
    hidePanels();
    document.getElementById('listPanel').classList.remove('hide');
  });
  // document.querySelector('.js-accordion-trigger').addEventListener('click', e => {
  //   const allPanels = Array.from(document.querySelectorAll('.js-accordion-panel'));
  //   const currentIndex = allPanels.indexOf(e.target);
  //   const targetPanel = e.target.getAttribute('aria-controls');
  //   console.log("targetPanel", targetPanel, currentIndex);
  //   if (targetPanel){
  //     document.getElementById(targetPanel).classList.remove('hide');
  //   }
  //   console.log('clicked', targetPanel, e.target.nextElementSibling);

  // });

  // const accordion = new AccordionWidget(document.getElementById('#accordion-interface'), 1);

  document.getElementById('title').addEventListener('keyup', function(e) {
    document.getElementById('editLink').innerHTML = trunc(e.target.value, 64);
  });

  chrome.storage.local.get('authResult', function(res) {
      console.log("res", res);
    const { authResult=null } = res;
    if (authResult && authResult.id_token && isLoggedIn(authResult.id_token)) {
      loggedInView(authResult);
    } else {
      console.log('not logged in');
      defaultView();
    }
  });

  chrome.storage.sync.get('settings', function(settingsObj) {
    if (typeof settingsObj.settings === 'undefined') {
      settingsObj = defaultSettings;
      console.log(':: Initialized from popup, only happens after reset');
    }
    else {
      console.log(':: Spookmarks loaded successfully');
    }
    populateInputs(settingsObj);
    populateData(settingsObj);
  });

  initPicker();
});

var sync;

function status(msg) {
  document.getElementById('status').innerHTML = msg;
}

let picker;
function initPicker(date) {
  picker = flatpickr(document.getElementById('datepicker'), {
    'inline': true,
    'minDate': 'today',
    'enableTime': true,
    onChange: function(dateObj, dateStr, instance) {
      // var unixTime = unixTime();//moment(dateStr).unix()*1000;
      // document.getElementById("futureDate").value = unixTime(dateStr);
      setFutureDate(moment(dateStr), false);
    },

  });
}
function unixTime(t) {
  if (t) {
    return new Date(t).getTime();
  }
  return Date.now();

}

function trunc(str, length, ending) {
  if (length == null) {
    length = 64;
  }
  if (ending == null) {
    ending = '...';
  }
  if (str.length > length) {
    return str.substring(0, length - ending.length) + ending;
  }
  return str;

}
function shorten(str) {
  if (str.indexOf('minutes') > -1) {
    str = str.replace(' minutes', 'm');
  }
  else if (str.indexOf('hours') > -1) {
    str = str.replace(' hours', 'h');
  }
  else if (str.indexOf('days') > -1) {
    str = str.replace(' days', 'd');
  }
  else if (str.indexOf('an hour') > -1) {
    str = str.replace('an hour', '1h');
  }
  return str;
}

function handleRowClick(e) {
  const clickType = e.target.getAttribute('data-clickType');
  console.log("clickType", clickType);
  switch (clickType) {
  case 'link' : {
    const linkURL = e.target.getAttribute('data-linkURL');
    break;
  }
  case 'time' : {

    break;
  }
  case 'delete' : {
    const createDate = e.target.getAttribute('data-createDate');
    console.log('deleteSpook', createDate);
    deleteSpook(createDate);
    break;
  }
  default: {
    console.log('default');
  }
  }

}

function addSpookRow(itemObj) {
  const future = itemObj.futureDate - new Date().valueOf() > 0;
  const row = document.createElement('tr');
  row.addEventListener('click', handleRowClick, false);
  let timeString = '';

  let str = moment(itemObj.futureDate).fromNow(true);
  console.log("str", str, itemObj);
  const rowClass = future;
  str = shorten(str);
  if (future) {
    timeString = str;
    row.classList.add('future');
  }
  else {
    timeString = '-' + str;
    row.classList.add('past');
  }

  if (itemObj.seen === true) {
    row.classList.add('seen');
  }

  const rowHtml = `
    <td class="tdTitle"
      data-clickType="link"
      data-linkURL="${itemObj.URL}"
    >
      <a class="spookLink" href="#">
        ${trunc(itemObj.title, 42)}
      </a>
    </td>
    <td class="tdTime" data-clickType="time">
      ${timeString}
    </td>
    <td
      id="${itemObj.futureDate}"
      data-clickType="delete"
      data-createDate="${itemObj.createDate}"
      class="tdDelete">x</td>`;
  row.innerHTML = rowHtml;

  document.getElementById('spookList').appendChild(row);
}

function populateData() {
  let unseen = [],
    unseenCount = 0,
    totalCount = 0;
  user.unseen = [];

  chrome.storage.sync.get(null, function(items) {
    const allKeys = Object.keys(items);
    // Iterating all keys for now, there might be a better way
    allKeys.forEach(function(v, i) {
      const itemObj = items[v][v] || items[v];
      if (itemObj.title) {
        console.log(':: Loaded direct');
        if (itemObj.seen !== true) {
          unseenCount++;
        }
        totalCount++;
        addSpookRow(itemObj);
      }
      else if (v == 'spooks') {
        const spookArr = JSON.parse(itemObj);
        buildSpookList(spookArr, function(unseenCount) {
          console.log('unseen', unseenCount);
          updateUnseen(unseenCount, spookArr.length);
        });
      }
      else if (v == 'settings') {
        const s = items[v];
        populateInputs(s);
      }
      else if (v == 'userid') {

        document.getElementById('userID').value = items[v];
      }
      else if (v == 'rev') {
        document.getElementById('rev').value = items[v];
      }
    });
    setFutureDate(null, false);
  });
}


function populateInputs(s) {
  console.log("populateInputs(s", s);
  document.getElementById('intervalType').value = s.intervalType || 'days';
  document.getElementById('intervalNumber').value = parseInt(s.interval) || 1;
  document.getElementById('putOffIntervalType').value = s.putOffIntervalType || 'days';
  document.getElementById('putOffIntervalNumber').value = parseInt(s.putOffIntervalNumber) || 1;
  shouldClose = s.closeAfterSpooked;
  document.getElementById('closeTabSwitch').checked = shouldClose ? 'checked' : false;
}

function saveSettings() {
  const settingsObj = {};
  const putOffVal = $('#putOffIntervalNumber').value || 2;
  const putOffType = $('#putOffIntervalType').value || 'minutes';
  const intVal = $('#intervalNumber').value;
  console.log("intVal", intVal, $('#intervalNumber'));
  const intType = $('#intervalType').value;
  const doSync = document.getElementById('doSync').checked;
  const closeTabSwitch = document.getElementById('closeTabSwitch').checked;

  settingsObj.settings = {
    'interval': intVal,
    'intervalType': intType,
    'putOffIntervalNumber': putOffVal,
    'putOffIntervalType': putOffType,
    'unseen': user.unseen || [],
    'sync': doSync,
    'closeAfterSpooked': closeTabSwitch,
    // settings = settingsObj["settings"];

  };
  chrome.storage.sync.set(settingsObj, function() {
    console.log(':: Settings stored as object', settingsObj);
  });
}

function buildSpookList(spookArr, unseen) {
  let unseenCount = 0;
  for (const i in spookArr) {
    const spookItem = spookArr[i];
    if (spookItem.seen !== true) {
      unseenCount = unseenCount + 1;
    }
    addSpookRow(spookItem);
    if (i == spookArr.length - 1) {
      unseen(unseenCount);
    }
  }
}

function registerUser(userID, thenData) {
  userID = userID, document.getElementById('userID').value;
  const request = new XMLHttpRequest();
  request.open('GET', 'https://spookmarks.com/register/' + encodeURIComponent(userID), true);
  request.onload = function() {
    if (request.status >= 200 && request.status < 400) {
      // Success!
      console.log(':: Successfully registered ' + userID);
      const data = JSON.parse(request.responseText);
      thenData(data.userData.rev);
    }
    else {
      // We reached our target server, but it returned an error
      console.log('Errortown. Population this.', request.status);
    }
  };

  request.onerror = function(err) {
    console.log('error', err);
    // There was a connection error of some sort
  };

  request.send();
}

