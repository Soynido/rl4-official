# RL4 Screenshots Guide

Pour compléter le README, voici les screenshots à capturer :

## 📸 Screenshots requis (4 images)

### 1. **Dashboard View** (`screenshot-dashboard.png`)
- **What:** Vue principale avec les 4 KPI cards affichés
- **How to capture:**
  1. Ouvrir RL4 WebView
  2. Générer un snapshot avec le bouton "Generate Context Snapshot"
  3. Attendre que les 4 KPI cards s'affichent
  4. Capturer la fenêtre complète
- **Resolution:** 1920x1080 (recommandé)
- **Format:** PNG
- **Location:** `.marketplace-assets/screenshot-dashboard.png`

### 2. **Cognitive Load Card** (`screenshot-cognitive-load.png`)
- **What:** Zoom sur la KPI card "Cognitive Load" avec le tooltip ouvert
- **How to capture:**
  1. Hover sur l'icône ❓ de la card "Cognitive Load"
  2. Attendre que le tooltip s'affiche
  3. Capturer la card + tooltip
- **Resolution:** 800x600
- **Format:** PNG
- **Location:** `.marketplace-assets/screenshot-cognitive-load.png`

### 3. **Plan Drift Tracking** (`screenshot-plan-drift.png`)
- **What:** Zoom sur la KPI card "Plan Drift" avec détails
- **How to capture:**
  1. Générer un snapshot avec un peu de drift (>10%)
  2. Afficher la card "Plan Drift"
  3. Capturer la card complète
- **Resolution:** 800x600
- **Format:** PNG
- **Location:** `.marketplace-assets/screenshot-plan-drift.png`

### 4. **Deviation Mode Selector** (`screenshot-modes.png`)
- **What:** Dropdown des modes (Strict/Flexible/Exploratory/Free)
- **How to capture:**
  1. Cliquer sur le dropdown "Deviation Mode"
  2. Capturer avec le menu déroulé
- **Resolution:** 600x400
- **Format:** PNG
- **Location:** `.marketplace-assets/screenshot-modes.png`

---

## 🎨 Guidelines de capture

### Style
- **Background:** VS Code dark theme (Cursor default)
- **Font:** Fira Code ou JetBrains Mono
- **Zoom:** 100% (pas de zoom)
- **Window:** Fullscreen VS Code (pas de distractions)

### Editing
- **Annotations:** Ajouter des flèches/highlights si nécessaire
- **Privacy:** Masquer noms de fichiers sensibles
- **Compression:** Optimiser PNG (TinyPNG.com)

---

## 📝 Checklist finale

Avant de commit :
- [ ] 4 screenshots capturés (dashboard, cognitive-load, plan-drift, modes)
- [ ] Résolutions correctes (1920x1080, 800x600, etc.)
- [ ] Format PNG optimisé
- [ ] Placés dans `.marketplace-assets/`
- [ ] Références README mises à jour (si chemins changent)

---

## 🚀 Après capture

Une fois les screenshots prêts :
```bash
cd rl4-official
git add .marketplace-assets/
git commit -m "docs: Add marketplace screenshots"
git push origin master
```

Puis mettre à jour le README si nécessaire :
```markdown
![RL4 Dashboard](.marketplace-assets/screenshot-dashboard.png)
```

