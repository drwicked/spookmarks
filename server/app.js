var server = require('diet')
var app = server()


var dietStatic = require('diet-static')({ path: app.path+'/site/' });
var cookies = require('diet-cookies');
var pug = require('diet-pug')({path: app.path + '/site/pug/'});

app.header(pug)
app.footer(dietStatic);

app.listen('http://localhost:8000/')

app.get('/', function($){ 
	console.log("wat");
    $.render('index') 
})

app.get('/spook/', function($){ 
    $.render('post') 
})
	
var loki = require('lokijs');
// var db = new loki('loki.json',{autosave:true})

//var idbAdapter = new lokiIndexedAdapter('loki');
var db = new loki('loki.json', 
	{
		autoload: true,
		autoloadCallback : loadHandler,
		autosave: true, 
		autosaveInterval: 10000
	});

var users, spooks;

function loadHandler() {
	// if database did not exist it will be empty so I will intitialize here
	users = db.getCollection('users');
	if (users === null) {
		users = db.addCollection('users');
	}
	spooks = db.getCollection('spooks');
	if (spooks === null) {
		spooks = db.addCollection('spooks');
	}
}



//var db = new loki('loki.json')

/*
var users = db.addCollection('users',{unique:['userID']});
var spooks = db.addCollection('spooks',{indices:['userID']});
*/

app.post('/spook', function($){
	var spookData = $.body;
	if (spookData instanceof Object === false) {
		spookData = JSON.parse($.body);
		console.log("::PARSED",spookData);
	}
	var unique = spookData.uniqueID;
	if (!!spookData.userID && spookData.uniqueID == false) {
		
		// DOES USER EXIST IN DB
		var existingUser = users.find({userID:spookData.userID});
		console.log(existingUser);
		if (existingUser === null || existingUser == '') {
			unique = shortid.generate();
			console.log(":: New user",unique);
			
		} else {
			console.log("existingUser",existingUser,existingUser.uniqueID);
			unique = existingUser.uniqueID;
			
		}
		
		spookData.uniqueID = unique;
		users.insert({
			username: spookData.username,
			userID: spookData.userID,
			uniqueID: spookData.uniqueID,
			joined: Date.now(),
			updated: Date.now()
		});
		
	} else {
		var user = users.find({userID:spookData.userID});
		user.updated = Date.now();
		users.update(user);
		console.log("User "+spookData.userID + " updated");
	}

	spooks.insert({
		createDate: spookData.createDate,
		uniqueID: spookData.uniqueID,
		username: spookData.username,
		userID: spookData.userID,
		URL: spookData.URL,
		title: spookData.title,
		note: spookData.note,
		futureDate: spookData.futureDate,
	},function(foo){
		console.log(foo);
	});

	$.end(unique) 
})

app.get('/u/:userid',function($){
	$.data.moment = require('moment');
	$.data.spookmarks = spooks.find({userID:$.params.userid});
	$.json();
})
var shortid = require('shortid');
// Register
app.get('/user/new',function($){
	console.log($.query);
	$.data.uniqueID = shortid.generate();
	var userSplit = $.query.id.split('%7C');
	console.log(":: New user",userSplit);
	
	users.insert({
		auth: userSplit[0],
		userID: userSplit[1],
		uniqueID: $.data.uniqueID,
		joined: Date.now(),
		updated: Date.now()
	},function(done){
		console.log(":: User created",id,done);
		
		$.json();
	});
	
})

app.get('/users',function($){
	$.data.users = users.find();
	$.json();
})

//NOT SURE
/*
app.post('/user/new/:id',function($){
	console.log("post");
	$.data.uniqueID = shortid.generate();
	
	createUser($.params.id,$.data.uniqueID,function(){
		$.json();
	});
	
})
*/

function createUser(authMethod,id,uniqueId,thenDo){
	users.insert({
		auth: authMethod,
		id: id,
		uniqueId: uniqueId,
		joined: Date.now(),
		updated: Date.now()
	},function(done,two){
		console.log(":: User created",id,done,two);
		thenDo(done)
	});
}

app.post('/spooks/:userId', function($){
	var user = users.find({userid:$.params.userId});
	user.updated = Date.now();
	users.update(user);
	
	var addArray = JSON.parse($.body);
	console.log($.body,addArray);
	
	for (var b = 0; b < addArray.length; b++) {
		var sp = addArray[b];
		console.log(b);
		spooks.insert(sp,function(foo){
			console.log(":: Spook added",foo);
		});
	}
	
	
	//$.data.spookData = spooks.find({userID:$.params.userid});
	$.json();
})

app.get('/spooks/:userId', function($){
	var user = users.find({userid:$.params.userId});
	user.updated = Date.now();
	users.update(user);
	
	$.data.spookData = spooks.find({userID:$.params.userid});
	$.json();
})

app.get('/test/', function($){ 
	$.data.spookData = require('./test.json')
	$.json();
})

app.get('/list/', function($){ 
	$.data.moment = require('moment');
	$.data.spookmarks = spooks.find({futureDate: {'$gt': Date.now()} });
	var many = $.data.spookmarks.length;
	console.log(many+" spookmarks found");
	$.render('list');
})
function parseQuery(qstr) {
		var query = {};
		var a = qstr.substr(1).split('&');
		for (var i = 0; i < a.length; i++) {
				var b = a[i].split('=');
				query[decodeURIComponent(b[0])] = decodeURIComponent(b[1] || '');
		}
		return query;
}

// Create Server Instance 2
var app2 = server()
app2.listen('http://localhost:9000/')
app2.get('/', function($){ 
		$.end('welcome to my mobile api') 
})
