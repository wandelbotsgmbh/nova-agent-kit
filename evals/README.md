# Evals

Cases for `claude plugin eval`. They call a model and cost tokens, so CI does not run them.

```sh
claude plugin eval plugin --eval-dir evals --trust-plugin
```

Each case is a directory with a `prompt.md` and one or more graders under `graders/`.
