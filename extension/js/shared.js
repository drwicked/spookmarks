var defaultSettings = {
	intervalType: 'days',
	interval: '1',
	putOffIntervalType: 'days',
	putOffIntervalNumber: '1',
	spooks: [],
	unseen: [],
	sync: false,
	closeAfterSpooked: true,
}

var upsyncing = false;
function downsync(id,back) {
	if (id !== false) {
		checkRemoteRev(id,function(result){
			if (result == true) {
				console.log("Down");
				getRemoteSpooks(id,function(remoteData){
					if (remoteData !== false){
						var userData = remoteData.userData;
						var localRev=0,
						remoteRev = parseInt(userData._rev.split('-')[0]) || 0;
						chrome.storage.sync.get("rev", function(revData) {
							if (typeof revData.rev != 'undefined'){
								localRev = parseInt(revData.rev.split('-')[0]) || 0;
							}
							console.log(":: Local version: "+localRev+ " has " +userData.spooks.length+ " spooks | Remote version: "+remoteRev+" has "+remoteData.userData.spooks.length+" spooks");	
							if (remoteRev > localRev) {
								console.log(":: Remote data is new");
								chrome.storage.sync.set({"spooks":JSON.stringify(userData.spooks)}, function() {
									chrome.storage.sync.set({"rev":userData._rev}, function() {
										console.log(":: Downsync complete");
										back("downsync",userData.spooks)
									});
								})
							} else if (remoteRev == localRev) {
								back("samesame",false)
							} else if (localRev > remoteRev) {
								console.log("This should never happen");
								if (upsyncing !== true) {
									upsyncing = true;
									upsync(id,function(stat){
										upsyncing = false;
										back("upsync",false);
									});
								}
							}
						})
					} else {
						back("error",false)
					}
				})
			} else {
				console.log(":: Don't downsync");
				back("same",false)
			}
			
		
		})
	} else {
		back("noid",false);
	}
}

function checkRemoteRev(id,returnRev){
	var request = new XMLHttpRequest();
	request.open('GET', 'https://spookmarks.com/rev/'+encodeURIComponent(id), true);
	request.onload = function() {
		if (request.status >= 200 && request.status < 400) {
			var remote = JSON.parse(request.responseText);	
			if (!!remote._rev) {
				var remoteVersion = remote._rev.split('-')[0];
				chrome.storage.sync.get("rev", function(revData) {
					var localVersion = revData.rev.split('-')[0];
					if (remoteVersion > localVersion) {
						returnRev(true);
					} else {
						returnRev(remoteVersion);
						
					}
				});
			} else {
				returnRev("Not stored")
			}
		} else {
			returnRev(false);
		}
	};
	request.onerror = function() {
		returnRev("error");
	};
	request.send();
}

function getRemoteSpooks(id,allSpooks){
	var request = new XMLHttpRequest();
	request.open('GET', 'https://spookmarks.com/spooks/'+encodeURIComponent(id), true);
	request.onload = function() {
		if (request.status >= 200 && request.status < 400) {
			var data = JSON.parse(request.responseText);	
			allSpooks(data);
		} else {
			allSpooks(false);
		}
	};
	request.onerror = function() {
		console.log("error");
	};
	request.send();
}

function getAllSpooks(allSpooks) {
	var returnArray = [];
	chrome.storage.sync.get('spooks', function(data) {
		console.log(":: getAllSpooks",data);
		allSpooks(data.spooks);
	})
}

function countSpooks(spookArr,returnData){
	var unseenCount = 0,unseenArray = [];
	for(var i in spookArr){
		var sp = spookArr[i];
		if (sp.seen !== true){
			unseenArray.push(sp);
			unseenCount++;
		}
		if (i == spookArr.length-1){
			returnData(unseenCount,unseenArray);
		}
	}
}


function newModify(findBy,key,fieldToModify,newData,returnedArray) {
	chrome.storage.sync.get('spooks', function(data){
		if (!!data.spooks) {
			var spookArr = JSON.parse(data.spooks);
			var toDelete = false;
			for(var i in spookArr){
				var sp = spookArr[i];
				//console.log(findBy,key,fieldToModify,sp[findBy],key,spookArr.length);
				if (sp[findBy] == key) {
					console.log("Spook to modify",sp.createDate,fieldToModify,newData);
					if(fieldToModify == 'delete'){
						console.log(":: Deleting "+i);
						toDelete = i;
					} else {
						sp[fieldToModify+''] = newData;
						spookArr[i] = sp;
					}
				} 
				if (i == spookArr.length-1){
					if (toDelete !== false) {
						spookArr.splice(toDelete, 1);
					} else {
						console.log(":: "+sp.createDate + " modified",fieldToModify + " is now " + newData);
					}
					
					chrome.storage.sync.set({'spooks':JSON.stringify(spookArr)},function(saved){
						chrome.extension.sendMessage({updateCount:spookArr.length});
						returnedArray(spookArr);
					})
				}
			}
		} else {
			console.log(":: Something is wrong, no spooks found");
		}
	})
}


function upsync(id,returnStatus){
	console.log("::upsync",id);
	var theId = id;
	if (id !== false) {
		var xhr = new XMLHttpRequest();
		// Get locally stored
		chrome.storage.sync.get('spooks', function(data) {
			if(!!data.spooks) {
				var allSpooks = JSON.parse(data.spooks);
				if (allSpooks.length > 0) {
					xhr.onload = function(){
						console.log(":: POST response",xhr.responseText);
						var userData = JSON.parse(xhr.responseText);
						chrome.storage.sync.set({'rev':userData.rev});
						returnStatus(userData);
					}
					xhr.open ('POST', 'https://spookmarks.com/spooks/'+theId, true);
					xhr.send ( JSON.stringify(allSpooks) );
				}
			} else {
				// No local spooks
				console.log(":: No data stored, downsyncing");
				downsync(id,function(msg){
					console.log(":: Downsync finished",msg);
					returnStatus(userData);
				})
			}
		})
		
	} else {
		console.log(":: ID not stored");
		returnStatus(false);
	}

}