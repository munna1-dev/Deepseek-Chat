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
