#!/bin/sh
# BUG-EW-6 : tire le mot de passe du webhook RevenueCat, le range comme secret Firebase (REVENUECAT_WEBHOOK_AUTH) et le
# copie dans le presse-papiers pour le coller dans RevenueCat. Il n'est jamais affiché. À lancer une fois, par le fondateur.
set -e
secret=$(openssl rand -hex 32)
printf '%s' "$secret" | firebase functions:secrets:set REVENUECAT_WEBHOOK_AUTH --project contact-on-map-flutter --data-file - >/dev/null
printf '%s' "$secret" | pbcopy
echo "Secret Firebase réglé, et copié dans le presse-papiers (il n'est pas affiché)."
