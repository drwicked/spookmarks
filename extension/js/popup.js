

var spooking = false, shouldClose = true;

const authService = new AuthService(env.AUTH0_DOMAIN, env.AUTH0_CLIENT_ID);

// Minimal jQuery
const $$ = document.querySelectorAll.bind(document);
const $  = document.querySelector.bind(document);

var user = {},sync = false;
function loggedInView() {
	authService.getProfile(function(err, profile) {
		if (err) {
			console.log(":: Authentication error",err);
			chrome.storage.sync.get('profile',function(p){
				user = JSON.parse(p);
			});
		} else {
			console.log(":: "+ profile.user_id + " is logged in");
			chrome.storage.sync.set({
				"profile": JSON.stringify(profile)
			});
			user = profile;
		}
		chrome.storage.sync.get('userid', function(theId) {
			if (Object.keys(theId).length === 0 && theId.constructor === Object) {
				console.log(":: userid not found: " + theId);
				chrome.storage.sync.set({
					"userid": user.user_id
				}, function() {
					console.log(":: userid saved");
					user.userID = user.userid
				});
			} else {
				user.userID = theId.userid;
			}
			document.getElementById('userID').value = user.userID;
			
			chrome.storage.sync.get('rev', function(rev) {
				if (Object.keys(rev).length === 0 && rev.constructor === Object) {
					console.log("No revision data stored. " +user.userID);
					registerUser(user.userID, function(thenData) {
						chrome.storage.sync.set({
							"rev": thenData
						}, function() {
							document.getElementById("rev").value = thenData;
							console.log(":: New User Saved", thenData);
						});
					})
				} else {
					console.log(":: Syncing enabled");
					document.getElementById('rev').value = rev.rev;
					document.getElementById("doSync").checked = 'checked';
					user.rev = rev.rev;
					user.sync = true;
				}
			})
			
		});

		$('#loginButton').innerHTML = "Logged In: " + user.nickname;
		$('#loginButton').addEventListener('mouseover', function() {
			$('#loginButton').innerHTML = "Log Out?";
		});
		$('#loginButton').addEventListener('mouseout', function() {
			$('#loginButton').innerHTML = "Logged In: " + user.nickname;
		});
		$('#loginButton').addEventListener('click', function() {
			authService.logout();
			window.close();
		});
	});
}


function defaultView(){
	$('.loggedIn').style.display = "none";
	$('#loginButton').addEventListener('click', function(){
		authService.show({
			theme: {
			logo: '/icons/icon128.png',
			primaryColor: "green"
			}
		},function(){
			$('#loginButton').innerHTML = "Logging In";
			setTimeout(function(){
				window.close();
			}, 1500)
		});
	});
}

document.addEventListener('DOMContentLoaded', function () {
	document.getElementById("spookThis").addEventListener("click", function(){
		checkSpook(function(sp){
			if (sp === false){
				status("Something went wrong")
			} else {
				if (spooking !== true){
					addSpook(sp,function(){
						if (shouldClose) {
							chrome.tabs.query({active : true, currentWindow: true}, function (tabs) {
							    chrome.tabs.remove(tabs[0].id, function() { 
									console.log(":: Spooked and closed", sp);
								});
							});
						} else {
							console.log(":: Spooked", sp);
						}
					});
				}
			}
		});
	})


	
	document.getElementById('configIcon').addEventListener("click", function(){
		var configPanel = document.getElementById('config');
		configPanel.style.display = (configPanel.style.display !== "none") ? "none" : "";
		
	})
	
	document.getElementById("clear").addEventListener("click", function(){
		document.getElementById("clear").innerHTML = "Are you sure?";
		document.getElementById("clear").addEventListener("click", function(){
			chrome.storage.sync.clear(function(){
				localStorage.clear();
				console.log("cleared")
				window.close();
			})
		})
	})
	document.getElementById("sync").addEventListener("click", function(){
		downsync(user.userID,function(stat,spooks){
			console.log(":: Button sync "+stat);
			if (spooks !== false){
				buildSpookList(spooks,function(unseenCount){
					updateUnseen(unseenCount,spooks.length);
					
				});
			}
		});
	})
	document.getElementById("stepUp").addEventListener("click", function(){
		document.getElementById("intervalNumber").stepUp();
		setFutureDate();
	})
	document.getElementById("stepDown").addEventListener("click", function(){
		if (document.getElementById("intervalNumber").value > 1){
			document.getElementById("intervalNumber").stepDown();
			setFutureDate();
		}
	})
	document.getElementById("intervalType").addEventListener("change", function(e){
		setFutureDate();
	})
	
	document.getElementById("putOffStepUp").addEventListener("click", function(){
		document.getElementById("putOffIntervalNumber").stepUp();
		saveSettings();
	})
	document.getElementById("putOffStepDown").addEventListener("click", function(){
		if (document.getElementById("putOffIntervalNumber").value > 1){
			document.getElementById("putOffIntervalNumber").stepDown();
			saveSettings();
		}
	})
	
	document.getElementById("putOffIntervalType").addEventListener("change", function(e){
		saveSettings();
	})
	document.getElementById("putOffIntervalNumber").addEventListener("change", function(e){
		saveSettings();
	})
	document.getElementById("closeTabSwitch").addEventListener("change", function(e){
		saveSettings();
	})
	try {
		//var bg = chrome.extension.getBackgroundPage();
		
		chrome.tabs.query({active : true, currentWindow: true}, function (tabs) {
		   // document.getElementById("pdurl").value = tab[0].url;
			document.getElementById("URL").value = tabs[0].url;
			document.getElementById("title").value = tabs[0].title;
			document.getElementById("editLink").innerHTML = trunc(tabs[0].title);
			//setFutureDate();
		});
		
	} catch(err) {
		
	}
	var accordion = new Accordion({
	    elem: "accordion",
	    //open: 1,
	    oneOpen: true,
	    titleClass: "titleClick",
	    contentClass: "b-accordion__content",
	});
	document.getElementById("title").addEventListener("keyup", function(e){
		document.getElementById("editLink").innerHTML = trunc(e.target.value, 64);
	})
	if(authService.isLoggedIn()){
		loggedInView();
	}else{
		defaultView();
	}
	
	chrome.storage.sync.get('settings', function(settingsObj) {
		if (typeof settingsObj.settings == "undefined") {
			settingsObj = defaultSettings;
			console.log(":: Initialized from popup, only happens after reset");
		} else {
			console.log(":: Spookmarks loaded successfully");
		}
		populateInputs(settingsObj);
		populateData(settingsObj);
	});

	initPicker();
	
	
});

var sync;

function status(msg){
	document.getElementById("status").innerHTML = msg;
}

function checkSpook(returnSpook){
	var spook = {}
	spook.URL = document.getElementById('URL').value;
	spook.title = document.getElementById('title').value;
	spook.seen = false;
	spook.createDate = Date.now();
	spook.futureDate = parseInt(document.getElementById('futureDate').value);
	if (spook.futureDate.length == 0 ) {
		status("No date set")
		returnSpook(false);
	}
	spook.note = document.getElementById('note').value;
	returnSpook(spook);
}
var picker;
function initPicker(date){
	picker = document.getElementById("datepicker").flatpickr({
		"inline": true,
		"minDate": "today",
		"enableTime": true,
		onChange: function(dateObj, dateStr, instance) {
			//var unixTime = unixTime();//moment(dateStr).unix()*1000;
			//document.getElementById("futureDate").value = unixTime(dateStr);
			setFutureDate(moment(dateStr),false);
		},

	});
}
function unixTime(t){
	if (!!t){
		return (new Date(t)).getTime()
	} else {
		return Date.now();
	}
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
    } else {  
      return str;  
    }  
  };
function shorten(str){
	if (str.indexOf('minutes') > -1) {
		str = str.replace(' minutes','m');
		
	} else if (str.indexOf('hours') > -1) {
	    str = str.replace(' hours','h');
	} else if (str.indexOf('days') > -1) {
	    str = str.replace(' days','d');
	} else if (str.indexOf('an hour') > -1) {
	    str = str.replace('an hour','1h');
	}
	return str;
}

function addSpookRow(itemObj){
	var future = ( itemObj.futureDate - new Date().valueOf() ) > 0;
    var row = document.createElement('tr');
	
    var timestr, str = moment(itemObj.futureDate).fromNow(true);
    var rowClass = future;
    str = shorten(str);
    if (future){
		timeStr = str;
	    row.classList.add('future');
    } else {
	    timeStr = '-'+str;
    		row.classList.add('past');
    }
    
    if (itemObj.seen === true){
	    row.classList.add('seen');
    }
    
    var rowHtml = '<td class="tdTitle"><a class="spookLink" href="'+itemObj.URL+'">'+trunc(itemObj.title,42)+'</a></td><td class="tdTime">'+timeStr+'</td><td id="'+itemObj.futureDate+'" data-createDate="'+itemObj.createDate+'" class="tdDelete">x</td>';
    row.innerHTML = rowHtml;
    
    document.getElementById("spookList").appendChild(row);
    
}

function populateData() {
	var unseen = [],unseenCount=0,totalCount = 0;
	user.unseen = [];
	
	chrome.storage.sync.get(null, function(items) {
	    var allKeys = Object.keys(items);
	    // Iterating all keys for now, there might be a better way
	    allKeys.forEach(function(v,i){
		    var itemObj = items[v][v] || items[v];
		    if (!!itemObj.title){
				console.log(":: Loaded direct");
			    if (itemObj.seen !== true){
				   unseenCount++
			    }
			    totalCount++
			    addSpookRow(itemObj);
			} else if (v == "spooks") {
				var spookArr = JSON.parse(itemObj);
				buildSpookList(spookArr,function(unseenCount){
					console.log("unseen",unseenCount);
					updateUnseen(unseenCount,spookArr.length);
				});
		    } else if (v == "settings") {
			    var s = items[v];
			    populateInputs(s);
		    } else if (v == "userid") {
			    
				document.getElementById("userID").value = items[v];
		    } else if (v == "rev") {
				document.getElementById("rev").value = items[v];
		    }
	    });
	    setFutureDate(null,false);
	});
}

function updateUnseen(count,total){
	console.log(":: "+total+" saved, "+count+" unseen.");
	chrome.extension.sendMessage({updateCount:count});
    if (count > 0) {
	    document.getElementById('listButton').innerHTML = ( (total>1) ? total + " Spookmarks : " + count + " unseen" :"1 Spookmark" );
    }
}

function populateInputs(s){
	document.getElementById("intervalType").value = s.intervalType || 'days';
	document.getElementById("intervalNumber").value = parseInt(s.interval) || 1;
	document.getElementById("putOffIntervalType").value = s.putOffIntervalType || 'days';
	document.getElementById("putOffIntervalNumber").value = parseInt(s.putOffIntervalNumber) || 1;
	shouldClose = s.closeAfterSpooked;
	document.getElementById("closeTabSwitch").checked =  shouldClose ? 'checked' : false;
}

function saveSettings(s) {
	s = s || {};
	var settingsObj = {};
	var putOffVal = s.putOffIntervalNumber || $("#putOffIntervalNumber").value || 2;
	var putOffType = s.putOffIntervalType || $("#putOffIntervalType").value || "minutes";
	var intVal = s.intervalNumber || $("#intervalNumber").value;
	var intType = s.intervalType || $("#intervalType").value;
	var doSync = document.getElementById('doSync').checked;
	var closeTabSwitch = document.getElementById('closeTabSwitch').checked;
	
	
	settingsObj["settings"] = {
		"interval":intVal,
		"intervalType":intType,
		"putOffIntervalNumber":putOffVal,
		"putOffIntervalType": putOffType,
		"unseen": user.unseen || [],
		"sync": doSync,
		"closeAfterSpooked": closeTabSwitch,
	}
	//settings = settingsObj["settings"];
	
	chrome.storage.sync.set(settingsObj, function() {
		console.log(':: Settings stored as object');
	});
}

function setFutureDate(mDate,save){
	var interval = !!$("#intervalNumber").value ? $("#intervalNumber").value : defaultSettings.interval;
	var intervalType = !!$("#intervalType").value ? $("#intervalType").value : defaultSettings.intervalType;
	if (!!mDate){
		var dayDiff = moment().diff(mDate,'days');
		interval = Math.abs(dayDiff);
		document.getElementById("intervalNumber").value = interval;
		intervalType = 'days';
	}
	var futureMoment = mDate || moment().add(interval,intervalType);
	var willCloseIndicator = shouldClose ? '<span id="willCloseIndicator">x</span>' : '';
	document.getElementById("spookThis").innerHTML = "Haunt Me In "+ interval +" "+intervalType + " " + willCloseIndicator;
	document.getElementById("futureDate").value = (futureMoment.unix()*1000) + Math.floor(Math.random() * 1000);
	document.getElementById("humanDate").innerHTML = futureMoment.format('MMMM Do, YYYY h:mm a');
	if (save !== false){
		picker.setDate(futureMoment.format('YYYY-MM-DD HH:mm'))
		saveSettings();
	}
}


function deleteSpook(el){
	var toDelete = el.getAttribute('data-createDate');
	newModify('createDate',toDelete,'delete',true,function(returnedArray){
		upsync(user.userID,function(syncStat){
			el.parentNode.remove();
			console.log(":: Post delete update",syncStat);
			status("Spook removed");
		});
	})
}


function addSpook(spookObj,back) {
	spooking = true;
	var unixFuture = spookObj.futureDate;
	var storeSpook = {};
	storeSpook[unixFuture] = spookObj;
	fadeOut( document.getElementById("topIcon") );

	chrome.storage.sync.get('spooks', function(data){
		var spookArr = JSON.parse(data.spooks);
		spookArr.push(spookObj);
		chrome.storage.sync.set({'spooks':JSON.stringify(spookArr)}, function() {
			console.log(":: Spook stored",spookObj);
			if (user.sync === true) {
				upsync(user.user_id,function(stat){
					console.log(stat);
					document.getElementById("spookThis").innerHTML = 'Spookmarks Synced';
					
				});
			} else {
				document.getElementById("spookThis").innerHTML = 'Spooked';
			}
			
			//Update badge count instantly with message passing
			countSpooks(spookArr,function(unseenCount,unseenArr){
				chrome.extension.sendMessage({updateCount:unseenCount});
			});
			fadeIn( document.getElementById("buttonGhost") );
			setTimeout(function(){
				spooking = false;
				back();
				window.close();
			}, 900)
		});
		
	})
}

function buildSpookList(spookArr,unseen) {
	var unseenCount = 0;
	for(var i in spookArr){
		sp = spookArr[i];
		if (sp.seen !== true){
			unseenCount = unseenCount + 1;
		}
		addSpookRow(sp);
		if (i == spookArr.length-1){
			unseen(unseenCount);	
		}
	}
}

function registerUser(userID, thenData){
	userID = userID, document.getElementById("userID").value;
	var request = new XMLHttpRequest();
	request.open('GET', 'https://spookmarks.com/register/'+encodeURIComponent(userID), true);
	request.onload = function() {
		if (request.status >= 200 && request.status < 400) {
			// Success!
			console.log(":: Successfully registered " + userID);
			var data = JSON.parse(request.responseText);
			thenData(data.userData.rev)
		} else {
			// We reached our target server, but it returned an error
			console.log("Errortown. Population this.",request.status);
		}
	};
	
	request.onerror = function(err) {
		console.log("error",err);
		// There was a connection error of some sort
	};
	
	request.send();
}

function param(object) {
    var encodedString = '';
    for (var prop in object) {
        if (object.hasOwnProperty(prop)) {
            if (encodedString.length > 0) {
                encodedString += '&';
            }
            encodedString += encodeURI(prop + '=' + object[prop]);
        }
    }
    return encodedString;
}

function fadeOut(el){
  el.style.opacity = 1;

  (function fade() {
    if ((el.style.opacity -= .1) < 0) {
      el.style.display = "none";
    } else {
      requestAnimationFrame(fade);
    }
  })();
}
function fadeIn(el, display){
  el.style.opacity = 0;
  el.style.display = display || "block";

  (function fade() {
    var val = parseFloat(el.style.opacity);
    if (!((val += .1) > 1)) {
      el.style.opacity = val;
      requestAnimationFrame(fade);
    }
  })();
}

Accordion = function(options) {
    var elem = document.getElementById(options.elem),
        openTab = options.open || undefined,
        oneOpen = options.oneOpen || false,
        titleClass = options.titleClass || "b-accordion__title",
        contentClass = "b-accordion__content";
        
    render();
    function render() {
        elem.addEventListener("click", onClick);
        closeAll();
        if (openTab) open(openTab);
    }
    function onClick(e) {
        if (e.target.className.indexOf(titleClass) === -1) {
	        console.log("click",titleClass,e.target.className);
	        if (e.target.className.indexOf('tdDelete') > -1) {
		        deleteSpook(e.target);
	        } else if (e.target.className.indexOf('spookLink') > -1) {
		        chrome.tabs.create({url: e.target.href});
	        }
	        return
	    } else {
	        if (oneOpen) closeAll();
	        toggle(e.target.parentNode.nextElementSibling);
	    }
        
    }
    function closeAll() {
        [].forEach.call(elem.querySelectorAll("." + contentClass), function(item) {
            item.style.display = "none";
        });
    }
    function toggle(el) {
        el.style.display = (el.style.display !== "none") ? "none" : "";
    }
    function open(n) {
        if (oneOpen) closeAll();
        elem.querySelectorAll("." + contentClass)[n - 1].style.display = "";
    }
    function close(n) {
        elem.querySelectorAll("." + contentClass)[n - 1].style.display = "none";
    }
    
    this.open = open;
    this.close = close;
}



