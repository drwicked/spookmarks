import Auth0Lock from 'auth0-lock';
const lock = new Auth0Lock(secrets.AUTH0_CLIENT_ID, secrets.AUTH0_DOMAIN);

lock.on('authenticated', function (authResult) {
	localStorage.setItem('idToken', authResult.idToken);
	lock.getProfile(authResult.idToken, function(error, profile) {
		if (!!profile.user_id){
			chrome.storage.sync.set({"userid": profile.user_id},function(){
				chrome.extension.sendMessage({'downsync':profile.user_id});
				console.log(":: Downsyncing");
				if (Notification.permission !== "granted")
					Notification.requestPermission();
				else {
					var notification = new Notification('Spookmarks', {
						icon: '../../icons/icon128.png',
						body: "You are now logged in.\nSyncing your Spookmarks.",
					});
				}
				window.close();
				
			})
			
		}
	});
});
