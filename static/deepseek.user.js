// ==UserScript==
// @name         Deepseek Method - HQ Upload Enhanced
// @namespace    deepseek-method-enhanced
// @version      1.2.0
// @description  Auto strip TikTok re-encode flags for high quality uploads + file validation
// @author       Deepseek Method
// @match        https://www.tiktok.com/tiktokstudio/upload*
// @match        https://www.tiktok.com/creator/upload*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  if (window.__deepseekEnhancedInstalled) return;
  window.__deepseekEnhancedInstalled = true;

  var active = true;
  window.__deepseekMethodActive = true;

  var MAX_FILE_SIZE_MB = 50;
  var MAX_DURATION_SEC = 60;

  window.deepseekSetActive = function (val) {
    active = !!val;
    window.__deepseekMethodActive = active;
    return { status: active ? 'ACTIVE' : 'STANDBY' };
  };

  function isUploadPage() {
    var href = (window.location.href || '').toLowerCase();
    return href.indexOf('/tiktokstudio/upload') !== -1 || href.indexOf('/creator/upload') !== -1;
  }

  function isUploadPayload(value) {
    return value && typeof value === 'object' && (
      value.single_post_req_list !== undefined ||
      value.vedit_common_info !== undefined ||
      value.post_common_info !== undefined ||
      value.upload_id !== undefined ||
      value.video_id !== undefined ||
      value.publish_type !== undefined ||
      value.post_type !== undefined
    );
  }

  function stripReencodeFlags(node) {
    if (!node || typeof node !== 'object') return;
    ['draft', 'canvas_config', 'vedit_segment_info'].forEach(function (key) {
      if (Object.prototype.hasOwnProperty.call(node, key)) delete node[key];
    });
    if (node.cloud_edit_is_use_video_canvas !== undefined) node.cloud_edit_is_use_video_canvas = false;
    if (node.post_type !== undefined) node.post_type = 3;
    if (node.enter_post_page_from !== undefined) node.enter_post_page_from = 1;
    for (var key in node) {
      if (node[key] && typeof node[key] === 'object') stripReencodeFlags(node[key]);
    }
  }

  function validateVideo(file) {
    if (!file) return null;
    var errors = [];
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      errors.push('File too large (max ' + MAX_FILE_SIZE_MB + ' MB)');
    }
    return errors.length ? errors : null;
  }

  var nativeStringify = JSON.stringify;

  function cleanBody(body) {
    if (!body || typeof body !== 'string') return body;
    try {
      var parsed = JSON.parse(body);
      if (!isUploadPayload(parsed)) return body;
      stripReencodeFlags(parsed);
      return nativeStringify(parsed);
    } catch (_) {
      return body;
    }
  }

  function installHooks() {
    if (!JSON.stringify.__deepseekPatch) {
      var prevStringify = JSON.stringify;
      JSON.stringify = function (value, replacer, space) {
        if (active && isUploadPage() && isUploadPayload(value)) {
          try {
            stripReencodeFlags(value);
          } catch (_) {}
        }
        return prevStringify.call(this, value, replacer, space);
      };
      JSON.stringify.__deepseekPatch = true;
    }

    if (!window.fetch.__deepseekPatch) {
      var prevFetch = window.fetch;
      window.fetch = function (resource, options) {
        if (active && isUploadPage() && options && options.body && typeof options.body === 'string') {
          options = Object.assign({}, options, { body: cleanBody(options.body) });
        }
        return prevFetch.apply(this, [resource, options]);
      };
      window.fetch.__deepseekPatch = true;
    }

    if (!XMLHttpRequest.prototype.send.__deepseekPatch) {
      var prevSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.send = function (body) {
        if (active && isUploadPage() && typeof body === 'string') {
          body = cleanBody(body);
        }
        return prevSend.call(this, body);
      };
      XMLHttpRequest.prototype.send.__deepseekPatch = true;
    }
  }

  function hookFileInput() {
    document.addEventListener('change', function (e) {
      var target = e.target;
      if (target.tagName === 'INPUT' && target.type === 'file' && target.files && target.files.length) {
        var file = target.files[0];
        if (file.type.startsWith('video/') || /\.(mp4|mov|avi|mkv|webm)$/i.test(file.name)) {
          var warnings = validateVideo(file);
          if (warnings && warnings.length) {
            console.warn('[Deepseek HQ Upload] File warning:', warnings.join(', '));
          }
          console.log('[Deepseek HQ Upload] Processing:', file.name, '(' + (file.size / 1024 / 1024).toFixed(1) + ' MB)');
        }
      }
    }, true);
  }

  installHooks();
  hookFileInput();

  var lastUrl = window.location.href;
  setInterval(function () {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      active = isUploadPage();
      window.__deepseekMethodActive = active;
    } else if (isUploadPage()) {
      window.__deepseekMethodActive = true;
    }
    installHooks();
  }, 500);
})();
