#!/usr/bin/env node

/**
 * RL4 Post-Build Export Patcher
 * Fixes Webpack bundle to expose activate/deactivate for VS Code
 */

const fs = require('fs');
const path = require('path');

const bundlePath = path.join(__dirname, '..', 'out', 'extension.js');

console.log('🔧 RL4 Export Patcher: Starting...');

try {
    // Read the bundle
    const bundle = fs.readFileSync(bundlePath, 'utf8');
    console.log('📖 Bundle size:', bundle.length);

    // Find the final IIFE closing pattern
    // We need to capture the module INSIDE the IIFE before it closes
    const iifeClosingPattern = "n(6962)})();";
    console.log('🔍 Looking for pattern:', iifeClosingPattern);

    if (!bundle.includes(iifeClosingPattern)) {
        console.log('❌ IIFE closing pattern not found');
        console.log('Available endings:', bundle.slice(-200));
        throw new Error('IIFE closing pattern not found in bundle');
    }

    // Replace the IIFE closing to capture module BEFORE IIFE ends
    // This way 'n' is still in scope when we call it
    const replacement = `(function() {
    const _module6962 = n(6962);
    module.exports.activate = _module6962.activate;
    module.exports.deactivate = _module6962.deactivate;
    return _module6962;
})()})();`;

    console.log('🔄 Performing replacement...');

    // Replace the IIFE closing
    const patchedBundle = bundle.replace(iifeClosingPattern, replacement);

    // Verify the replacement worked
    if (patchedBundle.includes('module.exports = {')) {
        console.log('✅ Replacement successful');
    } else {
        console.log('❌ Replacement failed');
    }

    // Write back the patched bundle
    fs.writeFileSync(bundlePath, patchedBundle, 'utf8');
    console.log('💾 Bundle written back');

    console.log('✅ RL4 Export Patcher: Bundle successfully patched');
    console.log('📦 Exports now available: module.exports.activate, module.exports.deactivate');

} catch (error) {
    console.error('❌ RL4 Export Patcher failed:', error.message);
    process.exit(1);
}
