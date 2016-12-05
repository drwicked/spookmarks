
chrome.extension.onMessage.addListener(
	function(request, sender, sendResponse) {
		if (!!request.updateCount) {
			setBadge(request.updateCount)
		} else if (!!request.syncUserID) {
			upsync(userID,function(info){
				console.log(":: Spooks synchronized",request.syncUserID);
			});
		} else if (!!request.downsync) {
			downsync(request.downsync,function(info){
				console.log(":: Spooks downsynced",request.downsync);
			});
		} else if (!!request.loadData) {
			loadData(function(){
				console.log(":: Data loaded by msg request");
			})
		}
	}
);
function tick(){
	var now = new Date().valueOf(),
	overdue = false;
	loadData(function(gotSettings){
		var unseenArray = gotSettings.unseen;
		unseenArray.forEach(function(sp,index) {
			var epochInt = parseInt(sp.futureDate);
			var epochString = epochInt.toString();
			
			var diff = ( epochInt - now );
			// If spook in next 5 minutes
			if (diff < 300000) {
				if (diff < 0) {
					overdue = true;
				}
				try {
					if (sp.seen != true) {
						showNotification(sp);
					} else {
						console.log(":: Spook seen");
					}
				} catch (err){
					console.log(err);
				}
				
			}

		});
	},true);
}

chrome.alarms.onAlarm.addListener(function( alarm ) {
	if( alarm.name == 'tick' ){
		tick();
	} else if (alarm.name == 'sync'){
		chrome.storage.sync.get('userid', function(data){
			downsync(data.userid,function(msg,newData){
				console.log(":: Sync tick "+ msg);
			});
		})
	}
});

function setBadge(val){
	val = val || 0;
	if (val > 0 && val < 10){
		chrome.browserAction.setBadgeBackgroundColor({color:[180, 58, 38,100]});	
		chrome.browserAction.setBadgeText({ text: val.toString() });
	} else if (val > 10) {
		chrome.browserAction.setBadgeText({ text: "10+" });
	} else {
		chrome.browserAction.setBadgeText({text:''});
	}
}

var settings = {}, settingsSaved = false;
var unseenCount;

function loadData(cb,cache) {
	var now = new Date().valueOf();
	var settingsData = {};
	chrome.storage.sync.get(null, function(items) {
	    var allKeys = Object.keys(items);
	    unseenCount = 0;
	    if (!!items.settings) {
		    settingsSaved  = true;
		    settingsData = items.settings
	    } else {
		    settingsData = defaultSettings;
		    chrome.storage.sync.set({"settings":defaultSettings}, function() {
			    settingsSaved = true;
				console.log(':: Fresh settings initialized');
			});
	    }
	    if (!!items.userid) {
		    settingsData.userID = items.userid;
		    userID = items.userid
	    } else {
		    userID = false;
	    }
	    settings = settingsData;
	    
	    if (!!items.spooks){
		    var spookArr = JSON.parse(items.spooks);
		    countSpooks(spookArr,function(count,unseen){
		    		setBadge(count);
		    		settingsData.unseen = unseen;
			    cb(settingsData,userID);
		    });
	    } else {
		    settingsData.unseen = [];
		    cb(settingsData,userID)
	    }
	});
		
	
}
loadData(function(d,savedUser){
	console.log(":: Data Loaded, tick started",savedUser);
	chrome.alarms.create("tick", {delayInMinutes: 1, periodInMinutes: 1});
	chrome.alarms.create("sync", {delayInMinutes: 1, periodInMinutes: 5});
	
	downsync(savedUser,function(msg,newData){
		console.log(":: Sync msg "+ msg);
	});
	
	tick();
});

var notifications = {},notifyUrls = {},clicked={};

function showNotification(notifyData) {
	if (Notification.permission !== "granted")
		Notification.requestPermission();
	else {
		//console.log(":: Notification", notifyData);
		var daysAgo = Math.floor((new Date().valueOf() - notifyData.createDate) / 86400000);
		var ago = moment(notifyData.createDate).fromNow();
		if ( typeof notifications[notifyData.createDate] == 'undefined') {
			// Hack for singularizing interval type
			var intervalTypeDisplay = settings.putOffIntervalType || 'days';
			var intervalNumDisplay = parseInt(settings.putOffIntervalNumber) || 1;
			if (intervalNumDisplay == 1) {
				intervalTypeDisplay = intervalTypeDisplay.substring(0, intervalTypeDisplay.length - 1);
			}
			notifications[notifyData.createDate] = chrome.notifications.create('spook_' + notifyData.createDate, {
				type: 'basic',
				iconUrl: '/icons/icon128.png',
				title: notifyData.title,
				message: notifyData.note || '',
				requireInteraction: true,
				contextMessage: "Saved " + ago,
				buttons: [{
					title: "Open link from " + domainFromUrl(notifyData.URL)
				}, {
					title: "Put off for " + intervalNumDisplay + " " + intervalTypeDisplay
				}]
			}, function(notificationId) {
				var opened = false;
				notifyUrls[notificationId] = notifyData.URL;
				chrome.notifications.onButtonClicked.addListener(function(notifID, btnIndex) {
					if (btnIndex === 0 && opened === false && clicked[notifID] !== true) {
						// Visit URL
						newModify('futureDate',notifyData.futureDate, "seen", true, function(moddedArray) {
							chrome.notifications.clear(notifID, function() {
								upsync(userID,function(stat){
									console.log(":: Spooks posted after modification");
								})
							});
						});
						clicked[notifID] = true;
						opened = true;

						chrome.tabs.create({
							url: notifyUrls[notifID]
						});
					} else if (btnIndex === 1 && opened === false && clicked[notifID] !== true) {
						clicked[notifID] = true;
						opened = true;
						putOff(notifyData, settings.putOffIntervalNumber, settings.putOffIntervalType,function(stat){
							chrome.notifications.clear(notifID, function() {
								
							});
						});
					}
				})
				
				chrome.notifications.onClosed.addListener(function(notifID, btnIndex) {
					console.log(btnIndex);
					if (btnIndex !== 0||btnIndex !== 1) {
						newModify('futureDate',notifyData.futureDate, "seen", true, function(moddedArray) {
							upsync(userID,function(stat){
								console.log(":: Spook marked as seen.");
							})
						});
						
					}
				})
			});
		} else {
			console.log(":: Listener already added");
		}

	}

}



function putOff(notifyData,intNumber,intType,whenDone){
	var oldSpook = notifyData.futureDate+'';
	var newFutureDate = moment(notifyData.futureDate).add(intNumber,intType).unix()*1000;
	newModify('createDate',notifyData.createDate,'futureDate',newFutureDate,function(arr){
		console.log(":: Put off for "+intNumber+" "+intType,notifyData);
		upsync(userID,function(stat){
			console.log(":: Modified and synced",stat);
			whenDone(":: Successfully put off"+stat);
		})
	})
}


function removeKeyFromArray(key,arr){
	var index = arr.indexOf(key);
	arr.splice(index, 1);
	return arr;
}

function domainFromUrl(data) {
  var    a      = document.createElement('a');
         a.href = data;
  return a.hostname;
}