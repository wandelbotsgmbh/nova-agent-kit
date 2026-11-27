# Contributing

Thanks for contributing to the NOVA agent kit!

## Build and test

Requires Node 22 or newer and pnpm (npm works too). `pnpm validate:plugin` needs the Claude
Code CLI, `pnpm validate:skill` needs [uv](https://docs.astral.sh/uv/).

```sh
pnpm install
pnpm build    # regenerate plugin/, .agents/ and .claude-plugin/
pnpm check    # build, generated-output diff, tests, markdownlint, plugin and skill validators
```

Edit adapter content in `skill/`, `nova-bot/` and `adapters/`; everything under `plugin/`, `.agents/` and
`.claude-plugin/` is generated. Commit the generated output together with the source - CI
regenerates it and fails on any difference. [AGENTS.md](AGENTS.md) has the full working
rules: what to edit, what the tests check, and the content rules for the skill (only
released CLI commands, agent-neutral wording, safety rules, no secrets or hostnames).

## Commit messages and releases

Use [Conventional Commits](https://www.conventionalcommits.org/) with a scope where it helps
(`feat(skill): …`, `fix(build): …`, `docs: …`, `ci: …`). The commit types decide the next
version:

| Commit / PR title | Release |
| --- | --- |
| `fix: …` | patch (`0.0.x`) |
| `feat: …` | minor (`0.x.0`) |
| `feat!: …` / `BREAKING CHANGE:` | major |
| `docs:`, `ci:`, `chore:`, `refactor:`, `test:` | none |

With a squash merge the PR title is the commit message, so give the PR a Conventional
Commits title. Merges to `main` publish release candidates (`x.y.z-rc.N`, GitHub
prereleases); stable versions are cut by promoting a verified rc. See
[RELEASING.md](RELEASING.md).

## Security

Do not report vulnerabilities in public issues; see [SECURITY.md](SECURITY.md).
