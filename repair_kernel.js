// RL4 Kernel Repair Script
const vscode = require('vscode');

async function repairKernel() {
  try {
    // Execute the repair command
    await vscode.commands.executeCommand('reasoning-layer-rl4.repairRBOMLedger');
    console.log('✅ Kernel repair initiated');
  } catch (error) {
    console.error('❌ Repair failed:', error);
  }
}

repairKernel();
