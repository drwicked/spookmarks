export const defaultSettings = {
  intervalType: 'days',
  interval: '1',
  putOffIntervalType: 'days',
  putOffIntervalNumber: '1',
  spooks: [],
  unseen: [],
  sync: false,
  closeAfterSpooked: true,
};

let upsyncing = false;
export function downsync(id, back) {
  if (typeof id !== 'undefined' && id !== false) {
    checkRemoteRev(id, function(result) {
      if (result == true) {
        getRemoteSpooks(id, function(remoteData) {
          if (remoteData !== false) {
            const { userData } = remoteData;
            const { _rev = '0' } = userData;
            let localRev = 0;
						const remoteRev = parseInt(_rev.split('-')[0]) || 0;
            chrome.storage.sync.get('rev', function(revData) {
              const { rev = '0' } = revData;
              if (typeof revData.rev !== 'undefined') {
                localRev = parseInt(rev.split('-')[0]) || 0;
                console.log("localRev", localRev);
              }
              console.log(`:: Local version: ${localRev} has ${userData.spooks.length} spooks | Remote version: ${remoteRev} has ${remoteData.userData.spooks.length} spooks`);
              if (remoteRev > localRev) {
                console.log(':: Remote data is new');
                chrome.storage.sync.set({ 'spooks': JSON.stringify(userData.spooks) }, function() {
                  chrome.storage.sync.set({ 'rev': userData._rev }, function() {
                    console.log(':: Downsync complete');
                    back('downsync', userData.spooks);
                  });
                });
              }
              else if (remoteRev == localRev) {
                back('samesame', false);
              }
              else if (localRev > remoteRev) {
                console.log('This should never happen');
                if (upsyncing !== true) {
                  upsyncing = true;
                  upsync(id, function(stat) {
                    upsyncing = false;
                    back('upsync', false);
                  });
                }
              }
            });
          }
          else {
            back('error', false);
          }
        });
      }
      else {
        console.log(':: Don\'t downsync');
        back('same', false);
      }
    });
  }
  else {
    back('noid', false);
  }
}

export function checkRemoteRev(id, returnRev) {
  const request = new XMLHttpRequest();
  request.open('GET', 'https://spookmarks.com/rev/' + encodeURIComponent(id), true);
  request.onload = function() {
    if (request.status >= 200 && request.status < 400) {
      const remote = JSON.parse(request.responseText);
      const { _rev = '0' } = remote;
      if (_rev.length > 1) {
        const remoteVersion = _rev.split('-')[0];
        chrome.storage.sync.get('rev', function(revData) {
        	const { rev = '0' } = revData;
          const localVersion = rev.split('-')[0];
          if (remoteVersion > localVersion) {
            returnRev(true);
          }
          else {
            returnRev(remoteVersion);
          }
        });
      }
      else {
        returnRev('Not stored');
      }
    }
    else {
      returnRev(false);
    }
  };
  request.onerror = function() {
    returnRev('error');
  };
  request.send();
}

export function getRemoteSpooks(id, allSpooks) {
  const request = new XMLHttpRequest();
  request.open('GET', 'https://spookmarks.com/spooks/' + encodeURIComponent(id), true);
  request.onload = function() {
    if (request.status >= 200 && request.status < 400) {
      const data = JSON.parse(request.responseText);
      allSpooks(data);
    }
    else {
      allSpooks(false);
    }
  };
  request.onerror = function() {
    console.log('error');
  };
  request.send();
}

export function getAllSpooks(allSpooks) {
  const returnArray = [];
  chrome.storage.sync.get('spooks', function(data) {
    console.log(':: getAllSpooks', data);
    allSpooks(data.spooks);
  });
}

export function countSpooks(spookArr, returnData) {
  let unseenCount = 0,
	  unseenArray = [];
  for (const i in spookArr) {
    const sp = spookArr[i];
    if (sp.seen !== true) {
      unseenArray.push(sp);
      unseenCount++;
    }
    if (i == spookArr.length - 1) {
      returnData(unseenCount, unseenArray);
    }
  }
}

export function newModify(findBy, key, fieldToModify, newData, returnedArray) {
  chrome.storage.sync.get('spooks', function(data) {
    if (data.spooks) {
      const spookArr = JSON.parse(data.spooks);
      let toDelete = false;
      for (const i in spookArr) {
        const sp = spookArr[i];
        // console.log(findBy,key,fieldToModify,sp[findBy],key,spookArr.length);
        if (sp[findBy] == key) {
          console.log('Spook to modify', sp.createDate, fieldToModify, newData);
          if (fieldToModify == 'delete') {
            console.log(':: Deleting ' + i);
            toDelete = i;
          }
          else {
            sp[fieldToModify + ''] = newData;
            spookArr[i] = sp;
          }
        }
        if (i == spookArr.length - 1) {
          if (toDelete !== false) {
            spookArr.splice(toDelete, 1);
          }
          else {
            console.log(':: ' + sp.createDate + ' modified', fieldToModify + ' is now ' + newData);
          }

          chrome.storage.sync.set({ 'spooks': JSON.stringify(spookArr) }, function(saved) {
            chrome.extension.sendMessage({ updateCount: spookArr.length });
            returnedArray(spookArr);
          });
        }
      }
    }
    else {
      console.log(':: Something is wrong, no spooks found');
    }
  });
}

export function upsync(id, returnStatus) {
  const theId = id;
  if (typeof id !== 'undefined' && id !== false) {
    console.log(':: upsync', id);
    const xhr = new XMLHttpRequest();
    // Get locally stored
    chrome.storage.sync.get('spooks', function(data) {
      const { spooks } = data;
      if (spooks) {
        const allSpooks = JSON.parse(spooks);
        if (allSpooks.length > 0) {
          // Upload local spookmarks
          xhr.onload = function() {
            console.log(':: POST response', xhr.responseText);
            const userData = JSON.parse(xhr.responseText);
            chrome.storage.sync.set({ 'rev': userData.rev });
            returnStatus(userData);
          };
          xhr.open('POST', 'https://spookmarks.com/spooks/' + theId, true);
          xhr.send(JSON.stringify(allSpooks));
        }
      }
      else {
        // No local spooks
        console.log(':: No data stored, downsyncing');
        downsync(id, function(msg) {
          console.log(':: Downsync finished', msg);
          returnStatus(msg);
        });
      }
    });
  }
  else {
    console.log(':: ID not stored, no need to sync');
    returnStatus(false);
  }
}
