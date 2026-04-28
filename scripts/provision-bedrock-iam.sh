#!/usr/bin/env bash
# Provision an IAM user with minimal Bedrock permissions for Ramble's
# Claude Haiku 4.5 calls, then write the access key into .env.
#
# Idempotent: re-running with --rotate replaces the existing access key.
# Without --rotate, refuses to clobber existing keys.
#
# Usage:
#   scripts/provision-bedrock-iam.sh                     # initial setup
#   scripts/provision-bedrock-iam.sh --rotate            # rotate keys
#   scripts/provision-bedrock-iam.sh --env-file PATH     # target a different .env

set -euo pipefail

USER_NAME="ramble-bedrock"
POLICY_NAME="BedrockInvokeHaiku"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env"
ROTATE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --rotate) ROTATE=1; shift ;;
    --env-file) ENV_FILE="$2"; shift 2 ;;
    -h|--help) sed -n '2,12p' "$0" | sed 's/^# \?//'; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

command -v aws >/dev/null || { echo "aws CLI required" >&2; exit 1; }
command -v jq  >/dev/null || { echo "jq required" >&2; exit 1; }
[[ -f "$ENV_FILE" ]] || { echo "ENV file not found: $ENV_FILE" >&2; exit 1; }

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "Using AWS account: $ACCOUNT_ID"

# 1. Idempotent user create
if aws iam get-user --user-name "$USER_NAME" >/dev/null 2>&1; then
  echo "✓ User '$USER_NAME' exists"
else
  aws iam create-user --user-name "$USER_NAME" >/dev/null
  echo "✓ Created user '$USER_NAME'"
fi

# 2. Attach inline policy (put-user-policy is idempotent — overwrites by name)
POLICY_DOC=$(cat <<JSON
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "InvokeHaikuViaInferenceProfile",
    "Effect": "Allow",
    "Action": "bedrock:InvokeModel",
    "Resource": [
      "arn:aws:bedrock:*::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0",
      "arn:aws:bedrock:*:${ACCOUNT_ID}:inference-profile/us.anthropic.claude-haiku-4-5-20251001-v1:0"
    ]
  }]
}
JSON
)
aws iam put-user-policy --user-name "$USER_NAME" \
  --policy-name "$POLICY_NAME" \
  --policy-document "$POLICY_DOC"
echo "✓ Inline policy '$POLICY_NAME' attached"

# 3. Handle existing keys
EXISTING=$(aws iam list-access-keys --user-name "$USER_NAME" \
  --query 'AccessKeyMetadata[].AccessKeyId' --output text)
if [[ -n "$EXISTING" ]]; then
  if [[ $ROTATE -eq 1 ]]; then
    for k in $EXISTING; do
      aws iam delete-access-key --user-name "$USER_NAME" --access-key-id "$k"
      echo "✓ Deleted access key $k"
    done
  else
    echo "ERROR: User has existing access keys: $EXISTING" >&2
    echo "Re-run with --rotate to replace them." >&2
    exit 1
  fi
fi

# 4. Create new access key
KEY_JSON=$(aws iam create-access-key --user-name "$USER_NAME")
ACCESS_KEY_ID=$(echo "$KEY_JSON" | jq -r '.AccessKey.AccessKeyId')
SECRET_ACCESS_KEY=$(echo "$KEY_JSON" | jq -r '.AccessKey.SecretAccessKey')
echo "✓ Created access key $ACCESS_KEY_ID"

# 5. Inject into .env (replace existing line in place; append if missing).
# awk avoids sed's special-char issues with secrets containing /, +, =.
update_env_var() {
  local key="$1" value="$2" file="$3"
  if grep -qE "^${key}=" "$file"; then
    awk -v k="$key" -v v="$value" '
      $0 ~ "^"k"=" { print k"="v; next }
      { print }
    ' "$file" > "$file.tmp" && mv "$file.tmp" "$file"
  else
    echo "${key}=${value}" >> "$file"
  fi
}

update_env_var AWS_ACCESS_KEY_ID "$ACCESS_KEY_ID" "$ENV_FILE"
update_env_var AWS_SECRET_ACCESS_KEY "$SECRET_ACCESS_KEY" "$ENV_FILE"
chmod 600 "$ENV_FILE"

echo "✓ Wrote credentials to $ENV_FILE (mode 600)"
echo
echo "Test locally:  pnpm run dev"
echo "For Coolify:   copy AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY into the env-vars panel."
