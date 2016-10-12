

var spooking = false;
document.addEventListener('DOMContentLoaded', function () {
	document.getElementById("spookThis").addEventListener("click", function(){
		var sp = spook();
		if (sp === false){
			console.log("nope")
		} else {
			console.log("spooked" + sp);
			if (spooking !== true){
				saveSpook(sp);
				
			}
		}
	})
	document.getElementById("clear").addEventListener("click", function(){
		chrome.storage.sync.clear(function(){
			console.log("cleared")
		})
	})
	document.getElementById("stepUp").addEventListener("click", function(){
		document.getElementById("intervalNumber").stepUp();
		setFutureDate();
	})
	document.getElementById("intervalType").addEventListener("change", function(e){
		setFutureDate();
		
	})
	
	document.getElementById("stepDown").addEventListener("click", function(){
		if (document.getElementById("intervalNumber").value > 1){
			document.getElementById("intervalNumber").stepDown();
			setFutureDate();
		}
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
		console.log(e.target.value,"bleh")
		document.getElementById("editLink").innerHTML = trunc(e.target.value, 64);
	})
	document.getElementById('toggleAlarm').addEventListener('click', doToggleAlarm);
	checkAlarm();
	//notifyMe();

	chrome.storage.sync.get('spookArray', function(array) {
		console.log("spook",array.spookArray);
		spookArray = array.spookArray;
	});

	initPicker();
	initList();
});

var spookArray = [];

function status(msg){
	document.getElementById("status").innerHTML = msg;
}

function spook(){
	var spook = {}
	spook.URL = document.getElementById('URL').value;
	spook.title = document.getElementById('title').value;
	spook.createDate = moment().unix()*1000;
	spook.futureDate = parseInt(document.getElementById('futureDate').value);
	if (spook.futureDate.length == 0 ) {
		console.log("barf");
		status("No date set")
		return false;
	}
	spook.note = document.getElementById('note').value;
	return spook;
}
var picker;
function initPicker(date){
	picker = document.getElementById("datepicker").flatpickr({
		"inline": true,
		"minDate": "today",
		"enableTime": true,
		onChange: function(dateObj, dateStr, instance) {
			var unixTime = moment(dateStr).unix()*1000;
			document.getElementById("futureDate").value = unixTime;
			setFutureDate(moment(dateStr));
		},

	});
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
	console.log('shorten',str);
	return str;
}
function initList() {
	var storedIntervalType = 'days', storedInterval = '1';
	
	chrome.storage.sync.get(null, function(items) {
	    var allKeys = Object.keys(items);
		console.log(allKeys);
	    allKeys.forEach(function(v,i){
		    var itemObj = items[v];
		    if (!!itemObj.title){
			    var future = ( itemObj.futureDate - new Date().valueOf() ) > 0;
			    var row = document.createElement('tr');

			    var timestr, str = moment(itemObj.futureDate).fromNow(true);
			    var rowClass = future;
			    str = shorten(str);
			    console.log("make row");
			    if (future){
				    timeStr = str;
				    row.classList.add('future');
			    } else {
				    timeStr = '-'+str;
			    		row.classList.add('past');
			    }
			    
			    var rowHtml = '<td class="tdTitle"><a href="'+itemObj.URL+'">'+trunc(itemObj.title,42)+'</a></td><td class="tdTime">'+timeStr+'</td><td id="'+itemObj.futureDate+'" data-futureDate="'+itemObj.futureDate+'" class="tdDelete">x</td>';
			    row.innerHTML = rowHtml;
			    
			    document.getElementById("spookList").appendChild(row);
			    
		    } else if (v == "intervalType") {
			    storedIntervalType = items[v];
			    console.log("intType",storedIntervalType)
			    document.getElementById("intervalType").value = storedIntervalType;
		    } else if (v == "interval") {
			    storedInterval = items[v];
			    console.log("int",storedInterval)
			    document.getElementById("intervalNumber").value = storedInterval;
		    }
	    });
	    setFutureDate();
	});
}
function setFutureDate(mDate){
	var interval = document.getElementById("intervalNumber").value || 1;
	var intervalType = document.getElementById("intervalType").value || 'days';
	
	chrome.storage.sync.set({"intervalType":intervalType,"interval":interval}, function() {
		console.log('success');
		//initList();
	});
	
	if (!!mDate){
		var dayDiff = moment().diff(mDate,'days');
		interval = Math.abs(dayDiff);
		document.getElementById("intervalNumber").value = interval;
		intervalType = 'days';
	}
	var futureMoment = mDate || moment().add(interval,intervalType);
	document.getElementById("spookThis").innerHTML = "Haunt Me In "+ interval +" "+intervalType;
	document.getElementById("futureDate").value = futureMoment.unix()*1000;
	document.getElementById("humanDate").innerHTML = futureMoment.format('MMMM Do, YYYY h:mm a');
	picker.setDate(futureMoment.format('YYYY-MM-DD HH:mm'))
}
function deleteSpook(el){
	var toDelete = el.getAttribute('data-futureDate');
	var index = spookArray.indexOf( parseInt(toDelete) );
	spookArray.splice(index, 1);
	var saveObj = {};
	saveObj['spookArray'] = spookArray;
	chrome.storage.sync.set(saveObj, function() {
		chrome.storage.sync.remove(toDelete, function(){
			el.parentNode.remove();
			status("Spook removed");
		})
	});
}
function saveSpook(spookObj) {
	spooking = true;
	var storeObj = {};
	var unixFuture = moment(spookObj.futureDate).unix()*1000;
	storeObj[unixFuture] = spookObj;
	fadeOut( document.getElementById("topIcon") );
	chrome.storage.sync.get('spookArray', function(array) {
		//console.log("get spooks",array);
		var arr = [];
		if(!!array.spookArray && array.spookArray.length > 0){
			console.log("array updated",arr,array.spookArray);
			arr = array.spookArray;
		}
		arr.push(unixFuture);
		var saveObj = {};
		saveObj['spookArray'] = arr;
		chrome.storage.sync.set(saveObj, function() {
			console.log(saveObj);
			//status("Array updated");
			chrome.storage.sync.set(storeObj, function() {
				document.getElementById("spookThis").innerHTML = 'Spooked';
				
				fadeIn( document.getElementById("buttonGhost") );
				setTimeout(function(){
					window.close();
					spooking = false;
				}, 1500)
			});
		});

	});
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
function notifyMe() {
	if (Notification.permission !== "granted")
		Notification.requestPermission();
	else {
		var notification = new Notification('Notification title', {
			icon: 'http://cdn.sstatic.net/stackexchange/img/logos/so/so-icon.png',
			body: "Hey there! You've been notified!",
		});
	
		notification.onclick = function () {
			window.open("http://stackoverflow.com/a/13328397/1269037");      
		};
	}
}


// ALARMS
var alarmName = 'remindme';
function checkAlarm(callback) {
 chrome.alarms.getAll(function(alarms) {
	 console.log("all alarms",alarms);
   var hasAlarm = alarms.some(function(a) {
     return a.name == alarmName;
   });
   var newLabel;
   if (hasAlarm) {
     newLabel = 'Cancel alarm';
   } else {
     newLabel = 'Activate alarm';
   }
   document.getElementById('toggleAlarm').innerText = newLabel;
   if (callback) callback(hasAlarm);
 })
}
function createAlarm() {
 chrome.alarms.create("tick", {
   delayInMinutes: 1, periodInMinutes: 1});
}

function createAlarmEpoch(unixTime,spookObj) {
	var storeObj = {};
	storeObj['alarm_'+unixTime] = spookObj;
	chrome.storage.local.set(storeObj, function(done){
		console.log("stored",storeObj);
	});
	chrome.alarms.create('alarm_'+unixTime, {
		when: unixTime
	});
}

function cancelAlarm() {
 chrome.alarms.clear(alarmName);
}
function doToggleAlarm() {
 checkAlarm( function(hasAlarm) {
   if (hasAlarm) {
     cancelAlarm();
   } else {
     createAlarm();
   }
   checkAlarm();
 });
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
	        }
	        return
	    };
        
        if (oneOpen) closeAll();
        toggle(e.target.parentNode.nextElementSibling);
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