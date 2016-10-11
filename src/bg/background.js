
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
			checkArray.forEach(function(v,i){
				var diff = ( v - new Date().valueOf() );
				console.log(diff);
				// If spook in next 5 minutes
				if (diff < 300000) {
					if (diff > 0) {
						chrome.storage.sync.get(v+'', function(spookData){
							try {
								console.log("spook soon",spookData[v])
								showNotification(spookData[v+''])
							} catch (err){
								console.log(err);
							}
							
						})
					} else {
						console.log("past",v);
					}
				}
			});
		});
	}
	console.log("Got an alarm!", alarm);
});


chrome.storage.sync.get('spookArray', function(arr){
	try {
		var checkArray = arr.spookArray;
		console.log(arr);
		checkArray.forEach(function(v,i){
			console.log( ( v - new Date().valueOf() ) / 60000 + "min");
		});
		chrome.alarms.create("tick", {delayInMinutes: 1, periodInMinutes: 1});
		console.log("tick started")
	} catch(err){
		console.log(":: No spooks saved.")
	}
});

function showNotification(notifyData) {
	console.log("notify",notifyData)
	var daysAgo = Math.floor( (new Date().valueOf() - notifyData.createDate)/86400000 );
    chrome.notifications.create('spook', {
        type: 'basic',
        iconUrl: '../../icons/icon128.png',
        title: notifyData.title,
        message: notifyData.notes || '',
        contextMessage: "Saved "+daysAgo+" days ago.",
        buttons: [{
            title: "Visit link at "+ domainFromUrl(notifyData.URL)
        }, {
            title: "Put off for a day"
        }]
     }, function(notificationId) {});
     
     chrome.notifications.onButtonClicked.addListener(function(id,btnIndex){
	     console.log(id,btnIndex)
	     if (btnIndex === 0){
		     // Visit URL
		     chrome.tabs.create({url: notifyData.URL});
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
			console.log("before",array);
			
			chrome.storage.sync.get(notifyData.futureDate+'', function(spook){
				console.log(spook);
				//Get index
				var index = array.indexOf(notifyData.futureDate);
				//Add a day in milliseconds
				var newFutureDate = notifyData.futureDate + 86400000;
				//Replace index with new date
				array[index] = newFutureDate;
				
				//array.splice(index, 1);
				var arrayWithoutKey = removeKeyFromArray(notifyData.futureDate,array);
				console.log("after",array,arrayWithoutKey);
				// set new spook
				chrome.storage.sync.set({newFutureDate:spook}, function(){
					// remove old spook
					chrome.storage.sync.remove(notifyData.futureDate+'', function(){
						console.log("removed")
					})
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