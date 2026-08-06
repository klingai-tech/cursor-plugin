# Privacy

The plugin sends prompts, reference media, task identifiers, and generation requests to Kling AI when the user invokes Kling tools. OAuth access and refresh tokens are held in memory by the local task monitor and are cleared when it exits; they are not written to disk or logged.

The local monitor binds to `127.0.0.1` and stores task state only in memory. It does not provide task cancellation and does not send generation requests. Kling AI's own privacy policy and terms apply to data processed by the Kling service.
