# Aegis: AI Compliance Coworker MVP

The web workspace and backend for the 10-point plan. It needs Node 22.5 or newer and no npm packages.

## Run it

```
npm start
```

Open http://localhost:4100. Demo accounts are listed on the sign-in page, and the password is `demo1234`.

- **Bluebix admin** opens a populated internal pilot.
- **Northstar admin** opens a blank external customer, so you can test spreadsheet onboarding from step 1.

Run the workflow tests with `npm test`.

## Try the milestone in the UI

1. Sign in as the Bluebix admin. Click **Demo**, then **New clinical hire**. This sends a signed HRMS webhook.
2. Open **Remediation Inbox** to see the new cases.
3. Open **Connections & Health**, find `Action needed: BLS provider card` in the outbox, and click **Open link**.
4. Upload a text file like this one, using the new hire's name:
   ```
   Basic Life Support
   Name: Priya Nair, RN
   Card No: AHA-9
   Expiration Date: 2029-03-01
   ```
5. In **Remediation Inbox**, choose **Closed**. The case has closed with that evidence. The check, dashboard and chat all show the new result.
6. Upload the same file with a different name to see it go to review instead.
7. Click **Demo**, then **Advance 4 days** a few times to see reminders, escalation and a human assignment decision.

## Turn on AI

Sign in as an administrator, open **Settings**, and paste a DeepSeek or Claude key under **AI Engine**. Aegis tests the key before saving it and stores it encrypted. You can put it in a `.env` file instead (see `.env.example`).

DeepSeek reads JPEG, PNG, GIF and WebP images but not scanned PDFs, so those go to human review. Fields that AI reads from an image always need a person to confirm them.

## How the code is organized

| Plan layer | File |
|---|---|
| Chat and web workspace | `public/`, `server/chat.js` |
| Connectors and compliance register | `server/connectors.js` |
| Pack registry | `server/registry.js`, `server/packs/*.json` |
| Event service and scheduler | `server/platform.js`, `server/index.js` |
| Control evaluator (no AI) | `server/evaluator.js` |
| Coworker orchestrator | `server/engine.js`, `server/chat.js`, `server/llm.js` |
| Action service | `server/engine.js` (`enqueueAction`, `sendAction`, `decide`) |
| Evidence and audit store | `server/evidence.js`, `server/platform.js` |
| Dashboards, reports, metrics | `server/views.js` |

Change the HRMS field mapping in `mapHrms` in `server/connectors.js`.

See `docs/COMPLETE-WORKFLOW.md` for the gap analysis, the full workflow and what is still needed for production.
