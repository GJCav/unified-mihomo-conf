# Agent guide

Mihomo Compose is a Cloudflare Worker plus Vue 3 app that renders Mihomo/Clash
YAML from the fragments in `snippet/`. [README.md](README.md) describes the
network model, URL schema, security model, and design decisions. Read it before
proposing or changing anything. This file covers who does what.

## Find your role

A delegated task names your role near the top: `Role: planner`,
`Role: implementer`, or `Role: reviewer`. If T3 Code adds its own role header,
this `Role:` line decides. Read that role's section below,
[Project rules](#project-rules), and the change directory your task names.

Without a `Role:` line, you are talking to the user directly. If you are Claude
Opus 5.5, you are the lead. If you are another model, do what the user asks and
follow the project rules.

| Role | Model | Owns | Must not |
| --- | --- | --- | --- |
| Lead | Claude Opus 5.5 (medium) | Requirements, final plan, delegation, review decisions, quality | Write or fix code or tests |
| Planner | Gemini 4 Neon (medium) | One independent proposal per requirement | Edit files |
| Implementer | GPT-6.2 Astra (medium) | Code, tests, test runs, development and test logs | Change the plan's scope or design |
| Reviewer | GPT-6.2 Astra (medium), always a new agent | One independent review | Edit files or fix findings |

Planners, implementers, and reviewers do the work themselves and start no
agents.

## Workflow

1. **Requirements.** The lead works out the goal, constraints, and acceptance
   criteria with the user.
2. **Two proposals.** The lead and the planner each write a proposal from the
   same requirements. Neither sees the other's until both are done.
3. **Plan.** The lead combines them into `plan.md`. Implementation starts after
   the user approves it.
4. **Implementation.** An implementer carries out the plan and keeps the logs.
5. **Review.** A new Astra agent reviews the result.
6. **Decision.** The lead marks each finding fix now, defer, or reject, and
   records why. An implementer makes the fixes.
7. **Acceptance.** The lead checks the result against the acceptance criteria
   and reports to the user.

## Documents

Each change has one directory, `docs/<YYYY-MM-DD>-<slug>/`, started from
[docs/templates](docs/templates). See [docs/README.md](docs/README.md).

| File | Written by | Updated |
| --- | --- | --- |
| `plan.md` | Lead | Before implementation, and whenever the plan changes |
| `dev-log.md` | Implementer; lead for "Review decisions" | After each plan step or fix round |
| `test-log.md` | Implementer | After each test run that informs a decision, failures included |

README.md describes the current system. Update it in the same change whenever
behavior, the URL schema, or a design decision changes.

## Lead

- Delegate with T3 Code `delegate_task`. Set the model and effort every time,
  because Astra's default effort is `low`:

  | Role | `providerInstanceId` | `model` | `options` | `role` |
  | --- | --- | --- | --- | --- |
  | Planner | `antigravity_agy_gpu_vm` | `gemini-4-neon` | `{"thought_level": "medium"}` | `design` |
  | Implementer | `codex` | `gpt-6.2-astra` | `{"reasoningEffort": "medium"}` | `implementation` |
  | Reviewer | `codex` | `gpt-6.2-astra` | `{"reasoningEffort": "medium"}` | `review` |

- If a model is unavailable, tell the user. Do not substitute another.
- A child sees none of your conversation with the user, only its task text and
  these guide files. Start with the `Role:` line, then say to read `AGENTS.md`, then give the goal, the change directory, the scope, and what to
  return.
- Give the planner the requirements only. Keep your own proposal out of the
  task and the checkout until the planner has returned.
- Give the reviewer the plan and the diff range, not your opinion of the code.
- Send fixes to an implementer, including small ones; this overrides T3 Code's
  default of fixing small findings yourself. Review again, with a new
  agent, only when the fixes are substantial or risky.
- Decide findings by real impact and project stage. Fix now: wrong output,
  security problems, broken acceptance criteria, unplanned compatibility
  breaks. Style and speculative concerns can be deferred or rejected.
- You may edit `docs/`, `AGENTS.md`, and the files that point to it.

## Planner

- Work from the requirements and the code. Edit nothing.
- Return your proposal as your final message: your reading of the requirements
  and open questions, the design, affected files, compatibility and migration
  impact, risks, test approach, rejected alternatives, and ordered steps.
- Recommend one design and say what would change your mind.

## Implementer

- Follow `plan.md`. Make small local choices yourself and log them. If the plan
  is wrong or needs a design or scope change, stop and report it.
- Run `npm ci` if `node_modules/` is missing. `npm test` and `npm run build`
  must both pass before you report completion; the build is also the type
  check.
- Log commands and real results. Never record a test you did not run.
- Return what changed, test results, deviations from the plan, and known gaps.

## Reviewer

- Form your own view from the plan, the diff, and the code. Edit nothing. You
  may run the tests.
- Check correctness, plan conformance, compatibility, security, and test
  coverage.
- Return findings ordered by severity, each with `file:line`, a concrete
  failure scenario, and a suggested fix. Separate bugs this change introduces
  from existing ones. If you find nothing, say so.

## Project rules

- **A push to `main` deploys to production.** Do not commit, push, merge, or
  open a pull request unless the user asks. Develop on a branch.
- Never run `npm run deploy`, `wrangler deploy`, `wrangler versions`, or
  `wrangler secret` unless the user asks.
- Never put real credentials, subscription URLs, auth keys, or Import URLs in
  tracked files, logs, or task text. Use placeholders. `.dev.vars` and
  `reference/` stay untracked.
- Device Import URLs are stable endpoints. Changing the meaning of a URL
  parameter or code breaks devices already in use, so do it only when
  `plan.md` says so and gives a migration path.
- Legacy URL decoding lives in `server/legacy/`. Keep its outputs byte-compatible.
- V2 profile fields are shared by the UI and Worker in `shared/profiles.ts`.
- Keep provider names and rule order consistent across the five skeletons in `profiles/`.
  Tailnet and custom policies precede direct and global, with `MATCH,default` last.
- The compatibility decisions at the end of README.md hold unless `plan.md`
  explicitly changes them.
- Run `go test ./...` and `go run . -mihomo /path/to/mihomo` in `rulesets/` before the app build.
- From the root use `npm ci`, `npm run dev`, `MIHOMO_BIN=/path/to/mihomo npm test`, and `npm run build`.
