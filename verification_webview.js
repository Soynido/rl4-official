/**
 * Script de vérification pour la WebView RL4
 * À coller dans la console du navigateur (DevTools) de la WebView
 */

console.log("═══════════════════════════════════════════════════════════════");
console.log("🔍 ÉTAPE 7: VÉRIFICATIONS FINALES");
console.log("═══════════════════════════════════════════════════════════════");
console.log("");

// 1. Vérifier le nombre de listeners message
const messageListeners = getEventListeners(window).message || [];
console.log("1️⃣ LISTENERS MESSAGE:");
console.log(`   Nombre: ${messageListeners.length}`);
if (messageListeners.length === 1) {
    console.log("   ✅ CORRECT - Un seul listener");
} else {
    console.log(`   ❌ ERREUR - Attendu: 1, Trouvé: ${messageListeners.length}`);
}
console.log("");

// 2. Vérifier l'usage mémoire
const memoryMB = performance.memory ? (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2) : "N/A";
console.log("2️⃣ MÉMOIRE:");
console.log(`   Heap utilisé: ${memoryMB} MB`);
if (performance.memory) {
    const totalMB = (performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(2);
    const limitMB = (performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2);
    console.log(`   Heap total: ${totalMB} MB`);
    console.log(`   Limite: ${limitMB} MB`);
}
if (memoryMB !== "N/A" && parseFloat(memoryMB) >= 230 && parseFloat(memoryMB) <= 260) {
    console.log("   ✅ CORRECT - Mémoire dans la plage attendue (230-260 MB)");
} else if (memoryMB !== "N/A") {
    console.log(`   ⚠️  Mémoire hors plage attendue (230-260 MB)`);
}
console.log("");

// 3. Vérifier les Service Workers
navigator.serviceWorker.getRegistrations().then(registrations => {
    console.log("3️⃣ SERVICE WORKERS:");
    console.log(`   Nombre: ${registrations.length}`);
    if (registrations.length === 0) {
        console.log("   ✅ CORRECT - Aucun service worker");
    } else {
        console.log(`   ❌ ERREUR - ${registrations.length} service worker(s) actif(s)`);
        registrations.forEach((reg, idx) => {
            console.log(`      Worker ${idx + 1}: ${reg.scope}`);
        });
    }
    console.log("");

    // 4. Vérifier le hash du JS chargé
    console.log("4️⃣ HASH DU JS CHARGÉ:");
    const scripts = Array.from(document.querySelectorAll('script[src]'));
    const rl4Script = scripts.find(s => s.src.includes('index-') && s.src.includes('.js'));
    if (rl4Script) {
        const hashMatch = rl4Script.src.match(/index-([^.]+)\.js/);
        if (hashMatch) {
            const hash = `index-${hashMatch[1]}.js`;
            console.log(`   Hash trouvé: ${hash}`);
            if (hash === "index-CVzXGIc4.js") {
                console.log("   ✅ CORRECT - Hash correspond au build attendu");
            } else {
                console.log(`   ❌ ERREUR - Hash attendu: index-CVzXGIc4.js, Trouvé: ${hash}`);
            }
        } else {
            console.log("   ⚠️  Impossible d'extraire le hash");
        }
    } else {
        console.log("   ⚠️  Script RL4 non trouvé");
    }
    console.log("");

    // 5. Rapport final
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("📊 RAPPORT FINAL");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("");
    console.log(`Listeners message: ${messageListeners.length} ${messageListeners.length === 1 ? '✅' : '❌'}`);
    console.log(`Mémoire: ${memoryMB} MB ${memoryMB !== "N/A" && parseFloat(memoryMB) >= 230 && parseFloat(memoryMB) <= 260 ? '✅' : '⚠️'}`);
    console.log(`Service Workers: ${registrations.length} ${registrations.length === 0 ? '✅' : '❌'}`);
    if (rl4Script) {
        const hashMatch = rl4Script.src.match(/index-([^.]+)\.js/);
        if (hashMatch) {
            const hash = `index-${hashMatch[1]}.js`;
            console.log(`Hash JS: ${hash} ${hash === "index-CVzXGIc4.js" ? '✅' : '❌'}`);
        }
    }
    console.log("");
    
    const allOk = messageListeners.length === 1 && 
                  registrations.length === 0 && 
                  (rl4Script && rl4Script.src.includes('CVzXGIc4'));
    
    if (allOk) {
        console.log("✅ TOUTES LES VÉRIFICATIONS SONT PASSÉES");
    } else {
        console.log("❌ CERTAINES VÉRIFICATIONS ONT ÉCHOUÉ");
    }
    console.log("═══════════════════════════════════════════════════════════════");
});
