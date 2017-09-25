import secrets from 'secrets';
import moment from 'moment';
import Auth0Chrome from 'auth0-chrome';
import { defaultSettings, upsync, downsync, countSpooks, newModify } from './shared';

import '../img/icon128.png';
import '../img/icon48.png';
import '../img/icon16.png';

chrome.runtime.onMessage.addListener(function(event) {
  switch (event.type) {
    case 'authenticate': {
      console.log('authenticate');
      let options = {
        scope: 'openid offline_access profile email',
        device: 'chrome-extension',
          logo: './icon128.png',
          primaryColor: 'green',
      };

      new Auth0Chrome(secrets.AUTH0_DOMAIN, secrets.AUTH0_CLIENT_ID)
        .authenticate(options)
        .then(function (authResult) {
            console.log("authResult", authResult);
          chrome.storage.local.set({authResult}, function(){
            chrome.notifications.create({
              type: 'basic',
              iconUrl: './icon128.png',
              title: 'Login Successful',
              message: 'You can use the app now'
            });
          });
        }).catch(function (err) {
          chrome.notifications.create({
            type: 'basic',
            title: 'Login Failed',
            message: err.message,
            iconUrl: './icon128.png'
          });
        });
      break;
    }
    case 'logout': {
      chrome.storage.local.remove('authResult', function(){
        console.log(':: logged out');
      });
      break;
    }
    default:
      console.log('default');
      break;
  }
  // if (event.type === 'authenticate') {
  //   console.log('authenticate');
    // scope
    //  - openid if you want an id_token returned
    //  - offline_access if you want a refresh_token returned
    // device
    //  - required if requesting the offline_access scope.
    // let options = {
    //   scope: 'openid offline_access profile email',
    //   device: 'chrome-extension',
    //     logo: './icon128.png',
    //     primaryColor: 'green',
    // };

    // new Auth0Chrome(secrets.AUTH0_DOMAIN, secrets.AUTH0_CLIENT_ID)
    //   .authenticate(options)
    //   .then(function (authResult) {
    //     localStorage.authResult = JSON.stringify(authResult);

    //     chrome.notifications.create({
    //       type: 'basic',
    //       iconUrl: './icon128.png',
    //       title: 'Login Successful',
    //       message: 'You can use the app now'
    //     });
    //   }).catch(function (err) {
    //   chrome.notifications.create({
    //     type: 'basic',
    //     title: 'Login Failed',
    //     message: err.message,
    //     iconUrl: './icon128.png'
    //   });
    // });
  // }
});

chrome.extension.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.updateCount) {
    setBadge(request.updateCount);
  }
  else if (request.syncUserID) {
    const { userID } = settings;
    upsync(userID, function(info) {
      console.log(':: Spooks synchronized', request.syncUserID);
    });
  }
  else if (request.downsync) {
    downsync(request.downsync, function(info) {
      console.log(':: Spooks downsynced', request.downsync);
    });
  }
  else if (request.loadData) {
    loadData(function() {
      console.log(':: Data loaded by msg request');
    });
  }
});

chrome.alarms.onAlarm.addListener(function(alarm) {
  if (alarm.name == 'tick') {
    tick();
  }
  else if (alarm.name == 'sync') {
    chrome.storage.sync.get('userid', function(data) {
      downsync(data.userid, function(msg, newData) {
        console.log(':: Sync tick ' + msg);
      });
    });
  }
});

function setBadge(val) {
  val = val || 0;
  if (val > 0 && val < 10) {
    chrome.browserAction.setBadgeBackgroundColor({ color: [180, 58, 38, 100] });
    chrome.browserAction.setBadgeText({ text: val.toString() });
  }
  else if (val > 10) {
    chrome.browserAction.setBadgeText({ text: '10+' });
  }
  else {
    chrome.browserAction.setBadgeText({ text: '' });
  }
}

let settings = {},
  settingsSaved = false;
let unseenCount;

function loadData(cb, cache) {
  let userID;
  const now = new Date().valueOf();
  let settingsData = {};
  chrome.storage.sync.get(null, function(items) {
    const allKeys = Object.keys(items);
    unseenCount = 0;
    if (items.settings) {
      settingsSaved = true;
      settingsData = items.settings;
    }
    else {
      settingsData = defaultSettings;
      chrome.storage.sync.set({ 'settings': defaultSettings }, function() {
        settingsSaved = true;
        console.log(':: Fresh settings initialized');
      });
    }
    if (items.userid) {
      settingsData.userID = items.userid;
      userID = items.userid;
    }
    else {
      userID = false;
    }
    settings = settingsData;

    if (items.spooks) {
      const spookArr = JSON.parse(items.spooks);
      countSpooks(spookArr, function(count, unseen) {
        setBadge(count);
        settingsData.unseen = unseen;
        cb(settingsData, userID);
      });
    }
    else {
      settingsData.unseen = [];
      cb(settingsData, userID);
    }
  });
}

function tick() {
  let now = new Date().valueOf(),
    overdue = false;
  loadData(function(gotSettings) {
    const unseenArray = gotSettings.unseen;
    unseenArray.forEach(function(sp, index) {
      const epochInt = parseInt(sp.futureDate);
      const epochString = epochInt.toString();
      const diff = epochInt - now;
      // If spook in next 5 minutes
      if (diff < 300000) {
        if (diff < 0) {
          overdue = true;
        }
        try {
          if (sp.seen != true) {
            showNotification(sp, unseenArray);
          }
          else {
            console.log(':: Spook seen');
          }
        }
        catch (err) {
          console.log(err);
        }
      }
    });
  }, true);
}

// Initial run of loadData, start tick
loadData(function(d, savedUser) {
  console.log(':: Data Loaded, tick started', savedUser);
  chrome.alarms.create('tick', { delayInMinutes: 1, periodInMinutes: 1 });
  chrome.alarms.create('sync', { delayInMinutes: 1, periodInMinutes: 5 });

  downsync(savedUser, function(msg, newData) {
    console.log(':: Sync msg ' + msg);
  });

  tick();
});

let notifications = {},
  notifyUrls = {},
  clicked = {};

function showNotification(notifyData, notificationArray) {
  if (Notification.permission !== 'granted') {Notification.requestPermission();}
  else {
    const { userID } = settings;
    console.log(":: Notification", notifyData);
    const daysAgo = Math.floor((new Date().valueOf() - notifyData.createDate) / 86400000);
    const ago = moment(notifyData.createDate).fromNow();
    if (typeof notifications[notifyData.createDate] === 'undefined') {
      // Hack for singularizing interval type
      let intervalTypeDisplay = settings.putOffIntervalType || 'days';
      const intervalNumDisplay = parseInt(settings.putOffIntervalNumber) || 1;
      if (intervalNumDisplay == 1) {
        intervalTypeDisplay = intervalTypeDisplay.substring(0, intervalTypeDisplay.length - 1);
      }
      notifications[notifyData.createDate] = chrome.notifications.create(`spook_${notifyData.createDate}`, {
        type: 'basic',
        iconUrl: './icon128.png',
        title: notifyData.title,
        message: notifyData.note || '',
        requireInteraction: true,
        contextMessage: 'Saved ' + ago,
        buttons: [{
          title: `Open link from ${domainFromUrl(notifyData.URL)}`,
        }, {
          title: `Put off for ${intervalNumDisplay} ${intervalTypeDisplay}`,
        }],
      }, function(notificationId) {
        let opened = false;

        notifyUrls[notificationId] = notifyData.URL;
        chrome.notifications.onButtonClicked.addListener(function(notifID, btnIndex) {
          const notif = notificationArray.find(ii => notifID === `spook_${ii.createDate}`);

          if (btnIndex === 0) {
            console.log("notif", notif, notifID, notifID, btnIndex);
            setBadge(unseenCount-1);
            // Visit URL
            console.log(":: Open Link", userID);
            newModify('createDate', notifyData.createDate, 'seen', true, function(moddedArray) {
              chrome.notifications.clear(notifID, function() {
                upsync(userID, function(stat) {
                  console.log(':: Spooks posted after modification', stat);
                });
              });
            });
            clicked[notifID] = true;
            opened = true;

            chrome.tabs.create({
              url: notifyData.URL,
            });

          } else if (btnIndex === 1 && opened === false && clicked[notifID] !== true) {
            // clicked[notifID] = true;
            opened = true;
            console.log(":: Put Off Link", userID);
            putOff(notifyData, settings.putOffIntervalNumber, settings.putOffIntervalType, function(stat) {
              chrome.notifications.clear(notifID, function() {});
            });
          } else {
            console.log('shouldn\'t happen');
          }
        });

        chrome.notifications.onClosed.addListener(function(notifID, btnIndex) {
          console.log(btnIndex);
          if (btnIndex !== 0 || btnIndex !== 1) {
            newModify('futureDate', notifyData.futureDate, 'seen', true, function(moddedArray) {
              upsync(userID, function(stat) {
                console.log(':: Spook marked as seen.');
              });
            });
          }
        });
      });
    }
    else {
      console.log(':: Listener already added');
    }
  }
}

function putOff(notifyData, intNumber, intType, whenDone) {
  const { userID } = settings;
  const oldSpook = notifyData.futureDate + '';
  const newFutureDate = moment(notifyData.futureDate).add(intNumber, intType).unix() * 1000;
  newModify('createDate', notifyData.createDate, 'futureDate', newFutureDate, function(arr) {
    console.log(':: Put off for ' + intNumber + ' ' + intType, notifyData);
    upsync(userID, function(stat) {
      console.log(':: Modified and synced', stat);
      whenDone(':: Successfully put off' + stat);
    });
  });
}

function removeKeyFromArray(key, arr) {
  const index = arr.indexOf(key);
  arr.splice(index, 1);
  return arr;
}

function domainFromUrl(data) {
  const a = document.createElement('a');
  a.href = data;
  return a.hostname;
}
