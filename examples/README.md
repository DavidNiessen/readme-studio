# Example profile project

This folder is what the studio's **Export** produces, using the *Command Center* preset:

- `readme.config.json`: the design
- `.github/workflows/readme-studio.yml`: the scheduled workflow that calls the action

CI renders it with sample data on every push (see `.github/workflows/ci.yml`). Render it locally with:

```bash
npm run example
```

Then open `examples/dist/preview.html`.
