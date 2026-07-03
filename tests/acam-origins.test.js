const assert = require('node:assert/strict');
const test = require('node:test');

const appOrigin = new URL('https://app.trezzhaus.com').origin;
const studioOrigin = new URL('https://studio.trezzhaus.com').origin;

test('default ACAM origins include both Trezzhaus hosts', () => {
    delete process.env.ACAM_ALLOWED_ORIGINS;
    delete require.cache[require.resolve('../dist/lumi-acam')];

    const {defaultAcamConfig, isOriginAllowed} = require('../dist/lumi-acam');

    assert.ok(defaultAcamConfig.allowedOrigins.includes(appOrigin));
    assert.ok(defaultAcamConfig.allowedOrigins.includes(studioOrigin));
    assert.equal(isOriginAllowed(appOrigin, defaultAcamConfig.allowedOrigins), true);
    assert.equal(isOriginAllowed(studioOrigin, defaultAcamConfig.allowedOrigins), true);
});
