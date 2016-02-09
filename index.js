var Service, Characteristic;
var request = require("request");
var extend = require('util')._extend;

module.exports = function(homebridge){
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory("homebridge-http-ext", "HttpExt", HttpExtAccessory);
}


function HttpExtAccessory(log, config) {
  this.log = log;
  this.config = config;

  this.eventProcessors = {
    get: this.getEventProcessor,
    set: this.setEventProcessor
  };
}

function stringToBoolean(string){
    switch(string.toLowerCase().trim()){
        case "true": case "yes": case "1": return true;
        case "false": case "no": case "0": case null: return false;
        default: return Boolean(string);
    }
}

HttpExtAccessory.prototype = {

  httpRequest: function(options, callback) {
    var defaults = {
      method: "GET",
    }
    request(extend(defaults, options), function(error, response, body) {
      callback(error, response, body)
    })
  },

  identify: function(callback) {
    this.log("Identify requested!");
    callback(); // success
  },

  getEventProcessor: function(options) {
    return function(callback, context) {
      if (!options.url) {
        	    this.log.warn("Ignoring request; No url defined.");
    	    callback(new Error("No url defined."));
    	    return;
    	}
  		this.log("Getting value");

  		this.httpRequest(options, function(error, response, responseBody) {
  		  if (error) {
    			this.log('HTTP get function failed: %s', error.message);
    			callback(error);
  		  } else {
    			var value = responseBody;

          var value_type = options.value_type;
          if (value_type === "integer")
            value = parseInt(value);
          else if (value_type === "float")
            value = parseFloat(value);
          else if (value_type === "boolean")
            value = stringToBoolean(value);

          this.log("get value is currently %s", value);

    			callback(null, value);
  		  }
  		}.bind(this));
    };
  },

  setEventProcessor: function(options) {
    return function(newValue, callback, context) {
      var opts = extend({body: ""}, options);

      var value = newValue;
      // var value_type = options.value_type;
      // if (value_type === "integer")
      //   value = parseInt(value);
      // else if (value_type === "float")
      //   value = parseFloat(value);
      // else if (value_type === "boolean")
      //   value = stringToBoolean(String(value));

      opts.url = (typeof opts.url === "object") ? opts.url[value] : opts.url.replace("%NEW%", value);
      opts.body = (typeof opts.body === "object") ? opts.body[value] : opts.body.replace("%NEW%", value);

      if (!opts.url) {
              this.log.warn("Ignoring request; No url defined.");
          callback(new Error("No url defined."));
          return;
      }

      this.log("Setting new value to %s", value);

      this.httpRequest(opts, (function(error, response, body) {
        if (error) {
          this.log('HTTP set function failed: %s', error);
          callback(error);
        } else {
          this.log('HTTP set function succeeded!');
          callback();
        }
      }).bind(this));
    };
  },

  eventProcessor: function(event, options) {

  },

  getServices: function() {
    var config = extend({}, this.config);
    var services = (config.services || [])
    .filter((srv) => !srv.disabled)
    .map((srv) => {
      if (!srv.service) {
        this.log.warn("HTTP get services failed: no service type specified");
        callback(new Error("No service type specified"));
        return;
      }

      var service = new Service[srv.service](typeof srv.name === "undefined" ? config.name : srv.name, srv.subtype);
      var chars = srv.characteristics || {};
      for (var key in chars) {
        if (chars.hasOwnProperty(key)) {
          var char = chars[key];
          if (typeof char == "undefined") {
            // nothing
          }
          else if (typeof char == "object") {
            var serviceChar = service.getCharacteristic(Characteristic[key]);
            if (serviceChar) {
              for (var event in char) {
                if (char.hasOwnProperty(event)) {
                  if (this.eventProcessors[event]) {
                    var options = extend({value_type: srv.value_type}, config.httpOptions);
                    var proc = this.eventProcessors[event](extend(options, char[event]));
                    if (proc) {
                      serviceChar.on(event, proc.bind(this));
                    }
                  }
                }
              }
            }
          }
          else {
            service.setCharacteristic(Characteristic[key], char);
          }
        }
      }
      return service;
    });

    return services;
  }
};