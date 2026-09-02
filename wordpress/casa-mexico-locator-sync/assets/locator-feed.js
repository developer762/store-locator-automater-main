(function () {
  'use strict';

  if (!window.CMX_LOCATOR || !window.CMX_LOCATOR.url) return;

  function parseAndEmit(payload) {
    if (!payload || !Array.isArray(payload.locations)) {
      throw new Error('Locator feed has an invalid shape.');
    }
    window.CMX_LOCATOR.locations = payload.locations;
    window.dispatchEvent(new CustomEvent('cmx:locations-ready', { detail: payload }));
    return payload;
  }

  window.CMX_LOCATOR.load = function () {
    var fetchUrl = window.CMX_LOCATOR.url;
    if (fetchUrl && fetchUrl.indexOf('_t=') === -1) {
      fetchUrl += (fetchUrl.indexOf('?') === -1 ? '?' : '&') + '_t=' + new Date().getTime();
    }
    var fetchOptions = {
      credentials: 'same-origin',
      cache: 'no-cache',
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
    };

    return fetch(fetchUrl, fetchOptions)
      .then(function (response) {
        if (!response.ok) {
          if (window.CMX_LOCATOR.restUrl) {
            var restUrl = window.CMX_LOCATOR.restUrl;
            if (restUrl.indexOf('_t=') === -1) {
              restUrl += (restUrl.indexOf('?') === -1 ? '?' : '&') + '_t=' + new Date().getTime();
            }
            return fetch(restUrl, fetchOptions)
              .then(function (restResp) {
                if (!restResp.ok) throw new Error('Locator feed returned HTTP ' + restResp.status);
                return restResp.json();
              });
          }
          throw new Error('Locator feed returned HTTP ' + response.status);
        }
        return response.json();
      })
      .then(parseAndEmit);
  };

  window.CMX_LOCATOR.load().catch(function (error) {
    window.dispatchEvent(new CustomEvent('cmx:locations-error', { detail: error }));
    if (window.console) console.error('Casa Mexico locator:', error);
  });
}());
