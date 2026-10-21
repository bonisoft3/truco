from pathlib import Path

app = Path(__file__).resolve().parent.parent
source = (app / "docker/Caddyfile").read_text()
if source.count("(app) {") != 1:
    raise RuntimeError("expected one generated Caddy app snippet")
# Docker publishes TCP at a different port; advertising container QUIC strands clients.
source = source.replace("(app) {", "(app) {\n  header Alt-Svc clear", 1)
preview = app / ".preview"
preview.mkdir(exist_ok=True)
(preview / "Caddyfile").write_text("{\n  servers {\n    protocols h1 h2\n  }\n}\n" + source)
