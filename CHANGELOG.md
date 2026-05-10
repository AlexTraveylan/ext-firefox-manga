# Changelog

Toutes les modifications notables de ce projet sont documentées ici.
Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).

## [0.3.0] - 2026-05-10

### Ajouté

- Bouton "💾 Sauvegarder" dans le panel pour forcer une sauvegarde manuelle de la position courante

### Corrigé

- La reprise de position (bouton "↻ Reprendre") fonctionnait en deux clics sur les volumes avec lazy loading (lazysizes) — corrigé en copiant `data-src` vers `src` et en attendant un double `requestAnimationFrame` après le chargement
- L'UI affichait `1/N` au lieu de la position sauvegardée lors d'une navigation vers un volume déjà en cours — la position de départ est maintenant initialisée depuis la sauvegarde
- La position ne peut plus reculer : l'IntersectionObserver n'écrase la page courante que si on avance au-delà de la position sauvegardée
- La sauvegarde automatique ne remplace plus une position avancée par une position inférieure lors d'une arrivée en haut de page

## [0.2.0] - 2026-05-08

### Ajouté

- Seuil de 30 secondes minimum avant toute sauvegarde : les visites fugaces ne sont plus enregistrées (`MIN_TIME_ON_PAGE_MS`)
- Limite de 10 entrées par manga : les entrées les plus anciennes (selon `lastVisitedAt`) sont supprimées automatiquement à chaque sauvegarde (`MAX_ENTRIES_PER_SERIES`)

## [0.1.0] - 2026-04-29

### Ajouté

- Suivi de progression par volume/chapitre sur sushiscan.net
- Historique par série avec date de dernière visite
- Reprise en un clic via le bouton flottant
- Parser d'URL pour volumes, chapitres (`volume`, `chapitre`, `chapter`)
