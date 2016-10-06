function FuseInit() {
	
	var op   = arguments[0] || {};
	var self = this;
	var pri  = {};
	
	pri.config                       = {};
	pri.config.extendNativeObjects   = (typeof op.extendNativeObjects === 'boolean' ? op.extendNativeObjects : true);
	pri.watchCycleMaxCPUTime         = 0.05 //Percentage of processing time available to use for watch cycle. Auto-adjusts based on time it took to complete the watch cycle
	pri.objectTrackers               = []
	pri.objectFuseIDTracker          = 0
	pri.date                         = (new Date)
	
	/**
	 * Gets us a tracker for the supplied object, initializes tracker if one doesn't exist yet
	 * Used to prevent dupes in watch list from multiple binds/watches
	 * @param {object}  obj        -- object to track
	 * @param {boolean} justCheck  -- just return whether it is being tracked or not, don't perform init
	 */
	pri.getObjectTracker = function(obj) {
		
		if(typeof obj !== 'object') throw new Error('getObjectTracker() only works on objects.');
		
		if(typeof obj.__fuseID === 'undefined') {
			
			//Check to see if we have a vacant slot we can use
			var fID;
			pri.objectTrackers.forEach(function(v,i) { if(v === undefined) fID = i; });
			
			//If we don't find an empty slot to use, increment
			if(typeof fID === 'undefined') fID = pri.objectFuseIDTracker++
			
			//Burn a tracking ID onto the object, so we can re-identify it if we're passed it again. 
			//We could track without burning an id in, but it'll make re-identifying slower (scanning and comparing).
			//I think the trade-off of adding an attribute to the object is reasonable, if we make it non-enumerable
			Object.defineProperty(obj, '__fuseID', { value: fID, enumerable: false, writable: false });
		}
		
		return pri.objectTrackers[obj.__fuseID] || (pri.objectTrackers[obj.__fuseID] = new pri.C_ObjectTracker(obj));

	}

	/**
	 * If there are no watchers
	 * Used to prevent dupes in watch list from multiple binds/watches
	 * @param {object}  obj      -- object to track
	 */
	pri.objectTrackerCleanUp = function(obj) {

		if(typeof obj !== 'object') throw new Error('objectTrackerCleanUp only works on objects.');

		if(typeof obj.__fuseID !== 'undefined') {

			var oT = pri.getObjectTracker(obj);

			var activeWatchers      = Object.keys(oT.watchedProps).length !== 0;
			var activeEventBindings = oT.events.length !== 0;
			
			//If we have no more watchers, stop the watch cycle
			if(!activeWatchers) {
				clearTimeout(pri.watchCycleTimer);
			}
			
			//No watchers and no event bindings left
			if(!activeWatchers && !activeEventBindings) {
				pri.objectTrackers[obj.__fuseID] = undefined;
				delete obj.__fuseID;
			}
		}
	}
	
	/**
	 * Constructor to initialize a new object tracker
	 * @param {object} obj
	 */
	pri.C_ObjectTracker = function(obj) {
		this.object = obj;
		this.watchedProps = {};
		this.events = {};
	}
	
	/**
	 * Constructor to initialize a new property watcher
	 * @param {string} property -- property to watch
	 */
	pri.C_WatchedProp = function(property) {
		this.lastValue  = undefined;
		this.callbacks  = []
	};
	
	/**
	 * Compare two items for equivalency
	 * @param {*} item 1
	 * @param {*} item 2
	 * @return {boolean} -- whether the two items have the same type and value
	 */
	pri.valuesAreEqual = function() {
		
		//Type of objects being compared
		var tOO1 = typeof arguments[0];
		var tOO2 = typeof arguments[1];
		
		//If our types don't match, the content certainly doesn't
		if(tOO1 !== tOO2) return false;
		
		switch(tOO1) {
			case 'string':
			case 'number':
				return arguments[0] === arguments[1];
			break;
			case 'object': 
				//TODO: replace 'object' with a deep object scan so that if an object is being watched and a child node changes, we know about it.
			default:
				return String(arguments[0]) === String(arguments[1]);
			break;
		}
		
	}
	
	/**
	 * Add a watcher to an object's property
	 * Doesn't (yet) support deep scanning of objects
	 * @param {object}  obj      -- object hosting the property to watch
	 * @param {string}  property -- string of property to watch
	 * @param {string}  callback -- function to trigger when changes are detected
	 */
	self.watch = function() {
		
		var dC       = this instanceof FuseInit,
            obj      = dC ? arguments[0] : this, 
            property = arguments[dC ? 1 : 0], 
            callback = arguments[dC ? 2 : 1];

		if(typeof obj      === 'undefined') obj = this; //If we're being called via Object.prototype
		if(typeof obj      !== 'object')                   throw new Error('watch only works on objects.');
		if(typeof property !== 'string')                   throw new Error('watch requires the property to watch as param2');
		if(!callback || !callback.call || !callback.apply) throw new Error('watch requires a callback function as param3');
		
		var oT = pri.getObjectTracker(obj);
		
		//If this is our first watcher, start up the watch cycle.
		if(Object.keys(oT.watchedProps).length === 0) {
			pri.watchCycle();
		}		
		
		var oW = oT.watchedProps[property] || (oT.watchedProps[property] = new pri.C_WatchedProp(obj[property]));
		
		oW.callbacks.push(callback);
		
		return callback;
	}
	
	/**
	 * Add a watcher to an object's property
	 * Doesn't (yet) support deep scanning of objects
	 * @param {object}  obj      -- object hosting the property to watch
	 * @param {string}  property -- string of property to watch
	 * @param {string}  callback -- function to trigger when changes are detected
	 */
	self.unWatch = function() {
				
		var dC       = this instanceof FuseInit,
            obj      = dC ? arguments[0] : this, 
            property = arguments[dC ? 1 : 0], 
            callback = arguments[dC ? 2 : 1];
			
			
		if(typeof obj === 'undefined') obj = this; //If we're being called via Object.prototype
		if(typeof obj !== 'object') throw new Error('watch only works on objects.');
		
		var oT = pri.getObjectTracker(obj);
		
		//Remove specific watcher
		if(!!callback) {
			Object.keys(oT.watchedProps).forEach(function(k) {
				oT.watchedProps[k].callbacks.forEach(function(cb, i2) {
					if(cb === callback) {
						//We found a match, let's remove it.
						oT.watchedProps[k].callbacks.splice(i2,1);
					};
				})
			})
		
		//Remove all watchers for a property
		} else if(!!property) {
			
			delete oT.watchedProps[property];
			
		//Remove all watchers for the object
		} else {
			Object.keys(oT.watchedProps).forEach(function(k, i) {
				delete oT.watchedProps[i];
			})
		}
		
		pri.objectTrackerCleanUp (obj);
		
	}

	//Trigger the watch cycle
	pri.watchCycle = function watchCycle() {
		
		pri.watchCycleStartTime = pri.date.getTime();

		pri
		.objectTrackers
		.filter(function(oT) {
			//Maybe use a dedicated watchers tracker so we can skip this filter
			return Object.keys(oT.watchedProps).length !== 0;
		})
		.forEach(function(oT) {
		
			Object
				.keys(oT.watchedProps)
				.forEach(function(prop) {
					var oW = oT.watchedProps[prop];
					
					if(!pri.valuesAreEqual(oW.lastValue, oT.object[prop])) {
						oW.lastValue = oT.object[prop];
						
						//Our value has changed, let's let everyone know.
						oW
						.callbacks
						.forEach(function(callback) {
							callback(oW.lastValue);
						});		
					}
			})

		})
			
		//We're done our watch cycle, wait for the delay, and re-trigger.
		pri.watchCycleTimer = setTimeout(pri.watchCycle, pri.watchCycleFrequency);
		
		/*
			Auto-tunes the watch cycle frequency based on the duration of the cycle, so that it's always a factor of watchCycleMaxCPUTime. 
			Few watchers, fast devices  = 0 delay
			Many watchers, slow devices = higher delay
		*/
		pri.watchCycleEndTime   = pri.date.getTime();
		pri.watchCycleDuration  = pri.watchCycleEndTime - pri.watchCycleStartTime;
		pri.watchCycleFrequency = Math.floor(pri.watchCycleDuration / pri.watchCycleMaxCPUTime);
		
	};
	
	/**
	 * Add a piggyback listener to any object's method
	 * @param  {object}  obj        -- object 
	 * @param  {string}  eName      -- name of method to attach onto
	 * @param  {string}  callback   -- string of classname to append
	 * @return {object}             -- the supplied callback
	 */
	self.attach = function() {
				
		var dC        = this instanceof FuseInit,
            obj       = dC ? arguments[0] : this, 
            eventName = arguments[dC ? 1 : 0], 
            callback  = arguments[dC ? 2 : 1];
			
		if(typeof obj       === "undefined") obj = this; //If we're being called via Object.prototype
		if(typeof obj       !== "object")                             throw new Error("attach() only works on objects.");
		if(typeof eventName !== "string")                             throw new Error("attach() requires the method name to attach to as param2");
		if(!callback || !callback.call || !callback.apply)            throw new Error("attach() requires a callback function as param3");
		
		var objDesc = Object.getOwnPropertyDescriptor(obj, eventName);
		if(!objDesc.writable) throw new Error("attach() supplied method to listen on must be writable. Is your object frozen?");
		
		var oT = pri.getObjectTracker(obj, true);
		var eB = oT.events;
		
		/*
			If it's the first time we attach to this object, we replace the method to watch with a 
			wrapper which executes the original function, along with any attached listeners
		*/
		if(typeof eB[eventName] === 'undefined') {
			eB[eventName] = [obj[eventName]]; //first element is our original function
			
			//Overwrite the original function with a wrapper 
			obj[eventName] = function() {
				
				//Keep a reference to the original arguments
				var args = arguments;
				
				//Execute everything in our event stack, passing in the original arguments
				eB[eventName].forEach(function(f) {
					f(args);
				})
			}
		}

		//Add our callback to the stack
		eB[eventName].push(callback);
		return callback;

	}
	
	/**
	 * Detach listeners of an Object's method
	 * @param {string} eName -- name of method to unbind from
	 */
	self.detach = function() {
		
		var dC        = this instanceof FuseInit,
            obj       = dC ? arguments[0] : this, 
            eventName = arguments[dC ? 1 : 0], 
            callback  = arguments[dC ? 2 : 1];
			
		if(typeof obj === "undefined") obj = this; //If we're being called via Object.prototype
		if(typeof eventName !== "string")  throw new Error("detach() requires param2 be the name of the method to detach the listeners from");
		
		var oT = pri.getObjectTracker(obj);
		var eB = oT.events;
		
		//If we're supplied a callback, check if it matches any of the ones we have defined on this method. If so, remove it.
		if(!!callback && !!callback.call && !!callback.apply) {
			for(var i = 1; i < eB[eventName].length; i++) {
				if(eB[eventName][i] === callback) {
					eB[eventName].splice(i,1);
				}
			}
			
		//If we're not supplied a callback, remove everything but the original function
		} else {
			eB[eventName].length = 1;
		}
		
		//If all we have is the original function, put it back
		if(eB[eventName].length === 1) {
			//Put the original function back
			obj[eventName] = eB[eventName][0];
			
			//Remove binding stack for this event
			delete eB[eventName];
			
			pri.objectTrackerCleanUp(obj);
		}

	}
	
	//Extend all objects. A bit intrusive, but convenient.
	if(pri.config.extendNativeObjects && typeof Object.prototype.fuseWatch === 'undefined') {
		
		Object.prototype.fuseWatch    = self.watch;
		Object.prototype.fuseUnWatch  = self.unWatch;
		Object.prototype.fuseAttach   = self.attach;
		Object.prototype.fuseDetach   = self.detach;
	
	}
	
	return self;
	
}