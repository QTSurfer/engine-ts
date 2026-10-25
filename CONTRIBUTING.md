# Contributing

Thank you for helping with the QTSurfer TypeScript engine.

## Licence and the CLA

Wualabs gives this engine under two licences: the GNU AGPL v3 with the QTSurfer Strategy Exception, and a
commercial licence (`LICENSING.md`). To keep that possible, every contribution needs the Wualabs Contributor
License Agreement (`CLA.md`):

- Sign it once, with a comment on your first pull request (the text is at the end of `CLA.md`). The same agreement
  covers the other projects of Wualabs LTD (the QTSurfer Lab, its desktop application): a signature on one counts for all.
- A pull request from someone who has not signed it cannot be merged.
- People who work for Wualabs do not sign it: their work is already Wualabs'.

Do not copy code from another project into a contribution unless you say where it comes from and under which
licence. Code under a licence that does not allow the dual licensing of the engine cannot be accepted.

## Security

Report a vulnerability privately, as `SECURITY.md` says, not in an issue or a pull request.

## Before you open a pull request

```bash
pnpm install
pnpm build
pnpm -r check
pnpm test
```

- A change to a published package needs a changeset (`pnpm changeset`).
- A notable change also gets a file in `Changelog/` (the convention is in `AGENTS.md`, "Changelog convention").
- The numbers of an indicator must stay equal to the Java engine's, and `indicators.md` keeps track of where each
  indicator of the Java engine stands in this port.
