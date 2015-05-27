'use strict';

angular.module('farmbuild.webmapping')
	.factory('webMappingInteractions',
	function (validations,
	          $log,
	          webMappingSelectInteraction, webMappingModifyInteraction, webMappingDrawInteraction, webMappingSnapInteraction, webMappingTransformations) {
		var _isDefined = validations.isDefined,
			_select, _modify, _draw, _snap, _activeLayer, _activeLayerName,
			_mode,
			transform = webMappingTransformations;

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

		function _init(map, farmLayer, paddocksLayer, activeLayerName, multi) {

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

			_select = webMappingSelectInteraction.create(map, _activeLayer, multi);
			_modify = webMappingModifyInteraction.create(map, _select);
			_draw = webMappingDrawInteraction.create(map, farmLayer.getSource(), paddocksLayer.getSource());
			_snap = webMappingSnapInteraction.create(map, farmLayer.getSource(), paddocksLayer.getSource());
			_mode = '';
			_activeLayerName = activeLayerName;

			_select.init();
			_modify.init();
			_draw.init(_clip, _select);
			_snap.init();

		};

		function _addGeoJsonFeature(layer, feature, name) {
			if (!_isDefined(feature)) {
				return;
			}
			$log.info('adding feature ...', feature);
			layer.getSource().addFeature(new ol.Feature({
				geometry: new ol.geom[feature.geometry.type](feature.geometry.coordinates),
				name: name
			}));
			_clearSelections();
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
				_clearSelections()
			}
		};

		function _clip(featureToClip, paddockSource, farmSource) {
			$log.info('clipping feature ...', featureToClip);

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
				farmFeatures = farmSource.getFeatures(),
				name = featureToClip.getProperties().name;
			clipped = transform.erase(featureToClip, paddocksFeatures);
			clipped = transform.intersect(new ol.Feature({
				geometry: new ol.geom[clipped.geometry.type](clipped.geometry.coordinates)
			}), farmFeatures);
			_addGeoJsonFeature(_activeLayer, clipped, name);
		};

		function _clipDonut(donutFeature) {
			var clipped,
				paddockFeature = _activeLayer.getSource().getFeaturesAtCoordinate(donutFeature.geometry.coordinates[0][1])[0],
				name = donutFeature.getProperties().name;
			clipped = turf.erase(paddockFeature, donutFeature);
			_addGeoJsonFeature(_activeLayer, clipped, name);
			_activeLayer.getSource().removeFeature(paddockFeature);
		};

		function _clipFarm(featureToClip, farmSource) {
			var farmFeatures = farmSource.getFeatures(),
				clipped = transform.erase(featureToClip, farmFeatures),
				name = featureToClip.getProperties().name;
			_addGeoJsonFeature(_activeLayer, clipped);
			_remove(farmFeatures, false);
			clipped = transform.merge(farmSource.getFeatures());
			_addGeoJsonFeature(_activeLayer, clipped, name);
			_clearSelections();
		};

		function _merge(features) {
			$log.info('merging features ...', features);
			_remove(features, false);
			_addGeoJsonFeature(_activeLayer, transform.merge(features));
			_clearSelections();
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

		function _clearSelections() {
			_select.interaction.getFeatures().clear();
		};

		function _isDrawing() {
			if (!-_isDefined(_mode)) {
				return;
			}
			return _draw.isDrawing();
		};

		function _finishDrawing() {
			if (!-_isDefined(_mode)) {
				return;
			}
			_draw.finish();
		};

		function _discardDrawing() {
			if (!-_isDefined(_mode)) {
				return;
			}
			_draw.disable();
			_draw.enable();
		};

		function _isEditing() {
			if (!-_isDefined(_mode)) {
				return;
			}
			return _select.interaction.getFeatures().getLength() > 0;
		};

		return {
			init: _init,
			destroy: _destroy,
			enableDrawing: _enableDrawing,
			enableEditing: _enableEditing,
			enableDonutDrawing: _enableDonutDrawing,
			clip: _clip,
			merge: _merge,
			remove: _remove,
			selectedFeatures: _selectedFeatures,
			isDrawing: _isDrawing,
			isEditing: _isEditing,
			finishDrawing: _finishDrawing,
			discardDrawing: _discardDrawing
		}
	});