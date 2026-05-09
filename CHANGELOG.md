# Changelog

Toutes les modifications notables de ce projet sont documentées ici.
Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).

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
