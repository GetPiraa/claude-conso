# Contributing

**English** · [Français](CONTRIBUTING.fr.md)

Proposals are welcome: a bug you found, a fix, a better way to compute, support for another system, a new language.

## Reporting a problem

Open an [issue](../../issues) and tell us:

- your system (Windows, macOS, Linux) and the mod's version, shown at the bottom of the panel;
- what you expected and what happened, with a screenshot if it is a display problem.

## Proposing a change

1. Fork the repository and create a branch.
2. Change the mod in `conso/`. The display is in `conso/hooks/`, the counting in `conso/bin/scan.mjs`.
3. Run the tests from `conso/`:

   ```bash
   claude plugin validate .
   claude plugin test .
   ```

4. Open a pull request explaining the problem it solves and how you checked it.

A few simple rules:

- **One proposal, one topic.** A fix and a new feature make two pull requests.
- **A test for each behaviour fix**, in `conso/tests/`.
- **The mod sends nothing over the Internet.** A proposal that adds a network call, reads anything other than Claude Code's transcripts or touches other settings will be declined.
- **Do not bump the version number**: it is changed at release time.

Every proposal is reviewed and tested before being merged, because everything that lands on the `main` branch is installed on users' machines at their next update.

## Adding or fixing a language

Each language is one file in `conso/hooks/lang/` (`fr.ts`, `de.ts`…). Between the braces it is strict JSON: the mod reads the file as text, only when that language is needed.

- To fix a translation, edit the text in that language's file.
- To add a language, copy `fr.ts`, translate the values, keep every key and every placeholder (`{0}`, `{1}`…), then add its code to the `Lang` type and to `LANGS` in `conso/hooks/i18n.ts`, its few texts to `TEXTS` in `conso/bin/scan.mjs`, and its file to `conso/tests/langs.ts`.
- The four names in `parts` must stay within 19 characters: the chart legend shows no more.

The tests check that every language has the same keys and placeholders.

## Changing the token weighting

The weights (input, output, cache, per model) are in `conso/bin/scan.mjs` and `conso/hooks/lib.ts`, and must stay identical in both. If you propose another formula, attach the measurements that support it: official percentages and counted tokens, over several sessions.
