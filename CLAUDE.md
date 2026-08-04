# buildtreat

> Created from `musicjunkieg/project-template` on 2026-08-04

<!--
  This file gives Claude Code context for THIS project AND carries the
  cross-project conventions that used to live in ~/.claude/CLAUDE.md.

  Why the duplication: claude.ai cloud sessions read this file from the
  repo at session start, but they DO NOT read your local ~/.claude/CLAUDE.md.
  So anything the cloud session needs to know — workflow norms, deploy
  target, GitHub org — has to live in the repo. Local Mac mini sessions
  read both this file and ~/.claude/CLAUDE.md; the local file keeps
  machine-specific stuff (Safehouse sandbox, M-series hardware, installed
  toolchain inventory). This file owns the portable parts.

  Sections below are scaffolds — delete the ones that don't apply,
  expand the ones that do.
-->

## Cross-project conventions

These hold across every project Bryan owns. Cloud sessions need them in-repo;
local sessions get them from both here and `~/.claude/CLAUDE.md`.

- **Architect / implementer split.** Bryan describes *what* and *why*. You
  figure out *how* and execute. When you hit an ambiguous decision, make the
  call and document it — don't block.
- **Commits.** Conventional commits. `feat:`, `fix:`, `chore:`, `docs:`,
  `refactor:`, `test:`, `perf:`, `style:`. Commit frequently. Push to a
  branch, not main.
- **PRs.** All work goes through PRs — direct commits and pushes to main
  are blocked.
- **Deploy.** Railway unless stated otherwise. Frontend is SvelteKit unless
  stated otherwise.
- **GitHub org.** `musicjunkieg`.
- **Chainlink + deciduous.** Issue tracking via `chainlink issue …`,
  decisions via `deciduous nodes`. The `chainlink-uncommitted` Stop hook
  (committed in this template) warns if `.chainlink/issues.jsonl` is dirty
  at session end — particularly important in cloud sessions where the
  sandbox tears down and unpushed updates are lost.
- **Project-specific gitignore.** The shipped `.gitignore` is
  template-managed — `update-project-from-template` overwrites it. Put
  project-only ignore patterns (credentials, build outputs, research
  scratch dirs, ML models, etc.) in `.gitignore.local` instead. The
  shipped `.gitignore` already lists `.gitignore.local` so it never
  gets committed. Git does NOT read `.gitignore.local` automatically,
  so `scripts/install-hooks.sh` (run at scaffold time and on every
  clone) symlinks `.git/info/exclude` → `.gitignore.local` — that's
  git's per-clone extension point, and the symlink means edits
  propagate live. If you add a `.gitignore.local` for the first time
  after scaffolding, re-run `./scripts/install-hooks.sh` to wire it up.
  Migrate any project-specific patterns from `.gitignore` before the
  next template backfill.
- **Tool reach for risky actions.** Pause and confirm before destructive
  git operations, force-pushes, deletions, or actions visible to others
  (PR comments, etc.). The "executing actions with care" pattern applies.

## What this project is

<!-- One paragraph: what does this project do, who is it for? -->

TODO: describe buildtreat.

## Architecture at a glance

<!--
  Mental model first: how should Claude reason about this codebase?
  System diagram or short description of the moving parts.
-->

TODO: sketch the architecture.

## How to work on this

<!--
  Project-specific workflow on top of the cross-project conventions above.
  Examples: which feature flags to use, which commands run tests,
  which environments to deploy to, what NOT to touch without checking.
-->

### Quick reference

```
# Run tests
TODO: cargo test  /  pnpm test  /  pytest

# Run dev server
TODO: cargo run  /  pnpm dev  /  python -m foo

# Deploy
TODO
```

### Hot zones

<!--
  Areas that need extra care. Things where a "normal" change has
  surprising consequences. Examples: schema migrations, public APIs,
  pricing logic, OAuth flows.
-->

TODO: list the parts of the codebase that need extra care.

## Decision log

Architecturally significant decisions live in `docs/decisions/` as ADRs.
Lightweight in-the-moment decisions are captured in deciduous (`deciduous nodes`).

To capture a new decision: `/decision` (slash command).

## Notes for Claude

<!--
  Hard-won lessons that should NOT be re-learned.
  Examples: "the auth module looks like it should use X but it can't because Y",
  or "always run cargo fmt after editing parser.rs because the macros confuse
  rustfmt the first time."
-->

TODO: drop hard-won lessons here as you go.

<!-- deciduous:start -->
## Decision Graph Workflow

**THIS IS MANDATORY. Log decisions IN REAL-TIME, not retroactively.**

### Available Slash Commands

| Command | Purpose |
|---------|---------|
| `/decision` | Manage decision graph - add nodes, link edges, sync |
| `/recover` | Recover context from decision graph on session start |
| `/work` | Start a work transaction - creates goal node before implementation |
| `/document` | Generate comprehensive documentation for a file or directory |
| `/build-test` | Build the project and run the test suite |
| `/serve-ui` | Start the decision graph web viewer |
| `/sync-graph` | Export decision graph to GitHub Pages |
| `/decision-graph` | Build a decision graph from commit history |
| `/sync` | Multi-user sync - pull events, rebuild, push |

### Available Skills

| Skill | Purpose |
|-------|---------|
| `/pulse` | Map current design as decisions (Now mode) |
| `/narratives` | Understand how the system evolved (History mode) |
| `/archaeology` | Transform narratives into queryable graph |

### The Node Flow Rule - CRITICAL

The canonical flow through the decision graph is:

```
goal -> options -> decision -> actions -> outcomes
```

- **Goals** lead to **options** (possible approaches to explore)
- **Options** lead to a **decision** (choosing which option to pursue)
- **Decisions** lead to **actions** (implementing the chosen approach)
- **Actions** lead to **outcomes** (results of the implementation)
- **Observations** attach anywhere relevant
- Goals do NOT lead directly to decisions -- there must be options first
- Options do NOT come after decisions -- options come BEFORE decisions
- Decision nodes should only be created when an option is actually chosen, not prematurely

### The Core Rule

```
BEFORE you do something -> Log what you're ABOUT to do
AFTER it succeeds/fails -> Log the outcome
CONNECT immediately -> Link every node to its parent
AUDIT regularly -> Check for missing connections
```

### Behavioral Triggers - MUST LOG WHEN:

| Trigger | Log Type | Example |
|---------|----------|---------|
| User asks for a new feature | `goal` **with -p** | "Add dark mode" |
| Exploring possible approaches | `option` | "Use Redux for state" |
| Choosing between approaches | `decision` | "Choose state management" |
| About to write/edit code | `action` | "Implementing Redux store" |
| Something worked or failed | `outcome` | "Redux integration successful" |
| Notice something interesting | `observation` | "Existing code uses hooks" |

### Document Attachments

Attach files (images, PDFs, diagrams, specs, screenshots) to decision graph nodes for rich context.

```bash
# Attach a file to a node
deciduous doc attach <node_id> <file_path>
deciduous doc attach <node_id> <file_path> -d "Architecture diagram"
deciduous doc attach <node_id> <file_path> --ai-describe

# List documents
deciduous doc list              # All documents
deciduous doc list <node_id>    # Documents for a specific node

# Manage documents
deciduous doc show <doc_id>     # Show document details
deciduous doc describe <doc_id> "Updated description"
deciduous doc describe <doc_id> --ai   # AI-generate description
deciduous doc open <doc_id>     # Open in default application
deciduous doc detach <doc_id>   # Soft-delete (recoverable)
deciduous doc gc                # Remove orphaned files from disk
```

**When to suggest document attachment:**

| Situation | Action |
|-----------|--------|
| User shares an image or screenshot | Ask: "Want me to attach this to the current goal/action node?" |
| User references an external document | Ask: "Should I attach a copy to the decision graph?" |
| Architecture diagram is discussed | Suggest attaching it to the relevant goal node |
| Files not in the project are dropped in | Attach to the most relevant active node |

**Do NOT aggressively prompt for documents.** Only suggest when files are directly relevant to a decision node. Files are stored in `.deciduous/documents/` with content-hash naming for deduplication.

### CRITICAL: Capture VERBATIM User Prompts

**Prompts must be the EXACT user message, not a summary.** When a user request triggers new work, capture their full message word-for-word.

**BAD - summaries are useless for context recovery:**
```bash
# DON'T DO THIS - this is a summary, not a prompt
deciduous add goal "Add auth" -p "User asked: add login to the app"
```

**GOOD - verbatim prompts enable full context recovery:**
```bash
# Use --prompt-stdin for multi-line prompts
deciduous add goal "Add auth" -c 90 --prompt-stdin << 'EOF'
I need to add user authentication to the app. Users should be able to sign up
with email/password, and we need OAuth support for Google and GitHub. The auth
should use JWT tokens with refresh token rotation.
EOF

# Or use the prompt command to update existing nodes
deciduous prompt 42 << 'EOF'
The full verbatim user message goes here...
EOF
```

**When to capture prompts:**
- Root `goal` nodes: YES - the FULL original request
- Major direction changes: YES - when user redirects the work
- Routine downstream nodes: NO - they inherit context via edges

**Updating prompts on existing nodes:**
```bash
deciduous prompt <node_id> "full verbatim prompt here"
cat prompt.txt | deciduous prompt <node_id>  # Multi-line from stdin
```

Prompts are viewable in the web viewer.

### CRITICAL: Maintain Connections

**The graph's value is in its CONNECTIONS, not just nodes.**

| When you create... | IMMEDIATELY link to... |
|-------------------|------------------------|
| `outcome` | The action that produced it |
| `action` | The decision that spawned it |
| `decision` | The option(s) it chose between |
| `option` | Its parent goal |
| `observation` | Related goal/action |
| `revisit` | The decision/outcome being reconsidered |

**Root `goal` nodes are the ONLY valid orphans.**

### Quick Commands

```bash
deciduous add goal "Title" -c 90 -p "User's original request"
deciduous add action "Title" -c 85
deciduous link FROM TO -r "reason"  # DO THIS IMMEDIATELY!
deciduous serve   # View live (auto-refreshes every 30s)
deciduous sync    # Export for static hosting

# Metadata flags
# -c, --confidence 0-100   Confidence level
# -p, --prompt "..."       Store the user prompt (use when semantically meaningful)
# -f, --files "a.rs,b.rs"  Associate files
# -b, --branch <name>      Git branch (auto-detected)
# --commit <hash|HEAD>     Link to git commit (use HEAD for current commit)
# --date "YYYY-MM-DD"      Backdate node (for archaeology)

# Branch filtering
deciduous nodes --branch main
deciduous nodes -b feature-auth
```

### CRITICAL: Link Commits to Actions/Outcomes

**After every git commit, link it to the decision graph!**

```bash
git commit -m "feat: add auth"
deciduous add action "Implemented auth" -c 90 --commit HEAD
deciduous link <goal_id> <action_id> -r "Implementation"
```

The `--commit HEAD` flag captures the commit hash and links it to the node. The web viewer will show commit messages, authors, and dates.

### Git History & Deployment

```bash
# Export graph AND git history for web viewer
deciduous sync

# This creates:
# - docs/graph-data.json (decision graph)
# - docs/git-history.json (commit info for linked nodes)
```

To deploy to GitHub Pages:
1. `deciduous sync` to export
2. Push to GitHub
3. Settings > Pages > Deploy from branch > /docs folder

Your graph will be live at `https://<user>.github.io/<repo>/`

### Branch-Based Grouping

Nodes are auto-tagged with the current git branch. Configure in `.deciduous/config.toml`:
```toml
[branch]
main_branches = ["main", "master"]
auto_detect = true
```

### Audit Checklist (Before Every Sync)

1. Does every **outcome** link back to what caused it?
2. Does every **action** link to why you did it?
3. Any **dangling outcomes** without parents?

### Git Staging Rules - CRITICAL

**NEVER use broad git add commands that stage everything:**
- ❌ `git add -A` - stages ALL changes including untracked files
- ❌ `git add .` - stages everything in current directory
- ❌ `git add -a` or `git commit -am` - auto-stages all tracked changes
- ❌ `git add *` - glob patterns can catch unintended files

**ALWAYS stage files explicitly by name:**
- ✅ `git add src/main.rs src/lib.rs`
- ✅ `git add Cargo.toml Cargo.lock`
- ✅ `git add .claude/commands/decision.md`

**Why this matters:**
- Prevents accidentally committing sensitive files (.env, credentials)
- Prevents committing large binaries or build artifacts
- Forces you to review exactly what you're committing
- Catches unintended changes before they enter git history

### Session Start Checklist

```bash
deciduous check-update    # Update needed? Run 'deciduous update' if yes
deciduous nodes           # What decisions exist?
deciduous edges           # How are they connected? Any gaps?
deciduous doc list        # Any attached documents to review?
git status                # Current state
```

### Multi-User Sync

Sync decisions with teammates via event logs:

```bash
# Check sync status
deciduous events status

# Apply teammate events (after git pull)
deciduous events rebuild

# Compact old events periodically
deciduous events checkpoint --clear-events
```

Events auto-emit on add/link/status commands. Git merges event files automatically.
<!-- deciduous:end -->
