(function () {
  'use strict';

  if (!window.CMX_LOCATOR || !window.CMX_LOCATOR.url) return;

  window.CMX_LOCATOR.load = function () {
    return fetch(window.CMX_LOCATOR.url, { credentials: 'same-origin' })
      .then(function (response) {
        if (!response.ok) throw new Error('Locator feed returned HTTP ' + response.status);
        return response.json();
      })
      .then(function (payload) {
        if (!payload || !Array.isArray(payload.locations)) {
          throw new Error('Locator feed has an invalid shape.');
        }
        window.CMX_LOCATOR.locations = payload.locations;
        window.dispatchEvent(new CustomEvent('cmx:locations-ready', { detail: payload }));
        return payload;
      });
  };

  window.CMX_LOCATOR.load().catch(function (error) {
    window.dispatchEvent(new CustomEvent('cmx:locations-error', { detail: error }));
    if (window.console) console.error('Casa Mexico locator:', error);
  });
}());
