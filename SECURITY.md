# Security

## Reporting a vulnerability

Please do not report security problems in public issues. Use GitHub's private reporting instead: on the repository's **Security** tab, choose **Report a vulnerability**. Describe what you found, how to reproduce it and what it lets an attacker do. You will get an answer as soon as possible, and credit in the release that fixes it if you want it.

## Supported versions

Only the newest full release (the `v1` tag that workflows reference) gets fixes. The studio at [readme.niessen.dev](https://readme.niessen.dev) always runs `main`.

## What matters most

- **Tokens in the action.** `token` and `profile-token` must never appear in logs, rendered images, `data.json` or anything pushed to the asset branch.
- **Rendered SVGs.** Text from configs, GitHub data and feeds ends up in SVG markup. Anything that escapes escaping and injects markup, scripts or external references.
- **Privacy.** Only public repositories may ever be named. Anything that makes a private repository's name, description or contributors appear in an image.
- **The studio.** Share links, `?config=` and `?repo=` load untrusted configs: anything that turns a crafted config into script execution in the studio.
