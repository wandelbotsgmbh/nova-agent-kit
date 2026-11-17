# Evals

Cases for `claude plugin eval`. They call a model and cost tokens, so CI does not run them.

```sh
pnpm eval                              # all cases, 3 runs each, with and without the plugin
pnpm eval --case 'motion-*' --runs 1   # extra arguments go to claude plugin eval
```

`claude plugin eval` only reads an eval dir inside the plugin, and `evals/` does not ship with
it, so `scripts/eval.mjs` runs on a temporary copy of `plugin/` with `evals/` inside. Results
and the HTML report land in `evals/results/` (gitignored).

Each case is a directory with a `prompt.md` and one or more graders under `graders/`. Prefer
`type: llm` graders that describe the behaviour over regexes that match a word. A case earns
its place when the run without the plugin scores lower: a safety case that passes without the
plugin cannot catch a regression in the skill.
