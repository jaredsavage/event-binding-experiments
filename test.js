
//Initialize new instance of Fuse
var Fuse = new FuseInit({extendNativeObjects: true});

/* Tests */

function Example() {
	
	this.getThing = function() {
		console.log("getThing was called", arguments);
	}
	this.getThing2 = function() {
		console.log("getThing2 was called", arguments);
	}
	
	this.test1 = 1234;
	this.test2 = 1234;
	
}

var ex = new Example();

	ex.getThing();
	ex.getThing2();
	
	/*
		Test watch and event binding functions
	*/
	Fuse.watch(ex, 'test1', function(val) {
		console.log('ex.test1 has changed to '+ val + ', and watcher 1 has triggered;');
	})
	
	Fuse.watch(ex, 'test1', function(val) {
		console.log('ex.test1 has changed to '+ val + ', and watcher 2 has triggered;');
	})
	
	//Watch a property which hasn't yet been defined.
	Fuse.watch(ex, 'test5', function(val) {
		console.log('ex.test5 has changed to '+ val + ', and watcher 3 has triggered;');
	})	
	
	Fuse.attach(ex, "getThing", function() {
		console.log("getThing event fired, and binding 1 was called!", arguments);
	});
			
	Fuse.attach(ex, "getThing2", function() {
		console.log("getThing2 event fired, and binding 2 was called!", arguments);
	});
	
	
	/*
		Test native object extensions
	*/
	ex.fuseWatch("test2", function(val) {
		console.log('ex.test2 has changed to '+ val + ', and watcher 4 has triggered;');
	});

	ex.fuseAttach("getThing", function() {
		console.log("getThing event fired, and binding 3 was called!", arguments);
	});

	ex.fuseAttach("getThing", function() {
		console.log("getThing event fired, and binding 4 was called!", arguments);
	});

	ex.fuseAttach("getThing", function() {
		console.log("getThing event fired, and binding 5 was called!", arguments);
	});
	
	ex.fuseAttach("getThing2", function() {
		console.log("getThing event fired, and binding 6 was called!", arguments);
	});
	
	var attachEventCallback = function attachEventCallback() {
		console.log("getThing event fired, and binding 7 was called!", arguments);
	}
	ex.fuseAttach("getThing", attachEventCallback);
	ex.getThing();
	ex.fuseDetach("getThing", attachEventCallback);
	ex.getThing();
	/*
		Test Unwatching a specific watcher
	*/
	
	var watchCallback = function watchCallback() {
		console.log('ex.test2 has changed to '+ val + ', and watcher 5 has triggered;');
	}
	ex.fuseWatch("test2", watchCallback);
	ex.fuseUnWatch("test2", watchCallback);

	ex.getThing(1234);
	ex.getThing2(1234);
	
	ex.fuseDetach("getThing"); //Remove all bindings for getThing
	
	ex.getThing();
	ex.getThing2();

	ex.fuseDetach("getThing2"); //Remove all bindings for getThing
	
	//Have an interval that changes the values, to test the watchers
	setInterval(function() {
		console.log('Changing value of ex.test1, and ex.test2');
		ex.test1++;
		ex.test2--;
	
	}, 3000);
