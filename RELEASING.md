# Releasing

The kit is released in two channels, as in the nova-cli repository:

| Channel | Comes from | Version | Users get it with |
| --- | --- | --- | --- |
| **Release candidate** | every merge to `main` | `x.y.z-rc.N` (GitHub prerelease) | `/plugin marketplace add wandelbotsgmbh/nova-agent-kit` |
| **Stable** | promoting a verified rc to the `release` branch | `x.y.z` (GitHub release) | `/plugin marketplace add wandelbotsgmbh/nova-agent-kit#release` |

Claude Code installs the plugin straight from the branch a marketplace tracks; there is no
build or package step. The tag and the GitHub release name a commit and carry the release
notes.

## Versions live in git tags only

The plugin and marketplace manifests and `package.json` carry no `version`, on purpose.
Without one, Claude Code versions the plugin by commit SHA (`/plugin` shows 12 hex digits),
so every commit on the branch a marketplace tracks counts as an update. A fixed version
string would keep users on their cached copy until someone changed it, would need a bot
commit for every release, and would make the stable commit differ from the verified rc.
`test/plugin.test.mjs` fails if a version comes back, and `pnpm validate:plugin` runs
`claude plugin validate` failing on every warning except the missing version.

[semantic-release](https://semantic-release.gitbook.io/) derives the version from the
[Conventional Commits](https://www.conventionalcommits.org/) since the last release:

| Commits | Bump |
| --- | --- |
| `fix: …` | patch (`0.0.x`) |
| `feat: …` | minor (`0.x.0`) |
| `feat!: …` / `BREAKING CHANGE:` footer | major - from `0.x` that is `1.0.0`, so use it deliberately |
| `docs:`, `ci:`, `chore:`, `refactor:`, `test:` | none, so no rc either |

With a squash merge the PR title becomes the commit message and decides; with a merge
commit, every commit in the PR is analysed. Commits without a bump still reach users on
`main` as an update, because their SHA changes.

Example: `0.1.0` is the latest stable release. A merged `fix:` gives `0.1.1-rc.1`. A
following `feat:` gives `0.2.0-rc.1`, and the next release-worthy merge `0.2.0-rc.2`.
Promoting `0.2.0-rc.2` publishes `0.2.0` with the notes of everything since `0.1.0`.

## 1. Release candidate (automatic)

Merging into `main` runs the *Release* workflow (`.github/workflows/release.yml`). If the
commits call for a release, semantic-release creates the tag `x.y.z-rc.N` and a GitHub
prerelease with the release notes.

## 2. Verify the rc

Follow the `main` channel, or add a local checkout of the rc tag as a marketplace
(`/plugin marketplace add /path/to/nova-agent-kit`), and try the plugin against a real
instance. If something is broken, merge a fix to `main`; that produces the next rc.

## 3. Promote to stable

Run **Actions > Promote > Run workflow** with the verified rc tag (e.g. `0.2.0-rc.2`) as
`ref`, or from a terminal:

```sh
gh workflow run promote.yml -f ref=0.2.0-rc.2
```

The *Promote* workflow (`.github/workflows/promote.yml`):

1. checks that the commit is on `main` and that `release` can be fast-forwarded to it,
2. pushes the commit to the `release` branch,
3. dispatches the *Release* workflow on `release`, which tags `x.y.z` on exactly that commit
   and publishes the GitHub release.

Users on `#release` get the update with their next plugin update (auto-update, or
`claude plugin update nova@nova-agent-kit`). Promoting a commit without `feat`/`fix` changes
since the last stable release moves the branch but cuts no tag.

By hand, this is the same as:

```sh
git fetch origin
git push origin 0.2.0-rc.2^{commit}:refs/heads/release
```

`main` can move on in the meantime. Only the promoted commit is released.

## Rules

- Never commit to `release` directly. It only moves by fast-forwarding to a commit on `main`.
- Only promote rc versions that were actually verified.
- Do not delete rc tags. semantic-release uses them to number the next rc.

## Repository settings

The repository variable `RELEASE_ENABLED` (Settings > Secrets and variables > Actions >
Variables) is the switch: while it is not `true`, every Release run is a dry run, including
the one Promote starts.

If the `release` branch is protected, allow GitHub Actions to push to it (no pull request
rule); otherwise only the manual `git push` way of promoting works.

## Dry run

**Actions > Release > Run workflow** (any branch, `dry_run` checked; or
`gh workflow run release.yml`) shows the version that would be released without tagging or
publishing anything.
