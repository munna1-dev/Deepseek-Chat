#!/bin/sh
set -eu

echo "=========================================="
echo " DEEPSEEK CHAT - COMPLETE REBUILD"
echo "=========================================="

# Verify environment
command -v node >/dev/null 2>&1 || {
  echo "ERROR: Node.js is required."
  exit 1
}

command -v git >/dev/null 2>&1 || {
  echo "ERROR: Git is required."
  exit 1
}

test -f package.json || {
  echo "ERROR: package.json not found."
  exit 1
}

echo ""
echo "1. Checking project..."

node -e '
const p=require("./package.json");
console.log("Project:",p.name);
console.log("Version:",p.version);
console.log("Scripts:",JSON.stringify(p.scripts,null,2));
'

echo ""
echo "2. Creating source backup..."

mkdir -p /public/DeepSeek-Chat-backups

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/public/DeepSeek-Chat-backups/source-$STAMP.tar.gz"

tar czf "$BACKUP" \
  --exclude='./node_modules' \
  --exclude='./.git' \
  --exclude='./.env' \
  --exclude='./.env.*' \
  --exclude='./dist' \
  --exclude='./build' \
  .

echo "Backup created: $BACKUP"

echo ""
echo "3. Creating Git checkpoint..."

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git branch "backup/pre-rebuild-$STAMP" 2>/dev/null || true
  echo "Git checkpoint created where possible."
fi

echo ""
echo "4. Installing pnpm..."

if ! command -v pnpm >/dev/null 2>&1; then
  npm install -g pnpm@10
fi

pnpm --version

echo ""
echo "5. Installing project dependencies..."

if [ -f pnpm-lock.yaml ]; then
  pnpm install --frozen-lockfile
else
  echo "No pnpm-lock.yaml found. Inspect dependencies before proceeding."
  exit 1
fi

echo ""
echo "6. Creating rebuild specification..."

cat > REBUILD_INSTRUCTIONS.md <<'PROMPT'
# COMPLETE CHATGPT-STYLE PLATFORM REBUILD

You are the principal engineer responsible for rebuilding this
repository into a production-ready independent AI assistant platform.

IMPORTANT:
Work directly inside the existing repository.
Preserve the existing React, TypeScript, Rspack and Zustand
architecture unless a documented technical reason requires change.

Do not replace the project with a generic template.

## PRIMARY OBJECTIVE

Build a fully functional ChatGPT-style AI application.

## FRONTEND

Implement:
- Responsive desktop and mobile interface.
- Collapsible conversation sidebar.
- New conversation.
- Conversation search.
- Rename, pin, archive and delete conversations.
- Persistent conversation history.
- Markdown rendering.
- Syntax-highlighted code.
- Copy and regenerate responses.
- Model selector.
- Streaming message composer.
- Attachment and voice controls.
- Settings and profile pages.

## AI ENGINE

Create a modular provider architecture supporting:
- DeepSeek.
- OpenAI-compatible APIs.
- Anthropic.
- Gemini.
- OpenRouter.
- Ollama.
- Self-hosted open-source models.

DeepSeek should remain the primary configurable provider.

Implement:
- Streaming.
- Provider switching.
- Model registry.
- Provider health checks.
- Fallback providers.
- Error handling.
- Request cancellation.
- Conversation context.

All private credentials must remain server-side.

Never expose API keys in frontend code.

## FREE ACCESS

Provide:
- Free registration.
- Free accounts.
- No mandatory subscriptions.
- No payment requirements.
- No artificial daily message allowance.
- No artificial monthly message allowance.
- No arbitrary conversation limits.

Support self-hosted inference through Ollama or compatible
inference infrastructure.

Never claim third-party providers are unlimited or free
when they have usage restrictions or charges.

Implement resource protection and abuse prevention.

## CONVERSATION DATABASE

Implement persistent:
- Users.
- Conversations.
- Messages.
- Attachments.
- User preferences.
- Feedback.
- AI provider settings.
- Audit logs.

Preserve existing IndexedDB functionality where appropriate.
Add a secure backend persistence layer for authenticated users.

## DOCUMENT INTELLIGENCE

Support:
- PDF.
- DOCX.
- TXT.
- CSV.
- XLSX.
- JSON.
- Markdown.
- Images.
- Source code files.

Implement actual text extraction and document analysis.

## IMAGE AND AUDIO

Implement:
- Vision-model integration.
- Image upload and analysis.
- Image generation through a real provider.
- Speech-to-text.
- Text-to-speech.
- Voice conversations.

Do not simulate unavailable integrations.

## WEB SEARCH AND TOOLS

Implement optional:
- Web search.
- Source citations.
- Data analysis.
- Spreadsheet processing.
- Secure sandboxed code execution.

## AUTHENTICATION

Implement:
- Registration.
- Login.
- Logout.
- Password recovery.
- Secure sessions.
- Email verification.
- User settings.
- Account deletion.
- Role-based authorization.

Roles:
- User.
- Administrator.
- Super Administrator.

## ADMINISTRATION

Build a complete administration portal with:
- User management.
- AI provider management.
- Model configuration.
- Provider connectivity tests.
- Usage monitoring.
- Error monitoring.
- Database health.
- Audit logs.
- Application settings.
- Maintenance controls.

## SECURITY

Implement:
- Server-side secret management.
- Input validation.
- Authorization.
- SQL injection prevention.
- XSS protection.
- Secure file handling.
- Session security.
- API abuse protection.
- Audit logging.

Never execute arbitrary code on the application server.

## DEPLOYMENT

Preserve compatible existing deployment configuration.

Prepare:
- Production build.
- Environment variable template.
- Database migrations.
- API configuration.
- Health checks.
- Deployment documentation.

Do not assume serverless hosting can run a permanent local
LLM inference server.

Use a separately hosted inference service when necessary.

## IMPLEMENTATION RULES

1. Inspect every existing source directory first.
2. Preserve working functionality.
3. Back up before destructive changes.
4. Implement real features, not placeholders.
5. Connect every functional interface to its backend.
6. Never invent credentials.
7. Never expose secrets.
8. Run type checks, lint and production builds.
9. Fix discovered errors.
10. Verify integrations before declaring them complete.

Do not stop after creating a plan.

Execute the implementation in phases, testing each phase.

At completion report:
- Files created and changed.
- Features implemented.
- Database migrations.
- AI providers connected.
- Required environment variables.
- Test results.
- Production build results.
- Deployment status.
- Remaining limitations.

BEGIN BY INSPECTING THE ENTIRE REPOSITORY.
THEN IMPLEMENT THE COMPLETE REBUILD.
PROMPT

echo ""
echo "7. Project structure..."

find . -maxdepth 2 \
  -not -path './node_modules*' \
  -not -path './.git*' \
  -type f | sort | head -200

echo ""
echo "8. Available project scripts..."

pnpm run

echo ""
echo "=========================================="
echo " PREPARATION COMPLETED"
echo "=========================================="
echo ""
echo "Backup: $BACKUP"
echo "Specification: REBUILD_INSTRUCTIONS.md"
echo ""
echo "Next: Give your coding agent the instruction:"
echo ""
echo "Read REBUILD_INSTRUCTIONS.md completely."
echo "Inspect the repository and execute every phase."
echo "Do not stop at planning."
echo ""
