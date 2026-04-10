# social.dotmavriq.life

Custom landing page for my Pleroma instance at [social.dotmavriq.life](https://social.dotmavriq.life).

Non-logged-in visitors see a clean, read-only feed of original posts (no replies, no boosts, no directed mentions) styled to match [blog.dotmavriq.life](https://blog.dotmavriq.life). Logged-in users get the standard Pleroma-FE.

## Files

- `index.html` - Pleroma index override, loads `gate.js` before Pleroma-FE
- `gate.js` - Checks localStorage for auth token, redirects non-logged-in users to `social.html`
- `social.html` - Custom landing page (styles inlined)
- `social.js` - Feed loader, marquee, ASCII cityscape backdrop, theme toggle
- `fonts/` - CommitMono and JGS-SingleLine

## Deployment

Files map to Pleroma's static directory:

```
index.html        -> /var/lib/pleroma/static/index.html
gate.js           -> /var/lib/pleroma/static/static/gate.js
social.html       -> /var/lib/pleroma/static/static/social.html
social.js         -> /var/lib/pleroma/static/static/social.js
fonts/            -> /var/lib/pleroma/static/static/fonts/
```

Quick deploy:

```sh
scp index.html gerty:/opt/pleroma/volumes/pleroma/static/
scp gate.js social.html social.js gerty:/opt/pleroma/volumes/pleroma/static/static/
scp fonts/* gerty:/opt/pleroma/volumes/pleroma/static/static/fonts/
```
