/* eslint-disable */
import { Theme } from '../theme.js'
import { utils } from '../utils/utils.js'
const proxy_ctx = utils.proxy_ctx;
import { handleDrag } from '../utils/util_handle_drag.js'

/* This is the top bar where it shows a horizontal scrolls as well as a custom view port */

function Rect() {

}

Rect.prototype.set = function(x, y, w, h, color, outline) {
	this.x = x;
	this.y = y;
	this.w = w;
	this.h = h;
	this.color = color;
	this.outline = outline;
};

Rect.prototype.paint = function(ctx) {
	ctx.fillStyle = this.color || Theme.b;
	ctx.strokeStyle = this.outline || 'transparent';

	this.shape(ctx);

	ctx.fill();
	if (this.outline) ctx.stroke();
};

Rect.prototype.shape = function(ctx) {
	ctx.beginPath();
	ctx.rect(this.x, this.y, this.w, this.h);
};

Rect.prototype.contains = function(x, y) {
	return x >= this.x && y >= this.y && x <= this.x + this.w && y <= this.y + this.h;
};



function ScrollCanvas(dispatcher, data) {
	var width, height;

	this.setSize = function(w, h) {
		width = w;
		height = h;
	}

	var TOP_SCROLL_TRACK = 20;
	var MARGINS = 15;

	var scroller = {
		left: 0,
		grip_length: 0,
		k: 1
	};

	function getScrollBounds() {
		var totalTime = Math.max(0, Number(data.get('ui:totalTime').value) || 0);
		var scrollTime = Math.max(0, Number(data.get('ui:scrollTime').value) || 0);
		var currentTime = Math.max(0, Number(data.get('ui:currentTime').value) || 0);
		var pixels_per_second = Math.max(1, Number(data.get('ui:timeScale').value) || 1);
		var w = Math.max(1, (width || 1) - 2 * MARGINS);
		var visibleTime = Math.max(1, w / pixels_per_second);
		var effectiveTotalTime = Math.max(totalTime, currentTime + visibleTime, scrollTime + visibleTime);
		return {
			totalTime,
			effectiveTotalTime,
			scrollTime,
			currentTime,
			pixels_per_second,
			w,
			visibleTime
		};
	}

	var scrollRect = new Rect();

	this.paint = function(ctx) {
		var bounds = getScrollBounds();
		var totalTime = bounds.totalTime;
		var effectiveTotalTime = bounds.effectiveTotalTime;
		var scrollTime = bounds.scrollTime;
		var currentTime = bounds.currentTime;
		var pixels_per_second = bounds.pixels_per_second;

		ctx.save();
		var dpr = window.devicePixelRatio;
		ctx.scale(dpr, dpr);

		var w = bounds.w;
		var h = 14; // TOP_SCROLL_TRACK;

		ctx.clearRect(0, 0, width, height);
		ctx.translate(MARGINS, 4);

		// Background track
		ctx.fillStyle = 'rgba(91, 116, 152, 0.22)';
		ctx.fillRect(0, 0, w, h);

		var totalTimePixels = effectiveTotalTime * pixels_per_second;
		var k = w / totalTimePixels;
		scroller.k = Math.min(1, k);

		var grip_length = Math.max(16, w * scroller.k);
		grip_length = Math.min(w, grip_length);

		scroller.grip_length = grip_length;

		scroller.left = scrollTime / effectiveTotalTime * w;
		scroller.left = Math.max(0, Math.min(scroller.left, Math.max(0, w - grip_length)));

		scrollRect.set(
			scroller.left,
			0,
			scroller.grip_length,
			h,
			'rgba(168, 195, 230, 0.34)',
			null
		);
		scrollRect.paint(ctx);

		var r = currentTime / effectiveTotalTime * w;

		ctx.fillStyle =  Theme.c;
		ctx.lineWidth = 2;

		ctx.beginPath();

		// circle
		// ctx.arc(r, h2 / 2, h2 / 1.5, 0, Math.PI * 2);

		// line
		ctx.rect(r, 0, 2, h + 4);
		ctx.fill()

		ctx.fillText(currentTime && currentTime.toFixed(2), r, h + 11);
		// ctx.fillText(currentTime && currentTime.toFixed(3), 10, 10);
		ctx.fillText(
			effectiveTotalTime.toFixed(2),
			Math.max(w - 52, 0),
			11
		);

		ctx.restore();
	}

	/** Handles dragging for scroll bar **/

	var draggingx = null;

	this.onDown = function(e) {
		// console.log('ondown', e);

		if (scrollRect.contains(e.offsetx - MARGINS, e.offsety -5)) {
			draggingx = scroller.left;
			return;
		}

		var bounds = getScrollBounds();
		var totalTime = bounds.effectiveTotalTime;
		var w = bounds.w;

		var t = (e.offsetx - MARGINS) / w * totalTime;
		// t = Math.max(0, t);

		// data.get('ui:currentTime').value = t;
		dispatcher.fire('time.update', t);

		if (e.preventDefault) e.preventDefault();

	};

	this.onMove = function move(e) {
		if (draggingx != null) {
			var bounds = getScrollBounds();
			var totalTime = bounds.effectiveTotalTime;
			var w = bounds.w;
			var nextLeft = Math.max(0, draggingx + e.dx);
			var scrollTime = nextLeft / w * totalTime;

			dispatcher.fire('update.scrollTime', scrollTime);

		} else {
			this.onDown(e);
		}

	};

	this.onUp = function(e) {
		draggingx = null;
	}

	/*** End handling for scrollbar ***/
}

export { ScrollCanvas }
