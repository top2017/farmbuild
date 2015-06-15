/**
 * @since 0.0.1
 * @copyright 2015 Spatial Vision, Inc. http://spatialvision.com.au
 * @license The MIT License
 * @author Spatial Vision
 * @version 0.1.0
 */

'use strict';

angular.module('farmbuild.webmapping')
	.factory('webMappingDrawInteraction',
	function (validations,
	          $log, $rootScope) {
		var _isDefined = validations.isDefined;

		function _create(map) {
			var drawInteraction = new ol.interaction.Draw({
				source: new ol.source.Vector(),
				type: /** @type {ol.geom.GeometryType} */ ('Polygon')
			}), drawingStatus = false;

			function _init() {
				$log.info('draw interaction init ...');
				map.addInteraction(drawInteraction);
				drawInteraction.setActive(false);
				drawInteraction.on('drawend', function (e) {
					drawingStatus = false;
					$rootScope.$broadcast('web-mapping-draw-end', e.feature);
				});
				drawInteraction.on('drawstart', function (event) {
					$log.info('draw start ...');
					drawingStatus = true;
				});
			}

			function _enable() {
				drawInteraction.setActive(true);
			}

			function _disable() {
				drawInteraction.setActive(false);
			}

			function _finish(){
				drawInteraction.finishDrawing();
			}

			function _isDrawing() {
				return drawingStatus;
			}

			function _discard() {
				drawingStatus = false;
				_disable();
				_enable();
			}

			return {
				init: _init,
				enable: _enable,
				disable: _disable,
				interaction: drawInteraction,
				isDrawing: _isDrawing,
				finish: _finish,
				discard: _discard
			}
		};

		return {
			create: _create
		}

	});
