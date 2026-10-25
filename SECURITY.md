# Security policy

## Reporting a vulnerability

Please report a vulnerability **privately**, by e-mail to <security@wualabs.com>. Do not open a public issue or
pull request for it.

Include what you found, the package and version, and how to reproduce it (a small program or test is best). We
acknowledge reports, tell you what we decide, and credit you in the release notes if you wish. We ask you to give
us time to publish a fix before you disclose the problem.

## Supported versions

Only the latest release of each package (`@qtsurfer/core`, `@qtsurfer/indicators`, `@qtsurfer/strategy`) gets
fixes. The packages are `0.x`: upgrade to the latest release before you report.

## Scope

These are libraries that run in your process (a browser or Node.js). A report is in scope when a package, as
published to npm, can be made to run code it should not, to read or write data it should not, or to stop
responding, from input a well-behaved application would pass to it. A defect in how your application uses the
libraries, or in a strategy that you wrote, is not.
