
function spook(){
	this.URL = document.getElementById('URL').value;
	this.title = document.getElementById('title').value;
	this.futureDate = document.getElementById('futureDate').value;
	
	this.note = document.getElementById('note').value;
	
	return this;
}

document.addEventListener('DOMContentLoaded', function () {
	var bg = chrome.extension.getBackgroundPage();
	
	chrome.tabs.query({active : true, currentWindow: true}, function (tabs) {
	   // document.getElementById("pdurl").value = tab[0].url;
		document.getElementById("URL").value = tabs[0].url;
		document.getElementById("title").value = tabs[0].title;
	});
	document.getElementById("spookThis").addEventListener("click", function(){
		var sp = new spook();
		console.log("spooked" + sp);
		saveSpook(sp);
	})
	document.getElementById("stepUp").addEventListener("click", function(){
		document.getElementById("intervalNumber").stepUp();
	})
	document.getElementById("stepDown").addEventListener("click", function(){
		if (document.getElementById("intervalNumber").value > 0){
			document.getElementById("intervalNumber").stepDown();
			
		}
	})
	chrome.storage.sync.get(null, function(items) {
	    var allKeys = Object.keys(items);
	    console.log(allKeys);
	    for (var i=0, len=allKeys.length; i<len;i++){
		    var li = document.createElement('li');
		    var itemObj = items[allKeys[i]];
		    console.log(itemObj);
		    li.innerHTML = itemObj.title;
		    document.getElementById("spookList").appendChild(li)
	    }
	});
	Tabs.init();
});

function saveSpook(spookObj) {
	var rightNow = new Date();
	var res = rightNow.toISOString().slice(0,10).replace(/-/g,"");
	var storeObj = {};
	storeObj[res] = spookObj;
	
	chrome.storage.sync.set(storeObj, function() {
		// Notify that we saved.
		console.log("Saved!",storeObj)
		//message('Settings saved');
		document.getElementById("status").innerHTML = "Spooked"
	});
}


var Tabs=function(){var config={selector:document.querySelectorAll(".tabs")};var _forEachElement=function(selector,fn){var elements=selector;for(var i=0;i<elements.length;i++){fn(elements[i],i)}};var _addEventListener=function(el,eventName,handler){if(el.addEventListener){el.addEventListener(eventName,handler)}else{el.attachEvent("on"+eventName,function(){handler.call(el)})}};var nextElementSibling=function(el){do{el=el.nextSibling}while(el&&el.nodeType!==1);return el};var previousElementSibling=function(el){do{el=el.previousSibling}while(el&&el.nodeType!==1);return el};var _showTabPanel=function(tabGroup,tabId){var tabs=tabGroup.querySelectorAll('[role="tab"]'),selectedTab=tabGroup.querySelector('[data-tab="'+tabId+'"'),tabPanel=tabGroup.querySelector('[data-panel="'+tabId+'"');_hideTabPanels(tabGroup,tabs);selectedTab.setAttribute("aria-selected",true);tabPanel.setAttribute("aria-hidden",false)};var _hideTabPanels=function(tabGroup,tabGroupTabs){var tabsPanels=tabGroup.querySelectorAll('[role="tabpanel"]');_forEachElement(tabGroupTabs,function(el,i){el.setAttribute("aria-selected",false)});_forEachElement(tabsPanels,function(el,i){el.setAttribute("aria-hidden",true)})};var _makeAccessible=function(el){var tabsList=el.querySelector("ul"),tabListItems=tabsList.querySelectorAll("li"),tabListLinks=tabsList.querySelectorAll("a"),tabPanels=el.querySelectorAll("div");tabsList.setAttribute("role","tablist");_forEachElement(tabListItems,function(el,i){el.setAttribute("role","presentation")});_forEachElement(tabListLinks,function(el,i){el.setAttribute("href","");el.setAttribute("data-tab",i);el.setAttribute("role","tab");el.setAttribute("aria-controls","panel-"+i);if(i===0){el.setAttribute("aria-selected",true)}else{el.setAttribute("aria-selected",false)}});_forEachElement(tabPanels,function(el,i){el.setAttribute("data-panel",i);el.setAttribute("role","tabpanel");el.setAttribute("aria-labeledby","tab-"+i);if(i===0){el.setAttribute("aria-hidden",false)}else{el.setAttribute("aria-hidden",true)}})};var init=function(options){for(var prop in options){if(options.hasOwnProperty(prop)){config[prop]=options[prop]}}_forEachElement(config.selector,function(el,i){_makeAccessible(el);var tab=el,tabsList=tab.querySelectorAll('[role="tab"]'),tabPanels=tab.querySelectorAll('[role="tabpanel"]');_forEachElement(tabsList,function(el,i){_addEventListener(el,"click",function(e){_showTabPanel(tab,el.getAttribute("data-tab"));e.preventDefault()});_addEventListener(el,"focus",function(e){_showTabPanel(tab,el.getAttribute("data-tab"));var evt=e||window.event;if(evt.preventDefault){evt.preventDefault()}else{evt.returnValue=false;evt.cancelBubble=true}});_addEventListener(el,"keydown",function(e){var active=document.activeElement;if(e.which===37){var prevTab=previousElementSibling(active.parentNode);if(prevTab){prevTab.querySelector("a").focus()}}else if(e.which===39){var nextTab=nextElementSibling(active.parentNode);if(nextTab){nextTab.querySelector("a").focus()}}})})})};return{init:init}}();

