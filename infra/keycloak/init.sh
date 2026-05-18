#!/bin/bash

KC_URL="${KC_URL:-http://keycloak:8080}"
REALM="admin"
CLIENT_ID="knowledge-api"
ADMIN_USER="platform-admin"
ADMIN_PASS="PlatformAdmin123!"
ADMIN_EMAIL="platform-admin@squadfy.local"
ADMIN_FIRST_NAME="Platform"
ADMIN_LAST_NAME="Admin"

log() { echo "[keycloak-init] $*"; }
kcadm() { /opt/keycloak/bin/kcadm.sh "$@"; }

# ---------------------------------------------------------------------------
# 1. Wait until the admin API accepts credentials
# ---------------------------------------------------------------------------
log "Waiting for Keycloak at ${KC_URL}..."
until kcadm config credentials \
    --server "${KC_URL}" \
    --realm master \
    --user admin \
    --password admin 2>/dev/null; do
  log "  Not ready yet, retrying in 5s..."
  sleep 5
done
log "Connected."

# ---------------------------------------------------------------------------
# 2. Realm  (verifyEmail=false so dev login works without SMTP)
# ---------------------------------------------------------------------------
log "Creating realm '${REALM}'..."
kcadm create realms \
  -s realm="${REALM}" \
  -s enabled=true \
  -s displayName="Platform Admin" \
  -s verifyEmail=false 2>/dev/null \
  && log "  Created." || log "  Already exists."

# ---------------------------------------------------------------------------
# 3. Client (direct access grants required for password-grant login)
# ---------------------------------------------------------------------------
log "Creating client '${CLIENT_ID}'..."
kcadm create clients -r "${REALM}" \
  -s clientId="${CLIENT_ID}" \
  -s enabled=true \
  -s publicClient=true \
  -s directAccessGrantsEnabled=true 2>/dev/null \
  && log "  Created." || log "  Already exists."

# ---------------------------------------------------------------------------
# 4. Realm roles
# ---------------------------------------------------------------------------
for ROLE in USER ADMIN ORGANIZATION; do
  log "Creating role '${ROLE}'..."
  kcadm create roles -r "${REALM}" -s name="${ROLE}" 2>/dev/null \
    && log "  Created." || log "  Already exists."
done

# ---------------------------------------------------------------------------
# 5. Platform admin user — all attributes set at creation
# ---------------------------------------------------------------------------
log "Creating user '${ADMIN_USER}'..."
kcadm create users -r "${REALM}" \
  -s username="${ADMIN_USER}" \
  -s email="${ADMIN_EMAIL}" \
  -s emailVerified=true \
  -s firstName="${ADMIN_FIRST_NAME}" \
  -s lastName="${ADMIN_LAST_NAME}" \
  -s enabled=true 2>/dev/null \
  && log "  Created." || log "  Already exists — updating profile..."

# Resolve the user ID to run an idempotent update (handles re-runs)
USER_ID=$(kcadm get users -r "${REALM}" \
  -q username="${ADMIN_USER}" \
  --fields id 2>/dev/null \
  | grep '"id"' | head -1 | awk -F'"' '{print $4}')

if [ -n "${USER_ID}" ]; then
  kcadm update users/${USER_ID} -r "${REALM}" \
    -s email="${ADMIN_EMAIL}" \
    -s emailVerified=true \
    -s firstName="${ADMIN_FIRST_NAME}" \
    -s lastName="${ADMIN_LAST_NAME}" \
    -s enabled=true 2>/dev/null \
    && log "  Profile up to date." || log "  Profile update skipped."
fi

# ---------------------------------------------------------------------------
# 6. Password
# ---------------------------------------------------------------------------
log "Setting password..."
kcadm set-password -r "${REALM}" \
  --username "${ADMIN_USER}" \
  --new-password "${ADMIN_PASS}"
log "  Done."

# ---------------------------------------------------------------------------
# 7. Assign ADMIN role
# ---------------------------------------------------------------------------
log "Assigning ADMIN role..."
kcadm add-roles -r "${REALM}" \
  --uusername "${ADMIN_USER}" \
  --rolename ADMIN 2>/dev/null \
  && log "  Done." || log "  Already assigned."

# ---------------------------------------------------------------------------
log ""
log "============================================================"
log "  Realm      : ${REALM}"
log "  Client     : ${CLIENT_ID}"
log "  User       : ${ADMIN_USER}"
log "  Password   : ${ADMIN_PASS}"
log "  Email      : ${ADMIN_EMAIL} (verified)"
log "  Name       : ${ADMIN_FIRST_NAME} ${ADMIN_LAST_NAME}"
log "============================================================"
