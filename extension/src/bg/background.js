
chrome.extension.onMessage.addListener(
  function(request, sender, sendResponse) {
  	chrome.pageAction.show(sender.tab.id);
    sendResponse();
  });
  
var currentSpookArray = [];
chrome.alarms.onAlarm.addListener(function( alarm ) {
	if( alarm.name == 'tick' ){
		chrome.storage.sync.get('spookArray', function(arr){
			var checkArray = arr.spookArray || [];
			currentSpookArray = checkArray;
			checkArray.forEach(function(epochInt,i){
				var diff = ( epochInt - new Date().valueOf() );
				var epochString = epochInt.toString();
				
				//console.log(diff);
				// If spook in next 5 minutes
				if (diff < 300000) {
					if (diff > 0) {
						chrome.storage.sync.get(epochString, function(spookData){
							try {
								if (spookData[epochString].seen != true) {
									showNotification(spookData[epochString])
								} else {
									console.log(":: Spook seen");
								}
							} catch (err){
								console.log(err);
							}
							
						})
					} else {
						
					}
				}
			});
		});
	}
	console.log(":: Tick");
});


chrome.storage.sync.get('spookArray', function(arr){
	try {
		var checkArray = arr.spookArray;
		checkArray.forEach(function(v,i){
			console.log( ( v - new Date().valueOf() ) / 60000 + "min");
		});
		chrome.alarms.create("tick", {delayInMinutes: 1, periodInMinutes: 1});
		console.log(":: Tick started")
	} catch(err){
		console.log(":: No spooks saved.")
	}
});

function showNotification(notifyData) {
	console.log(":: Notification")
	var daysAgo = Math.floor( (new Date().valueOf() - notifyData.createDate)/86400000 );
    chrome.notifications.create('spook', {
        type: 'basic',
        iconUrl: '/icons/icon128.png',
        title: notifyData.title,
        message: notifyData.note || '',
        contextMessage: "Saved "+daysAgo+" days ago.",
        buttons: [{
            title: "Visit link at "+ domainFromUrl(notifyData.URL)
        }, {
            title: "Put off for a day"
        }]
     }, function(notificationId) {});
     
     chrome.notifications.onButtonClicked.addListener(function(id,btnIndex){
	     if (btnIndex === 0){
		     // Visit URL
		     chrome.tabs.create({url: notifyData.URL});
		     modifySpook(notifyData.futureDate,"seen",true,function(){
			 	var poppedArray = removeKeyFromArray(notifyData.futureDate,currentSpookArray) || currentSpookArray;
			 	chrome.storage.sync.set({"spookArray":poppedArray}, function(){
			 		console.log(":: Removed from spookarray");
				})
			 });
	     } else {
		     putOff(notifyData);
	     }
	     chrome.notifications.clear('spook', function(){});
     })
     
}
function putOff(notifyData){
	console.log("Put off",notifyData);
	chrome.storage.sync.get('spookArray', function(arr){
		var array = arr.spookArray || currentSpookArray;
		if (array.length>0){
			chrome.storage.sync.get(notifyData.futureDate+'', function(spook){
				//Get index
				var index = array.indexOf(notifyData.futureDate);
				//Add a day in milliseconds
				var newFutureDate = notifyData.futureDate + 86400000;
				//Replace index with new date
				array[index] = newFutureDate;
				//array.splice(index, 1);
				var arrayWithoutKey = removeKeyFromArray(notifyData.futureDate,array);
				// set new spook
				var newObj = {};
				newObj[newFutureDate] = spook;
				chrome.storage.sync.set(newObj, function(){
					// remove old spook
					chrome.storage.sync.remove(notifyData.futureDate+'', function(){
						console.log(":: Put off spook");
					})
				})

				
			})
			
			
		}
	});
}

function modifySpook(timeKey,fieldToModify,newValue,cb){
	chrome.storage.sync.get('spookArray', function(arr){
		var spookArray = arr.spookArray || currentSpookArray;
		if (spookArray.length>0){
			var index = spookArray.indexOf(timeKey);
			chrome.storage.sync.get(timeKey+'', function(spook){
				var spookObj = spook[timeKey];
				spookObj[fieldToModify] = newValue;
				var saveObj = {};
				saveObj[timeKey.toString()] = spookObj;
				chrome.storage.sync.set(saveObj, function(){
					console.log(":: modified spook. "+timeKey+"'s value for "+fieldToModify+" is now "+newValue);
					cb();
				})

				
			})
			
			
		}
	});
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
/*
chrome.storage.sync.get(, function() {
	// Notify that we saved.
	console.log("Saved!",storeObj)
	//message('Settings saved');
	status("Spooked");
});
*/