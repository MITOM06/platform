#!/bin/bash
# ==============================================================================
# GitHub Secrets Setup Script
# Run: bash scripts/set-github-secrets.sh
# Requires: gh CLI (brew install gh) + gh auth login
# DO NOT commit this file after filling in production values
# ==============================================================================

REPO="MITOM06/platform"

# ─── GCP (Workload Identity — no JSON key needed) ─────────────────────────────
GCP_PROJECT_ID="project-f338c3d2-64dd-47cd-873"
GCP_WORKLOAD_IDENTITY_PROVIDER="<GCP_WORKLOAD_IDENTITY_PROVIDER>"
GCP_SERVICE_ACCOUNT="<GCP_SERVICE_ACCOUNT>"

# ─── PRODUCTION INFRA (fill these in) ─────────────────────────────────────────
MONGODB_URI="<MONGODB_URI>"
REDIS_URL="<REDIS_URL>"
ANTHROPIC_API_KEY="<ANTHROPIC_API_KEY>"

# ─── Auth & Security ──────────────────────────────────────────────────────────
JWT_ACCESS_SECRET="<JWT_ACCESS_SECRET>"
JWT_REFRESH_SECRET="<JWT_REFRESH_SECRET>"

# ─── Google OAuth ─────────────────────────────────────────────────────────────
GOOGLE_CLIENT_ID="<GOOGLE_CLIENT_ID>"
GOOGLE_CLIENT_SECRET="<GOOGLE_CLIENT_SECRET>"

# ─── Facebook OAuth ───────────────────────────────────────────────────────────
FACEBOOK_APP_ID="<FACEBOOK_APP_ID>"
FACEBOOK_APP_SECRET="<FACEBOOK_APP_SECRET>"

# ─── X (Twitter) OAuth ────────────────────────────────────────────────────────
X_CLIENT_ID="<X_CLIENT_ID>"
X_CLIENT_SECRET="<X_CLIENT_SECRET>"

# ─── Mail ─────────────────────────────────────────────────────────────────────
MAIL_HOST="smtp.gmail.com"
MAIL_PORT="587"
MAIL_USER="<MAIL_USER>"
MAIL_PASS="<MAIL_PASS>"

# ─── Firebase ─────────────────────────────────────────────────────────────────
# (base64 of service account JSON — already encoded)
FIREBASE_SERVICE_ACCOUNT_BASE64="ewogICJ0eXBlIjogInNlcnZpY2VfYWNjb3VudCIsCiAgInByb2plY3RfaWQiOiAicG9uLWMzMGZkIiwKICAicHJpdmF0ZV9rZXlfaWQiOiAiMmE5ZWZhNjE1MTYyNWNhNzhiOTliZmM1ZWI4NTYxY2ViYzNlN2MxMyIsCiAgInByaXZhdGVfa2V5IjogIi0tLS0tQkVHSU4gUFJJVkFURSBLRVktLS0tLVxuTUlJRXZ3SUJBREFOQmdrcWhraUc5dzBCQVFFRkFBU0NCS2t3Z2dTbEFnRUFBb0lCQVFDMFh5SFRGeWpSOXhDYVxuZ3J6dXNxMDBHVXlUOSsvN0V1YnBUNjg5cWtsRXBaMDhoQnJoaTJrSXRtaUFhQTJDMU15VWlObGdIWVVxNkNtQlxuMGtFNWlKTURhNmN5YWZvbzdtSnBjendmbFJSeE84RUtxZ0RCTU5VWXhvRnZzUUVxRjFiZWd6QmR1U1N4WmlScFxuQ0ZHM1JzN2h6Q2JkWXBaZC9hR2dHUTBFQzFRR3lGWndPSmxrelZDcURiNzUxWUpWSzhxVzlsdHgrcGNkVE1aZlxucUYvcUpWZ3R6NDdYdER2dTBjOGRRVVlJRUFLbFdtTmw2VUkwRGRGTHM3ZzI5bDJ2cC9XaFRMMzcwL3pqZ3FlYVxuc3VPY1ZlcURYSnoyU2ZZSncxOWxEWUxhNnZib004RU44K04xVDcwNjREY1Z3c3pNNXNObkxBOWMrOEs1Q09YZlxucklUdkVkQy9BZ01CQUFFQ2dnRUFEeExvTzhEeXUyRmZkTm82T2VTYXp3RFNRb2QwK2RHaGxKd0JOREVZQUhHcVxueTFUcS9qQnRiYm40ejhwaVhxMjBEekhFb09DMnNWaEhwNzdQanFSWVRPL2hRRGhWSExpWFp1S25ncWd0MWl5OVxuUEV2cTFqcGpoTGVLTjdCZVBZdEh5ajdDZXdLdkMxaFM4S2d1VkJmSjBGc0VZSG9Od1BzaVY4UGdMNWRXeFY0eVxudTNZTTFMdlJkRmNKcHJIazgweXY5WFR6ZGVYSW1STldUdzNSMG95dWQyMkJsajVuZkVvV05qTENUbVZlUUFyQlxueDhHNVRtQjk0ZzlFaTRmbk1kSGtUUTRKbzNCNTNUOGJOZkxQYlRlY2ZLMTRZNmE3aFQvUWJRYUUxZDdOUDdYZ1xuOXpLaXpEYWc4YmYvcmlXTmwzUFk4aTYwV2NzSFRVZFMrWndFYjJBOWFRS0JnUURvb1dnTlFybmZKdlZJZm5zWVxuWHp3cTdWRjQxRVA1elRQZEtBWmE1cnp3djFPUVJtdzFVSkR6Z3ZVTzhQN2U3ZDM5eDRuZERXMnNjT1A3ZkN2V1xuZ0RIR3ArRUNRbnpPbWZGZHZSNGIvYndHL09vSHg0ZDdVcU5EVC9yL3dtZWJaOFdlQ0NrQzU4czFJU052L2tjT1xucFc3dEJBR2c3amxSVkVxVWxrUlhmbDJLUlFLQmdRREdmY2FyNFZzdWtsdFpkOTV0UlMzRzZ4WG9teUdVMEFlOVxuTjBEQjdEOWRZSTZNdzlyOThFMjhJZnpyUk9ObGpqYWUvaE1RYzU0SFNlaFhaNTQ3QXJuL3VNTW5OSzg1L0U1aFxuZzQ2am9MUGorcVhDeTgyd2ErZFZyTFBTVGF5cnUxMVRRWFBZaFRtQlRvNnNLWU96YzBMb2VZWTBvenRiZFNxK1xubmVvMWFpRUJNd0tCZ1FEUy84dHo4NmpKbWZseWxwNHAvZitCNUIwNG5qZEZ0WFVzVENodmZNZTFDYVRPd01GWFxuSGt0TFErWG9kbmlHVlhRN3dpZnVvMFp0MlR0QUdHRmV2b25uYU0vekQ4RktWMkVRcC85T1hqZVVrd1BtcUhqZlxuUjVZajhNQjJDS3VXem1uMUsrdWU0Z1Z6bkNvYlk2U3B5UzJ5dHlhUEJHUml1elNtVHlHUHhtTXJqUUtCZ1FDY1xuTHZ2VTQwNU1KdjJhT0tmY2MwTEI4dGthWG5iZUVaTUZZQ1NrY3JDcFdRRFI0b3ErcGdlRXNYbkI1a0xIOWs4a1xuYStlMFdrVk9sdWtyWFcwMEljRVpadGlvVU54UVZDZVlzMXZaaE9vSHlZSUU5VGkwU1RPT1JvWjRSSVpKMnZSa1xuUG14WlF2c3N0Qk92aERzTlNQU3MySEt4bUg5c1I1V0t4OWN5a0gvSDRRS0JnUUNLeVdpNVFFSFc0UEY1VFBHYlxub0V0Tmt3RjY3Nko0L1dFU3BjR094VFUzRmJieThXeEZKMFZTYWt5cGw4SWtwK0dBQUhnUVR5ZjB1R244aUd3NVxuR0J5MTBBV3hBWkt5M1hEYWNHRGJRcEdneEZRK0ExdnFPZnpxNDVZZE94N3hnSHc3UFJVRzZIYy93TitBZkx1Q1xuckdLbVZPcS9lNlAxMzArVXo4cHBRRzFTQkE9PVxuLS0tLS1FTkQgUFJJVkFURSBLRVktLS0tLVxuIiwKICAiY2xpZW50X2VtYWlsIjogImZpcmViYXNlLWFkbWluc2RrLWZic3ZjQHBvbi1jMzBmZC5pYW0uZ3NlcnZpY2VhY2NvdW50LmNvbSIsCiAgImNsaWVudF9pZCI6ICIxMDI1MDg1OTk3ODI4NjIxNTU2NjEiLAogICJhdXRoX3VyaSI6ICJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20vby9vYXV0aDIvYXV0aCIsCiAgInRva2VuX3VyaSI6ICJodHRwczovL29hdXRoMi5nb29nbGVhcGlzLmNvbS90b2tlbiIsCiAgImF1dGhfcHJvdmlkZXJfeDUwOV9jZXJ0X3VybCI6ICJodHRwczovL3d3dy5nb29nbGVhcGlzLmNvbS9vYXV0aDIvdjEvY2VydHMiLAogICJjbGllbnRfeDUwOV9jZXJ0X3VybCI6ICJodHRwczovL3d3dy5nb29nbGVhcGlzLmNvbS9yb2JvdC92MS9tZXRhZGF0YS94NTA5L2ZpcmViYXNlLWFkbWluc2RrLWZic3ZjJTQwcG9uLWMzMGZkLmlhbS5nc2VydmljZWFjY291bnQuY29tIiwKICAidW5pdmVyc2VfZG9tYWluIjogImdvb2dsZWFwaXMuY29tIgp9Cg=="

# ─── AI Service ───────────────────────────────────────────────────────────────
# Optional — set if using OpenAI or Qdrant
OPENAI_API_KEY="<OPENAI_API_KEY>"
QDRANT_URL=""
AI_BOT_DISPLAY_NAME="Aria"

# ==============================================================================
echo "Setting GitHub Secrets for repo: $REPO"
echo "--------------------------------------"

set_secret() {
  local name=$1
  local value=$2
  if [ -z "$value" ] || [[ "$value" == *"<"* ]]; then
    echo "⚠️  SKIP $name — value not filled in"
    return
  fi
  if echo "$value" | gh secret set "$name" --repo "$REPO" 2>&1; then
    echo "✅ $name"
  else
    echo "❌ FAILED $name"
  fi
}

# GCP
set_secret "GCP_PROJECT_ID"                    "$GCP_PROJECT_ID"
set_secret "GCP_WORKLOAD_IDENTITY_PROVIDER"    "$GCP_WORKLOAD_IDENTITY_PROVIDER"
set_secret "GCP_SERVICE_ACCOUNT"               "$GCP_SERVICE_ACCOUNT"

# Infra
set_secret "MONGODB_URI"                       "$MONGODB_URI"
set_secret "REDIS_URL"                         "$REDIS_URL"

# Auth
set_secret "JWT_ACCESS_SECRET"                 "$JWT_ACCESS_SECRET"
set_secret "JWT_REFRESH_SECRET"                "$JWT_REFRESH_SECRET"
set_secret "ANTHROPIC_API_KEY"                 "$ANTHROPIC_API_KEY"

# OAuth
set_secret "GOOGLE_CLIENT_ID"                  "$GOOGLE_CLIENT_ID"
set_secret "GOOGLE_CLIENT_SECRET"              "$GOOGLE_CLIENT_SECRET"
set_secret "FACEBOOK_APP_ID"                   "$FACEBOOK_APP_ID"
set_secret "FACEBOOK_APP_SECRET"               "$FACEBOOK_APP_SECRET"
set_secret "X_CLIENT_ID"                       "$X_CLIENT_ID"
set_secret "X_CLIENT_SECRET"                   "$X_CLIENT_SECRET"

# Mail
set_secret "MAIL_HOST"                         "$MAIL_HOST"
set_secret "MAIL_PORT"                         "$MAIL_PORT"
set_secret "MAIL_USER"                         "$MAIL_USER"
set_secret "MAIL_PASS"                         "$MAIL_PASS"

# Firebase
set_secret "FIREBASE_SERVICE_ACCOUNT_BASE64"   "$FIREBASE_SERVICE_ACCOUNT_BASE64"

# AI
set_secret "OPENAI_API_KEY"                    "$OPENAI_API_KEY"
set_secret "QDRANT_URL"                        "$QDRANT_URL"
set_secret "AI_BOT_DISPLAY_NAME"               "$AI_BOT_DISPLAY_NAME"

echo ""
echo "Done! Verify at: https://github.com/$REPO/settings/secrets/actions"
