import Orbit from 'orbit/main';
import { assert } from 'orbit/lib/assert';
import { debounce } from 'orbit/lib/functions';
import { extend } from 'orbit/lib/objects';
import MemorySource from './memory-source';

var supportsLocalStorage = function() {
  try {
    return 'localStorage' in window && window['localStorage'] !== null;
  } catch(e) {
    return false;
  }
};

/**
 Source for storing data with local forage (https://github.com/mozilla/localForage)

 @class LocalForageSource
 @extends MemorySource
 @namespace OC
 @param {OC.Schema} schema
 @param {Object}    [options]
 @constructor
 */
var LocalForageSource = MemorySource.extend({
  init: function(schema, options) {
    assert('Your browser does not support local storage!', supportsLocalStorage()); //needed as final fallback
    assert('No valid local forage object given', options['localforage'] !== undefined);
    assert('Local forage requires Orbit.Promise be defined', Orbit.Promise);

    var _this = this;

    MemorySource.prototype.init.apply(this, arguments);

    options = options || {};
    this.saveDataCallback = options['saveDataCallback'];
    this.loadDataCallback = options['loadDataCallback'];
    this.namespace = options['namespace'] || 'orbit'; // local storage key
    this._autosave = options['autosave'] !== undefined ? options['autosave'] : true;
    var autoload = options['autoload'] !== undefined ? options['autoload'] : true;
    this.localforage = options['localforage'];

    this._isDirty = false;

    this.on('didTransform', debounce(function() {
      var promise = _this._saveData();
      if (promise) {
        promise.then(function() {
          if (options.saveDataCallback) setTimeout(_this.saveDataCallback, 0);
        });
      }
    }, 200), this);

    if (autoload) this.load().then(function() {
      if (options.loadDataCallback) setTimeout(options.callback, 0);
    });
  },

  load: function() {
    var _this = this;
    return new Orbit.Promise(function(resolve, reject) {
      _this.localforage.getItem(_this.namespace).then(function(storage){
        if (storage) {
          _this.reset(storage);
        }
        resolve();
      });
    });
  },

  enableAutosave: function() {
    if (!this._autosave) {
      this._autosave = true;
      if (this._isDirty) this._saveData();
    }
  },

  disableAutosave: function() {
    if (this._autosave) {
      this._autosave = false;
    }
  },

  /////////////////////////////////////////////////////////////////////////////
  // Internals
  /////////////////////////////////////////////////////////////////////////////

  _saveData: function(forceSave) {
    var _this = this; //bind not supported in older browsers
    if (!this._autosave && !forceSave) {
      this._isDirty = true;
      return;
    }
    return this.localforage.setItem(this.namespace, this.retrieve()).then(
      function() {
        _this._isDirty = false;
      }
    );

  }
});

export default LocalForageSource;
