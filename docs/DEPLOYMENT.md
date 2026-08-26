# Deployment

## Online Demo

The current public Demo is:

https://crpisynoodleeeee.github.io/rta-diagnosis-agent/

GitHub Pages serves the contents of the `gh-pages` branch root. The branch is generated from `demo/v6` by `deploy-ghpages.ps1`.

## Local Demo

The Demo can be opened directly from `demo/v6/index.html`. For a local HTTP server:

```powershell
Set-Location demo/v6
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Optional LLM mode

The public Demo does not require an LLM. To run the optional local DeepSeek path, set `DEEPSEEK_API_KEY` in the local process environment and start `demo/v6/llm-proxy.mjs`. The key must never be written to frontend code, Markdown, screenshots or Git history.

## Release checks

Run the four offline validation scripts from `demo/v6` before publishing. These scripts use Mock data and stubs; they do not prove production media integration or business impact.
