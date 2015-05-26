'use strict';

angular.module('farmbuild.webmapping')
	.factory('interactions',
	function (validations,
	          $log) {
		var _isDefined = validations.isDefined,
			_geoJSONFormat = new ol.format['GeoJSON'](),
			_select, _modify, _draw, _snap, _activeLayer, _activeLayerName,
			_mode;

		function _createSelect(map, layer) {
			var selectInteraction = new ol.interaction.Select({
				addCondition: ol.events.condition.shiftKeyOnly,
				layers: [layer]
			});

			function _init() {
				$log.info('select interaction init ...');
				map.addInteraction(selectInteraction);
				selectInteraction.setActive(false);
			}

			function _enable() {
				selectInteraction.setActive(true);
			}

			function _disable() {
				selectInteraction.setActive(false);
			}

			return {
				init: _init,
				enable: _enable,
				disable: _disable,
				interaction: selectInteraction
			}
		};

		function _createModify(map, select) {
			var modifyInteraction = new ol.interaction.Modify({
				features: select.interaction.getFeatures()
			});

			function _init() {
				$log.info('modify interaction init ...');
				map.addInteraction(modifyInteraction);
				modifyInteraction.setActive(false);
			}

			function _enable() {
				modifyInteraction.setActive(true);
			}

			function _disable() {
				modifyInteraction.setActive(false);
			}

			return {
				init: _init,
				enable: _enable,
				disable: _disable,
				interaction: modifyInteraction
			}
		};

		function _createDraw(map, farmSource, paddocksSource) {
			var drawInteraction = new ol.interaction.Draw({
				source: paddocksSource,
				type: /** @type {ol.geom.GeometryType} */ ('Polygon')
			}), drawingStatus = false;

			function _init() {
				$log.info('draw interaction init ...');
				map.addInteraction(drawInteraction);
				drawInteraction.setActive(false);
				drawInteraction.on('drawend', function (e) {
					$log.info('draw end ...');
					var feature = e.feature;
					_clip(feature, paddocksSource, farmSource);
					setTimeout(function () {
						paddocksSource.removeFeature(feature);
					}, 100);
					drawingStatus = false;
				});
				drawInteraction.on('drawstart', function (event) {
					$log.info('draw start ...');
					_select.interaction.getFeatures().clear();
					drawingStatus = true;
				});
			}

			function _enable() {
				drawInteraction.setActive(true);
			}

			function _disable() {
				drawInteraction.setActive(false);
			}

			function _isDrawing() {
				return drawingStatus;
			}

			return {
				init: _init,
				enable: _enable,
				disable: _disable,
				interaction: drawInteraction,
				isDrawing: _isDrawing
			}
		};

		function _createSnap(map, farmSource, paddocksSource) {

			var snapInteraction = new ol.interaction.Snap({
				source: paddocksSource
			});

			snapInteraction.addFeature(farmSource.getFeatures()[0]);

			function _enable() {
				snapInteraction.setActive(true);
			}

			function _disable() {
				snapInteraction.setActive(false);
			}

			function _init() {
				$log.info('snap interaction init ...');
				map.addInteraction(snapInteraction);
				snapInteraction.setActive(false);
			}

			return {
				init: _init,
				enable: _enable,
				disable: _disable,
				interaction: snapInteraction
			}
		};

		// Remove all interactions of map
		function _destroy(map) {
			$log.info('destroying all interactions ...');
			map.getInteractions().clear();
			map.addInteraction(new ol.interaction.DragPan({kinetic: null}));
			_select = undefined;
			_modify = undefined;
			_draw = undefined;
			_snap = undefined;
			_activeLayer = undefined;
			_activeLayerName = undefined;
			_mode = undefined;
		};

		function _init(map, farmLayer, paddocksLayer, activeLayerName) {

			$log.info('interactions init ...');
			if (!_isDefined(activeLayerName) || !_isDefined(map) || !_isDefined(paddocksLayer) || !_isDefined(farmLayer)) {
				return;
			}

			if (activeLayerName === 'paddocks') {
				_activeLayer = paddocksLayer;

			} else if (activeLayerName === 'farm') {
				_activeLayer = farmLayer;
			} else {
				return;
			}

			_select = _createSelect(map, _activeLayer);
			_modify = _createModify(map, _select);
			_draw = _createDraw(map, farmLayer.getSource(), paddocksLayer.getSource());
			_snap = _createSnap(map, farmLayer.getSource(), paddocksLayer.getSource());
			_mode = '';
			_activeLayerName = activeLayerName;

			_select.init();
			_modify.init();
			_draw.init();
			_snap.init();

		};


		function _featureToGeoJson(feature) {
			return angular.fromJson(_geoJSONFormat.writeFeature(feature));
		};

		function _featuresToGeoJson(features) {
			return angular.fromJson(_geoJSONFormat.writeFeatures(features.getArray()));
		};

		function _addGeoJsonFeature(layer, feature) {
			if (!_isDefined(feature)) {
				return;
			}
			$log.info('adding feature ...', feature);
			layer.getSource().addFeature(new ol.Feature({
				geometry: new ol.geom[feature.geometry.type](feature.geometry.coordinates)
			}));
			_select.interaction.getFeatures().clear();
		};

		function _merge(features) {
			$log.info('merging features ...', features);
			var toMerge;
			_remove(features, false);
			toMerge = _featuresToGeoJson(features);
			try {
				_addGeoJsonFeature(_activeLayer, turf.merge(toMerge));
				_select.interaction.getFeatures().clear();
			} catch (e) {
				$log.error(e);
			}

		};

		function _erase(feature, features) {
			try {
				features.forEach(function (layerFeature) {
					var clipper = _featureToGeoJson(layerFeature);
					feature = turf.erase(feature, clipper);
				});
				return feature;
			} catch (e) {
				$log.error(e);
			}
		};

		function _intersect(feature, features) {
			try {
				features.forEach(function (layerFeature) {
					var clipper = _featureToGeoJson(layerFeature);
					feature = turf.intersect(feature, clipper);
				});
				return feature;
			} catch (e) {
				$log.error(e);
			}
		};

		function _clip(feature, paddockSource, farmSource) {
			$log.info('clipping feature ...', feature);

			var featureToClip = _featureToGeoJson(feature);

			if (_activeLayerName === 'paddocks' && (_mode === 'draw' || _mode === 'edit')) {
				_clipPaddocks(featureToClip, paddockSource, farmSource);
			}

			if (_activeLayerName === 'paddocks' && _mode === 'donut-draw') {
				_clipDonut(featureToClip);
			}

			if (_activeLayerName === 'farm') {
				_clipFarm(featureToClip, farmSource)

			}
		};

		function _clipPaddocks(featureToClip, paddockSource, farmSource) {
			var clipped,
				paddocksFeatures = paddockSource.getFeatures(),
				farmFeatures = farmSource.getFeatures();
			clipped = _erase(featureToClip, paddocksFeatures);
			clipped = _intersect(clipped, farmFeatures);

			_addGeoJsonFeature(_activeLayer, clipped);
		};

		function _clipDonut(donutFeature) {
			var clipped, paddockFeature, paddockGeoJsonFeature;
			paddockFeature = _activeLayer.getSource().getFeaturesAtCoordinate(donutFeature.geometry.coordinates[0][1])[0];
			paddockGeoJsonFeature = _featureToGeoJson(paddockFeature);
			clipped = turf.erase(paddockGeoJsonFeature, donutFeature);
			_addGeoJsonFeature(_activeLayer, clipped);
			_activeLayer.getSource().removeFeature(paddockFeature);
		};

		function _clipFarm(featureToClip, farmSource) {
			var farmFeatures = farmSource.getFeatures(),
				clipped = _erase(featureToClip, farmFeatures);
			_addGeoJsonFeature(_activeLayer, clipped);
			_merge(farmSource.getFeatures());
		};

		function _area(features) {
			$log.info('calculating area of features ...', features);
			var geoJsonFeatures = _featuresToGeoJson(features);
			return turf.area(geoJsonFeatures) * 0.0001;
		};

		function _remove(features, deselect) {
			if (!_isDefined(deselect)) {
				deselect = true;
			}
			$log.info('removing features ...', features);
			if (_isDefined(features)) {
				features.forEach(function (feature) {
					_activeLayer.getSource().removeFeature(feature);
				});
			}
			if (deselect) {
				_select.interaction.getFeatures().clear();
			}
		};

		function _selectedFeatures() {
			if (!_isDefined(_select) || !_isDefined(_select.interaction)) {
				return;
			}
			$log.info('Selected features ...', _select.interaction.getFeatures());
			return _select.interaction.getFeatures();
		};

		function _enableEditing() {
			if (!-_isDefined(_mode) || _mode === 'edit') {
				return;
			}
			$log.info('editing enabled');
			_select.enable();
			_modify.enable();
			_snap.enable();
			_draw.disable();
			_mode = 'edit';
		};

		function _isDrawing() {
			if (!-_isDefined(_mode)) {
				return;
			}
			return _draw.isDrawing();
		};

		function _isEditing() {
			if (!-_isDefined(_mode)) {
				return;
			}
			return _select.interaction.getFeatures().getLength() > 0;
		};

		function _enableDrawing() {
			if (!-_isDefined(_mode) || _mode === 'draw') {
				return;
			}
			$log.info('drawing enabled');
			_select.disable();
			_modify.disable();
			_draw.enable();
			_snap.enable();
			_mode = 'draw';
		};

		function _enableDonutDrawing() {
			if (!-_isDefined(_mode) || _mode === 'donut-draw') {
				return;
			}
			$log.info('donut drawing enabled');
			_select.disable();
			_modify.disable();
			_draw.enable();
			_snap.enable();
			_mode = 'donut-draw';
		};

		return {
			init: _init,
			destroy: _destroy,
			enableDrawing: _enableDrawing,
			enableEditing: _enableEditing,
			enableDonutDrawing: _enableDonutDrawing,
			merge: _merge,
			remove: _remove,
			clip: _clip,
			area: _area,
			selectedFeatures: _selectedFeatures,
			isDrawing: _isDrawing,
			isEditing: _isEditing
		}
	});