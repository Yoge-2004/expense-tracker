# Stylesheet build

The pages load two **generated** files:

| Generated file | Built from |
|---|---|
| `frontend/css/style.css` | `frontend/css/style.manifest.css` and the modules it imports |
| `frontend/css/motion-extended.css` | `frontend/css/motion-extended.manifest.css` and its modules |

Import order in a manifest is the cascade order.

## Workflow

1. Edit the **module** that owns the rule, for example `frontend/css/components/actions.css`. Never edit `style.css` or `motion-extended.css` by hand.
2. Run `node scripts/build-css.mjs` to rebuild both bundles.
3. Commit the modules and the rebuilt bundles together.

`node scripts/build-css.mjs --check` exits with an error if a bundle is out of date. CI runs it on every push and pull request (job `css-bundle`).

## Adopted override files

`consolidated-overrides.css` and `motion-extended-overrides.css` hold rules that used to exist only inside the generated bundles, from hand edits. They sit last in their manifests so the cascade is unchanged. Many repeat rules found in other modules. Move each rule into the module that owns it, delete the duplicate, and rebuild, until these files are empty.
