/**
 * @since 0.0.1
 * @copyright 2015 Spatial Vision, Inc. http://spatialvision.com.au
 * @license The MIT License
 * @author Spatial Vision
 * @version 0.1.0
 */

'use strict';

angular.module('farmbuild.webmapping')
  .factory('webMappingSession',
  function ($log, farmdata, validations) {

    var webMappingSession = {},
      _isDefined = validations.isDefined;

    function load() {
      var root = farmdata.session.find();

      if(!_isDefined(root)) {
        return undefined;
      }

      return root.webMapping;
    }


    webMappingSession.saveSection = function(section, value) {
      var loaded = load();

      if(!_isDefined(loaded)) {
        $log.error('Unable to find an existing farmData! please create then save.');
        return webMappingSession
      }

      loaded[section] = value;

      return save(loaded);
    }

    function save(toSave) {
      var farmData = farmdata.session.find();

      if(!_isDefined(farmData)) {
        $log.error('Unable to find the farmData in the session!');
        return undefined;
      }

      farmData.dateLastUpdated = new Date();

      farmData.webMapping = toSave;
      farmdata.session.save(farmData);

      return toSave;
    }
    webMappingSession.save = save;

    webMappingSession.loadSection = function(section) {
      var loaded = load();
      return loaded?loaded[section]:null;
    }

    webMappingSession.isLoadFlagSet = function(location) {
      var load = false;

      if(location.href.split('?').length > 1 &&
        location.href.split('?')[1].indexOf('load') === 0){
        load = (location.href.split('?')[1].split('=')[1] === 'true');
      }

      return load;
    }

    webMappingSession.find = function() {
      return farmdata.session.find();
    }

    return webMappingSession;

  });