# Contributing

Pull requests are always greatly appreciated, though there are some processes to abide by to ensure that stability and quality of the code base.

- PRs that change the external API _in any way_ must rebuild the `api/temit.api.md` file and include it in the PR. This can be generated using `npm run api:check -- --local`.
- Make sure to include any documentation required by editing the `docs/` files and the `website/` if necessary.
- Don't include any version changes; this is done in the `main` branch.
